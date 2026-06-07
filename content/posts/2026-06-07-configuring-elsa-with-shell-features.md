---
title: "Configuring Elsa with Shell Features"
slug: "configuring-elsa-with-shell-features"
description: "A practical look at Elsa shell features and why they start to matter once your host stops being one fixed setup."
publishedAt: "2026-06-07"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "configuration"
  - "modularity"
featuredImage: "../assets/2026-06-07-configuring-elsa-with-shell-features/featured.png"
featuredImageAlt: "Editorial illustration of a modular workflow host assembled from composable blocks around a central workflow graph"
seoTitle: "Configuring Elsa with Shell Features"
seoDescription: "A practical look at Elsa shell features, appsettings-based configuration, and why they matter once host composition gets more complicated."
redirectFrom: []
---

# Configuring Elsa with Shell Features

A workflow host gets awkward once `Program.cs` stops being a startup file and starts becoming a policy document.

At first that is fine. A couple of feature registrations are easy to read. Then you need a second persistence option. Then a different authentication setup. Then tenant-specific routing. Then a scheduler. Then one package that only makes sense in one environment and another package that should absolutely not light up everywhere.

Nothing is terribly wrong yet, but the composition story starts to feel heavier than it should.

That is the part of Elsa's shell feature work I think is worth paying attention to.

The simple version is that feature selection and a fair bit of feature configuration no longer have to live entirely in startup code. Features can increasingly describe themselves as shell-scoped building blocks that a host can enable and configure from configuration.

This is not something every Elsa application needs. If you have one host, one persistence strategy, and no real modularity concerns, explicit code is still a very good answer.

But once the host stops being one fixed setup, the tradeoff changes.

## Where this becomes useful

The important bit is not "you can put things in JSON now".

The more useful change is that a feature can carry more of its own shape:

- what it is,
- what it depends on,
- which settings it exposes,
- and, more recently, some metadata about the kind of infrastructure it expects.

That gives the host a better chance of composing Elsa without hard-coding every decision in one place.

The big move here was [PR #7278 in `elsa-core`](https://github.com/elsa-workflows/elsa-core/pull/7278), which added shell features across a large set of modules and introduced the modular server sample host.

Then there was some quieter follow-up work on June 6 and June 7:

- [Add `PackageManifestHints.cs` to solution and compile include in build props](https://github.com/elsa-workflows/elsa-core/commit/2f668738113f3518dab2b565fcbe0b16420f010b)
- [Add platform manifest runtime kind hints](https://github.com/elsa-workflows/elsa-extensions/commit/d407e9621770a55427ac6c2315bd779da08d5fea)
- [Add shell feature manifest categories](https://github.com/elsa-workflows/elsa-core/commit/4c104635ac64f082bb468ed44e51f7f6d5f4e45f)

I would not pitch those June commits as some big end-user feature. They are more interesting as a signal of where this is going. Elsa packages are getting better at describing what they are, what runtime they belong to, and what sort of infrastructure they assume.

The thing you can use today is the shell feature model itself.

## What this looks like in code

The cleanest example right now is [`Elsa.ModularServer.Web`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/Program.cs).

The host sets up shells once, points them at configuration, and applies a feature set:

```csharp
builder.AddShells(shells => shells
    .WithHostAssemblies()
    .WithAssemblyProvider<NuplaneAssemblyProvider>()
    .WithConfigurationProvider(configuration)
    .WithWebRouting(options => options.EnablePathRouting = true)
    .WithAuthenticationAndAuthorization()
    .ConfigureAllShells(shell =>
    {
        shell.WithFeatures(
            typeof(ElsaFeature),
            typeof(WorkflowManagementFeature),
            typeof(WorkflowRuntimeFeature),
            typeof(WorkflowsFeature),
            typeof(DistributedRuntimeFeature),
            typeof(DashboardApiFeature),
            typeof(WorkflowRuntimeDashboardFeature),
            typeof(ConsoleLogsDashboardFeature),
            typeof(StructuredLogsDashboardFeature),
            typeof(WorkflowsApiFeature));
    }));
```

That is already a different mental model from "wire one global Elsa runtime in startup and call it a day".

Then look at [`appsettings.Example.json`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/appsettings.Example.json).

One shell can light up a small workflow server backed by SQLite:

```json
{
  "Name": "Default",
  "Settings": {
    "FastEndpoints": {
      "GlobalRoutePrefix": "elsa/api"
    },
    "SqliteWorkflowPersistence": {
      "ConnectionString": "Data Source=elsa_workflows.db;Cache=Shared"
    }
  },
  "Features": [
    "Elsa",
    "WorkflowsApi",
    "Identity",
    "DefaultAuthentication",
    "SqliteWorkflowPersistence"
  ]
}
```

Another shell can use SQL Server and override only part of the persistence setup:

```json
{
  "Name": "Tenant1",
  "Properties": {
    "WebRouting": {
      "Path": "tenant1"
    }
  },
  "Settings": {
    "FastEndpoints": {
      "GlobalRoutePrefix": "api"
    },
    "SqlServerWorkflowPersistence": {
      "ConnectionString": "${ConnectionStrings:Tenant1}"
    },
    "SqlServerWorkflowRuntimePersistence": {
      "ConnectionString": "${ConnectionStrings:Tenant1Runtime}"
    }
  },
  "Features": [
    "Elsa",
    "WorkflowsApi",
    "SqlServerWorkflowPersistence"
  ]
}
```

That sounds simple, but it changes where the composition logic lives.

You can push more environment-specific or tenant-specific setup into configuration without turning the host into a long chain of conditional registrations. That is a very different operating model for teams building internal platforms, white-label systems, or multi-tenant workflow hosts.

## The feature classes carry more of the burden

The shell feature types are doing more than just calling into DI.

Take [`HttpFeature`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Http/ShellFeatures/HttpFeature.cs). It declares metadata, dependencies, and configuration-bound options:

```csharp
[ManifestFeatureCategory(ManifestFeatureCategories.HTTP)]
[ManifestFeatureCategory(ManifestFeatureCategories.Workflows)]
[ShellFeature(
    DisplayName = "HTTP",
    Description = "Provides HTTP-related activities and services for workflow execution",
    DependsOn = [typeof(HttpJavaScriptFeature), typeof(ResilienceFeature)])]
public class HttpFeature : IMiddlewareShellFeature
{
    public HttpActivityOptions HttpActivityOptions { get; set; } = new();
}
```

Or take [`SqliteWorkflowPersistenceShellFeature`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Persistence.EFCore.Sqlite/ShellFeatures/SqliteWorkflowPersistenceShellFeature.cs), which wraps a few persistence concerns into one combined feature:

```csharp
[ShellFeature(
    DisplayName = "Sqlite Workflow Persistence",
    Description = "Provides Sqlite persistence for workflow definitions, instances, and runtime data with unified configuration",
    DependsOn = [typeof(SqliteWorkflowDefinitionPersistenceShellFeature), typeof(SqliteWorkflowInstancePersistenceShellFeature), typeof(SqliteWorkflowRuntimePersistenceShellFeature)])]
[ManifestInfrastructure("sqlite-database", "database", Reason = "Stores workflow definitions, instances, and runtime data in SQLite.", Providers = new[] { "SQLite" }, ConfigurationKeys = new[] { "ConnectionString" })]
public class SqliteWorkflowPersistenceShellFeature : CombinedPersistenceShellFeatureBase
{
}
```

The host no longer needs to know every low-level relationship up front. A feature can say what it depends on and what kind of thing it represents.

That second part matters more than it looks. A SQLite persistence feature can now say, in effect: I am persistence, I expect a SQLite database, and this is the configuration key you probably care about.

I would still call this foundation work. But it is useful foundation work, which is usually the kind that ages better.

## Why this is better than a larger `Program.cs`

A workflow platform accumulates cross-cutting concerns fast:

- persistence,
- scheduling,
- HTTP endpoints,
- authentication,
- tenant routing,
- dashboard modules,
- distributed execution,
- package-provided extensions.

If all of that only lives in `Program.cs`, startup becomes the place where every composition decision gets serialized into one file. That is manageable for a while. Then it becomes the place nobody wants to touch without reading half the application first.

Shell features push some of that burden back into the modules themselves.

In practice, that means:

- a package can contribute a feature without forcing the host to manually mirror all of its options,
- a shell can opt into a feature set that is different from the next shell,
- the host can stay relatively small even as the runtime becomes more modular,
- and the path toward package catalogs and more dynamic composition stops feeling bolted on.

That last point is where the recent manifest category and runtime-kind work starts to make sense. It does not make the system magical. It just gives packages a better way to describe themselves, which is exactly the kind of boring detail that makes modular systems less painful.

## It is still not for every Elsa app

If your Elsa application has one host, one persistence choice, and no serious modularity concerns, I would keep things explicit.

There is no prize for moving everything into configuration.

Where shell features start paying for themselves is when the host stops being one simple host. Multi-tenant setups, internal workflow platforms, white-label products, and package-driven servers are where this becomes much easier to justify.

That is why I think this work is worth calling out now. Not because it is flashy, but because it changes how Elsa can be assembled over time.

If you have been looking at a growing `Program.cs` and thinking this should not be the only place where Elsa composition can live, that instinct is probably right.
