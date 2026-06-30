---
title: "Building Multitenant Web Apps in .NET with CShells"
slug: "building-multitenant-web-apps-in-dotnet-with-cshells"
description: "Model multitenancy in .NET through isolated shells, feature composition, and per-tenant service containers instead of scattered runtime checks."
publishedAt: "2026-03-01"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "dotnet"
  - "multitenancy"
  - "cshells"
featuredImage: "https://cdn-images-1.medium.com/max/800/1*_DV5XBtHU1P9L5iYYBeC8A.jpeg"
featuredImageAlt: "Building Multitenant Web Apps in .NET with CShells"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/building-multitenant-web-apps-in-net-with-cshells-5e36fb923d77"
seoTitle: "Building Multitenant Web Apps in .NET with CShells"
seoDescription: "Build multitenant .NET apps with CShells by composing isolated shells, feature-specific services, and path-based tenant routing."
redirectFrom: []
---

Multitenancy raises a structural question: where should tenant-specific behavior live?

The usual answer is runtime variation. A service receives a tenant ID, checks which tenant is active, then branches. That works for a while. But the conditionals spread, tests get wider, and the tenant model leaks into code that should not care.

CShells takes the other path. It models each tenant as a shell: an isolated execution context with its own services, configuration, and enabled features. The difference is subtle, but it changes the design. Instead of asking "which tenant am I handling?" inside every service, you let the shell decide which services and endpoints exist.

![Abstract multitenant application architecture with isolated runtime shells](https://cdn-images-1.medium.com/max/800/1*_DV5XBtHU1P9L5iYYBeC8A.jpeg)

> **Key Takeaways**
> - **CShells shells** are isolated application contexts with their own service provider, configuration, and enabled features.
> - **CShells features** package services and endpoints, then shells opt into them through configuration.
> - Current CShells configuration uses a `CShells:Shells` map, where each shell has a `Features` map and optional `Configuration`.

This post builds a small blog platform with three shells:

- `Default`: `Core` and `Posts`
- `Acme`: `Core`, `Posts`, and `Comments`
- `Contoso`: `Core`, `Posts`, `Comments`, and `Analytics`

The goal is not a full SaaS app. It is a clearer mental model for .NET multitenancy, especially if you already think in modular systems like [building modular .NET applications with CShells](/blog/building-modular-dotnet-applications-with-cshells) or [configuring Elsa with shell features](/blog/configuring-elsa-with-shell-features).

## What Is A Shell In CShells?

The CShells docs define a shell as a configured application context with a name, enabled features, and optional shell-specific configuration ([Configuring Shells](https://github.com/sfmskywalker/cshells/blob/main/wiki/Configuring-Shells.md)). In practice, that means each tenant can receive a different dependency injection graph without pushing tenant checks into domain services.

A shell gives you three boundaries:

- A dedicated `IServiceProvider`
- A dedicated `IConfiguration`
- A declared list of enabled features

That is the key design shift. Tenant identity is not just data flowing through requests. Tenant identity decides how a runtime gets constructed.

In our experience, this boundary is where multitenant code either stays clear or starts to sprawl. The CShells tests verify the isolation behavior directly: when middleware resolves a shell, `HttpContext.RequestServices` changes to a scope from that shell rather than the original host provider. That means a request for Acme resolves Acme services, and a request for Contoso resolves Contoso services.

## What Is A Feature In CShells?

The CShells feature docs show two core shapes: `IShellFeature` for service registration and `IWebShellFeature` for services plus endpoint mapping ([Creating Features](https://github.com/sfmskywalker/cshells/blob/main/wiki/Creating-Features.md)). A feature should not know which tenants use it. It should only describe what it contributes.

For web applications, `IWebShellFeature` is the workhorse:

```csharp
using CShells.AspNetCore.Features;
using CShells.Features;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

[ShellFeature("Core")]
public class CoreFeature : IWebShellFeature
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<ITenantInfo>(sp =>
        {
            var configuration = sp.GetRequiredService<IConfiguration>();

            return new TenantInfo
            {
                Name = configuration["Tenant:Name"] ?? "Default",
                Plan = configuration["Tenant:Plan"] ?? "Free"
            };
        });
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints, IHostEnvironment? environment)
    {
        endpoints.MapGet("/", (ITenantInfo tenant) =>
            Results.Ok(new { tenant.Name, tenant.Plan }));
    }
}
```

The `[ShellFeature]` attribute sets a stable feature name and can declare dependencies. Without the attribute, CShells derives the feature name from the class name. That is useful for small projects, but explicit names tend to be easier to read in tenant configuration.

## How Do You Add Tenant-Specific Features?

CShells lets each shell enable a different feature set. The current configuration format uses a map under `CShells:Shells`, and feature entries can be empty objects or objects with settings. CShells tests round-trip this shape and preserve both the shell keys and feature settings.

Here is a small posts feature:

```csharp
[ShellFeature("Posts", DependsOn = ["Core"])]
public class PostsFeature : IWebShellFeature
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<IPostRepository, InMemoryPostRepository>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints, IHostEnvironment? environment)
    {
        endpoints.MapGet("/posts", (IPostRepository posts, ITenantInfo tenant) =>
            Results.Ok(new { tenant = tenant.Name, posts = posts.GetAll() }));
    }
}
```

Because services are registered per shell, each tenant gets its own repository instance in this example. There is no `if (tenant == "Acme")` branch in the repository. The container already encodes the tenant boundary.

Now add a feature that only some tenants should receive:

```csharp
[ShellFeature("Comments", DependsOn = ["Posts"])]
public class CommentsFeature : IWebShellFeature
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<ICommentRepository, InMemoryCommentRepository>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints, IHostEnvironment? environment)
    {
        endpoints.MapGet(
            "/posts/{id:int}/comments",
            (int id, ICommentRepository comments) => Results.Ok(comments.GetByPostId(id)));
    }
}
```

If a shell does not enable `Comments`, its service and endpoint do not exist for that shell. That is the practical benefit: missing capability becomes a composition fact, not a runtime branch.

## How Does Per-Shell Configuration Work?

CShells reads from the `CShells` section by default, and the docs show shells as named entries under `Shells` ([Getting Started](https://github.com/sfmskywalker/cshells/blob/main/wiki/Getting-Started.md)). Each shell can define `Features` and `Configuration`. The `Configuration` object becomes part of that shell's own `IConfiguration`.

This example defines path-based tenants:

```json
{
  "CShells": {
    "Shells": {
      "Default": {
        "Features": {
          "Core": {},
          "Posts": {}
        },
        "Configuration": {
          "Tenant": {
            "Name": "Default",
            "Plan": "Free"
          },
          "WebRouting": {
            "Path": ""
          }
        }
      },
      "Acme": {
        "Features": {
          "Core": {},
          "Posts": {},
          "Comments": {}
        },
        "Configuration": {
          "Tenant": {
            "Name": "Acme",
            "Plan": "Pro"
          },
          "WebRouting": {
            "Path": "acme"
          }
        }
      },
      "Contoso": {
        "Features": {
          "Core": {},
          "Posts": {},
          "Comments": {},
          "Analytics": {
            "TopPostsCount": 10
          }
        },
        "Configuration": {
          "Tenant": {
            "Name": "Contoso",
            "Plan": "Enterprise"
          },
          "WebRouting": {
            "Path": "contoso"
          }
        }
      }
    }
  }
}
```

The `Analytics` entry shows feature-specific settings. CShells preserves those values with the feature entry, so a feature can bind its own options while the shell still controls whether the feature is active.

## How Does Routing Pick The Right Shell?

CShells registers `WebRoutingShellResolver` through `AddShells()`, and the shell-resolution docs say it supports path, host, header, and claim-based routing out of the box ([Shell Resolution](https://github.com/sfmskywalker/cshells/blob/main/wiki/Shell-Resolution.md)). For the example above, path routing is enough.

Requests resolve like this:

| Request path | Shell |
| --- | --- |
| `/` | `Default` |
| `/acme/` | `Acme` |
| `/contoso/` | `Contoso` |

The CShells end-to-end tests cover exactly this shape, including `/`, `/acme/`, and `/contoso/` resolving to the expected shell names. The docs also note that endpoints registered by `IWebShellFeature` are automatically prefixed with the shell's `WebRouting:Path` and optional `WebRouting:RoutePrefix`.

That means the same feature endpoint can be exposed under different tenant paths without rewriting the feature:

- `Default` posts: `/posts`
- `Acme` posts: `/acme/posts`
- `Contoso` posts: `/contoso/posts`

The feature code stays the same. Routing and service resolution do the tenant-specific work.

## What Does Program.cs Need?

The minimal host setup is deliberately small. Install the runtime packages in the host project:

```bash
dotnet add package CShells
dotnet add package CShells.AspNetCore
```

Keep feature definitions in a separate project when the application grows. The CShells docs recommend a feature library that references `CShells.AspNetCore.Abstractions`, while the host references `CShells`, `CShells.AspNetCore`, and the feature library.

Then register and map shells:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddShells();

var app = builder.Build();

app.UseRouting();
app.MapShells();

app.Run();
```

`AddShells()` reads the `CShells` section and registers shell infrastructure. `MapShells()` adds shell middleware and dynamic shell endpoints. The integration docs call out one important ordering rule: register host routes before `MapShells()` when host routes should take priority ([Integration Patterns](https://github.com/sfmskywalker/cshells/blob/main/wiki/Integration-Patterns.md)).

## When Is This Better Than Tenant Checks?

Use shell composition when tenant differences are structural. If one tenant has analytics, another has comments, and another has a custom integration, those are feature differences. Model them as features and let each shell opt in.

Tenant checks are still fine for simple data choices, such as a display label or a retention period. But they become expensive when they control service registrations, endpoints, background work, or external integrations. At that point, conditionals hide architecture inside implementation details.

Shell composition is usually a better fit when:

- Different tenants need different services.
- Different tenants expose different routes.
- Features should be tested independently.
- Tenant configuration should drive runtime composition.
- You want tenant behavior to be visible in configuration.

This same boundary shows up in Elsa work as well. In [configuring Elsa with shell features](/blog/configuring-elsa-with-shell-features), features decide which Elsa capabilities belong in a shell. The principle is the same: compose the runtime explicitly, then keep application code focused.

## FAQ

### Is CShells only for SaaS multitenancy?

No. SaaS multitenancy is a natural fit, but shells can represent any isolated runtime slice: customers, regions, modules, deployment lanes, or branded portals. The useful part is the same in each case: a shell gets its own services, configuration, and enabled features.

### Do all tenants need the same endpoints?

No. Endpoints come from enabled web features. If `Comments` is disabled for `Default`, the comments routes are not registered for that shell. If `Contoso` enables `Analytics`, its analytics endpoint can exist under `/contoso` without existing under `/acme`.

### Should every tenant get a separate process?

Not necessarily. CShells models isolation inside a host process. That is useful when tenants need separate composition but can share deployment infrastructure. If you need process, network, or database isolation for compliance reasons, CShells can still help organize application composition, but it does not replace those deployment boundaries.

## Summary

CShells models multitenancy as structural composition:

- Shells isolate services and configuration.
- Features package behavior.
- Configuration declares which shell gets which features.
- Routing selects the shell before application code runs.

That design keeps tenant differences close to the runtime boundary. It also keeps domain code cleaner. Instead of asking every service to understand multitenancy, build the right shell and let ordinary dependency injection do the rest.
