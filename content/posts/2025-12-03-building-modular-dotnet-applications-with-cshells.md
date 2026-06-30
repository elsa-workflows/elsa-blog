---
title: "Building Modular .NET Applications with CShells"
slug: "building-modular-dotnet-applications-with-cshells"
description: "CShells is a lightweight shell and feature system for .NET applications that need modular features, tenant-specific configuration, and per-shell dependency injection."
publishedAt: "2025-12-03"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "orchard-core"
  - "docker"
  - "workflow"
  - "multitenancy"
  - "modularity"
featuredImage: "https://cdn-images-1.medium.com/max/800/1*hccxAtUbB0SNsjrh8yXc3Q.png"
featuredImageAlt: "Abstract modular shell architecture for multi-tenant .NET applications"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/building-modular-net-applications-with-cshells-521782089a0b"
seoTitle: "Building Modular .NET Applications with CShells"
seoDescription: "CShells gives .NET apps modular features, shell-specific configuration, route-scoped endpoints, and isolated DI containers for tenants or runtime slices."
redirectFrom: []
---

# Building Modular .NET Applications with CShells

I have wanted Elsa Workflows to support cleaner feature toggling and stronger tenant isolation for a long time.

Coming from the [Orchard Core](https://orchardcore.net/) world, the shell concept has always felt natural. A shell gives you a boundary around a service provider, a feature set, configuration, routing, and lifecycle. That boundary is useful when one host process needs to behave like several different applications.

[CShells](https://github.com/sfmskywalker/cshells) is my lightweight take on that idea for regular .NET applications.

It is not trying to be a CMS. It is not trying to be a complete application framework. It is a shell and feature system you can drop into an ASP.NET Core application when feature flags are no longer enough.

> **Key Takeaways**
> - CShells models each tenant, environment, plan, or runtime slice as a shell with its own enabled features and configuration.
> - Features register services, and web features can map shell-scoped endpoints through `IWebShellFeature`.
> - The current API supports appsettings, JSON files through FluentStorage, and code-first shell configuration.

## What is CShells?

The [CShells README](https://github.com/sfmskywalker/cshells/blob/main/README.md) describes the project as a shell and feature system for .NET projects with per-shell dependency injection and config-driven features. In practical terms, a shell is an isolated runtime slice inside one host application.

That slice can represent a tenant. It can also represent an environment, a pricing plan, a white-label deployment, or a backend-for-frontend surface.

Each shell gets:

- its own shell identity,
- its own enabled feature list,
- its own shell-specific configuration,
- its own service provider,
- and, in ASP.NET Core, route-scoped endpoint registration.

This is different from a simple feature flag.

A feature flag usually turns a branch on or off inside an already-built application. CShells lets a feature bring services and endpoints with it, then enables that feature only for the shells that need it.

## Why build this instead of using feature flags?

Feature flags are great until the feature owns real application shape. Once a feature has services, endpoint mappings, options, background behavior, dependencies, and tenant-specific configuration, a boolean check starts to feel too small.

CShells is for that middle ground.

You may not need a full modular framework. You may also not want every tenant to share the same dependency graph. A shell gives you a place to say: this tenant gets these features, with these settings, under this route.

That was the Elsa-related motivation. I wanted a clean way to enable and isolate capabilities without rebuilding Docker images or maintaining several host variants.

The idea is useful outside Elsa too. Any modular .NET application can run into the same pressure:

- one customer gets Stripe and email,
- another gets PayPal and SMS,
- an admin surface needs extra endpoints,
- a development shell enables diagnostics,
- and a production shell keeps those diagnostics out.

CShells turns those combinations into configuration instead of scattered conditional code.

## How do you define a feature?

For non-web features, implement `IShellFeature` and register services. For web features, implement [`IWebShellFeature`](https://github.com/sfmskywalker/cshells/blob/main/src/CShells.AspNetCore.Abstractions/Features/IWebShellFeature.cs), which adds `MapEndpoints`.

The current `IWebShellFeature` contract is intentionally small: configure services, then map endpoints inside the shell route scope.

```csharp
using CShells.AspNetCore.Features;

public class WeatherFeature : IWebShellFeature
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<IWeatherService, WeatherService>();
    }

    public void MapEndpoints(
        IEndpointRouteBuilder endpoints,
        IHostEnvironment? environment)
    {
        endpoints.MapGet("weather", (IWeatherService service) =>
            service.GetForecast());
    }
}
```

The `[ShellFeature]` attribute is optional. You use it when you need an explicit name, display name, dependencies, or metadata.

```csharp
using CShells.Features;

[ShellFeature("Weather", DisplayName = "Weather API", DependsOn = ["Core"])]
public class WeatherFeature : IWebShellFeature
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSingleton<IWeatherService, WeatherService>();
    }

    public void MapEndpoints(
        IEndpointRouteBuilder endpoints,
        IHostEnvironment? environment)
    {
        endpoints.MapGet("weather", (IWeatherService service) =>
            service.GetForecast());
    }
}
```

That dependency matters. CShells resolves feature dependencies and orders them before building the shell. The feature can stay small, but the runtime still knows that `Weather` depends on `Core`.

## How do you configure shells?

The default configuration section is `CShells`. The current README shows shell names as keys under `CShells:Shells`, with features represented as a map.

```json
{
  "CShells": {
    "Shells": {
      "Default": {
        "Features": {
          "Core": true,
          "Weather": true
        },
        "Configuration": {
          "WebRouting": {
            "Path": ""
          }
        }
      },
      "Admin": {
        "Features": {
          "Core": true,
          "Admin": {
            "MaxUsers": 100,
            "EnableAuditLog": true
          }
        },
        "Configuration": {
          "WebRouting": {
            "Path": "admin",
            "RoutePrefix": "api/v1"
          }
        }
      }
    }
  }
}
```

That format is more expressive than the first preview examples because a feature entry can now carry settings. In other words, a shell can enable `Admin` and give it shell-specific configuration at the same time.

You can also configure shells in code:

```csharp
builder.AddShells(cshells =>
{
    cshells.AddShell("Default", shell => shell
        .WithFeatures("Core", "Weather")
        .WithConfiguration("WebRouting:Path", ""));

    cshells.AddShell("Admin", shell => shell
        .WithFeature("Core")
        .WithFeature("Admin", settings => settings
            .WithSetting("MaxUsers", 100)
            .WithSetting("EnableAuditLog", true))
        .WithConfiguration("WebRouting:Path", "admin")
        .WithConfiguration("WebRouting:RoutePrefix", "api/v1"));
});
```

The [`WithFeatures`](https://github.com/sfmskywalker/cshells/blob/main/src/CShells/Configuration/ShellBuilder.cs) API accepts feature names, feature types, or feature entries. That gives hosts a practical path from simple string-based configuration to more strongly typed setup where it helps.

## What does `MapShells` do?

In ASP.NET Core, `MapShells()` is the handoff point between the host and the shell runtime. The current implementation wires shell resolution middleware, captures endpoint builder access, and registers the dynamic shell endpoint data source.

In normal application code, setup is intentionally boring:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddShells();

var app = builder.Build();

app.MapShells();

app.Run();
```

After that, endpoints contributed by web features are available through the shell's route scope. If the `Admin` shell uses `WebRouting:Path = "admin"`, its web feature endpoints are exposed under that shell path.

That is the part I care about most: features do not need to know every route prefix for every tenant. They map their own endpoints. The shell decides where that endpoint lives.

## How does this help with background work?

HTTP routing is only one side of modular applications. Background workers often need the same shell boundary.

CShells provides `IShellContextScopeFactory` for this. A background service can enumerate applied shells through `IShellHost`, create a shell scope, and resolve the services that belong to that shell.

```csharp
public class DataSyncWorker : BackgroundService
{
    private readonly IShellHost shellHost;
    private readonly IShellContextScopeFactory scopeFactory;

    public DataSyncWorker(
        IShellHost shellHost,
        IShellContextScopeFactory scopeFactory)
    {
        this.shellHost = shellHost;
        this.scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            foreach (var shell in shellHost.AllShells)
            {
                using var scope = scopeFactory.CreateScope(shell);
                var service = scope.ServiceProvider.GetService<IDataSyncService>();

                if (service is null)
                    continue;

                await service.SyncAsync(stoppingToken);
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
```

The important detail is the nullable service lookup. Not every shell has every feature. A worker should be able to skip shells that do not have the feature it needs.

That is how shell isolation should feel in practice. The background worker can run once at the host level, but the actual work happens inside each shell's service provider.

## When is CShells a good fit?

CShells is useful when the application has modular pressure but you still want a single host process.

Good fits include:

- multi-tenant SaaS platforms,
- modular monoliths,
- white-label deployments,
- API gateways or BFF layers,
- environment-specific feature sets,
- plugin-style line-of-business applications,
- and framework-style hosts where modules need clean boundaries.

It is not something I would add to every small application. If a simple `if` statement or configuration flag is enough, use that. The shell model earns its keep when the feature brings services, endpoints, configuration, and lifecycle with it.

## Where does this connect back to Elsa?

Elsa is modular by nature. Workflows, Studio modules, diagnostics, persistence, secrets, and runtime features all benefit from clear boundaries.

CShells is not yet "the Elsa hosting model" in this post. It started as a separate experiment inspired by a problem I expect Elsa and Elsa-based applications to keep running into: how do you give each tenant or runtime slice the right capabilities without turning the host into a pile of conditional registrations?

That same question shows up in later posts about [configuring Elsa with shell features](https://www.elsaworkflows.io/blog/configuring-elsa-with-shell-features) and [building multitenant web apps with CShells](https://www.elsaworkflows.io/blog/building-multitenant-web-apps-in-dotnet-with-cshells).

The useful idea is the boundary.

Features should bring behavior. Shells should decide where that behavior is active. The host should stay boring.

## FAQ

### Is CShells only for multi-tenant applications?

No. Multi-tenancy is the obvious use case, but shells can also model environments, pricing tiers, brands, plugin surfaces, or backend-for-frontend routes. The common requirement is not "tenant"; it is "this runtime slice needs its own features and configuration."

### Do features need `[ShellFeature]`?

No. The attribute is optional. Use it when you need an explicit feature name, display name, dependencies, or metadata. If you do not need those, CShells can derive the feature name from the class.

### Can shells change at runtime?

Yes. CShells includes runtime shell management for adding, updating, removing, and reloading shells without restarting the application. The current runtime model records desired shell definitions and only commits a successor runtime when it is ready, so the last-known-good shell can remain routable during failed updates.
