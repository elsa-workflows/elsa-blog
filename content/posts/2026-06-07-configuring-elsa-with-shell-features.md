---
title: "Configuring Elsa with Shell Features"
slug: "configuring-elsa-with-shell-features"
description: "Shell features let Elsa hosts move feature selection and a good chunk of configuration out of Program.cs and into appsettings-driven shell composition."
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
featuredImage: "../assets/2026-06-07-configuring-elsa-with-shell-features/featured.svg"
featuredImageAlt: "Abstract modular workflow host with connected feature blocks and a central orchestration graph"
seoTitle: "Configuring Elsa with Shell Features"
seoDescription: "A practical look at Elsa shell features, appsettings-based configuration, and why the recent manifest work matters."
redirectFrom: []
---

# Configuring Elsa with Shell Features

One of the less glamorous problems in framework design is this: eventually `Program.cs` starts turning into a policy document.

At first that is fine. A couple of feature registrations are easy to read. Then the application grows a second persistence choice, a different authentication setup, maybe tenant-specific routing, maybe Quartz, maybe blob-backed workflows, maybe a few packages that only make sense in one host and not another.

At that point, static feature wiring starts to feel heavier than it should.

That is the problem Elsa's shell feature work is trying to solve.

Instead of treating feature selection as something that must always be hard-coded in startup, Elsa can increasingly describe features as shell-scoped building blocks that can be enabled and configured from configuration.

Not every Elsa application needs this. A small host with one fixed setup is still perfectly fine with explicit registrations.

But if you are building a modular host, multi-tenant system, internal platform, or package-driven Elsa server, shell features are a much better fit.

## The practical shift

The important bit is not just "features from JSON".

The more useful change is that a feature can now describe:

- what it is,
- what it depends on,
- which settings it exposes,
- and, more recently, a bit of metadata about what kind of infrastructure it expects.

That gives the host a chance to compose Elsa in a more declarative way.

The original big step here was [PR #7278 in `elsa-core`](https://github.com/elsa-workflows/elsa-core/pull/7278), which added shell features across a large set of modules and introduced the modular server sample host. The more recent follow-up work on June 6 and June 7 adds package manifest hints, runtime kind hints, and feature categories so these features can describe themselves more clearly at the package level:

- [Add `PackageManifestHints.cs` to solution and compile include in build props](https://github.com/elsa-workflows/elsa-core/commit/2f668738113f3518dab2b565fcbe0b16420f010b)
- [Add platform manifest runtime kind hints](https://github.com/elsa-workflows/elsa-extensions/commit/d407e9621770a55427ac6c2315bd779da08d5fea)
- [Add shell feature manifest categories](https://github.com/elsa-workflows/elsa-core/commit/4c104635ac64f082bb468ed44e51f7f6d5f4e45f)

I would treat that June metadata work as a sign of direction more than a flashy end-user feature on its own. The thing you can use today is the shell feature model itself.

## What it looks like in a host

The cleanest example right now is [`Elsa.ModularServer.Web`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/Program.cs).

The host sets up shells once, gives them configuration, and then selects a feature set per shell:

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

That is already a different mental model from the usual "build one global Elsa pipeline in startup and be done with it".

Now look at the matching [`appsettings.Example.json`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/appsettings.Example.json).

One shell can enable a small workflow server with SQLite:

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

Another shell can use SQL Server and override only runtime persistence settings:

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

That is the part I think is easy to underestimate.

This is not only about convenience. It changes where composition lives. You can push more environment-specific or tenant-specific setup into configuration while keeping the host code much smaller.

## The feature classes carry the shape

The shell feature types themselves are doing more than service registration.

Take [`HttpFeature`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Http/ShellFeatures/HttpFeature.cs). It is declared with shell metadata and exposes options that can be bound from configuration:

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

Or take [`SqliteWorkflowPersistenceShellFeature`](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Persistence.EFCore.Sqlite/ShellFeatures/SqliteWorkflowPersistenceShellFeature.cs), which wraps a few persistence concerns into one combined feature and documents the intended configuration shape right in the source:

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

That dependency metadata matters because the host no longer needs to know every low-level registration relationship up front.

And the infrastructure metadata matters because Elsa packages are starting to become more self-describing. A SQLite persistence feature can say, in effect, "I am a persistence feature, I need this kind of backing store, and this is the configuration key you probably care about."

I would not oversell that yet. It is foundation work.

But it is good foundation work.

## Why this feels better than bigger startup files

A workflow platform tends to accumulate cross-cutting features quickly:

- persistence,
- scheduling,
- HTTP endpoints,
- authentication,
- tenant routing,
- dashboard modules,
- distributed execution,
- package-provided extensions.

If all of that only lives in `Program.cs`, the host becomes the place where every composition decision must be hard-coded.

Shell features let the modules carry more of their own shape.

In practice, that means a few useful things:

- a package can contribute a feature without forcing the host to manually mirror all of its options,
- a shell can opt into a feature set that is different from the next shell,
- the host can stay relatively small even as the runtime becomes more modular,
- and the path toward package catalogs and more dynamic composition becomes much less awkward.

That last point is where the recent manifest-category and runtime-kind commits become interesting. They do not make the system magical, but they do make it easier for packages to say what they are for.

## This is probably not for every Elsa app

If your application has one Elsa host, one persistence choice, and no serious need for modular composition, I would keep things explicit.

There is nothing wrong with that.

Shell features start paying for themselves when the host stops being one simple host. Multi-tenant setups, internal workflow platforms, white-label products, and package-driven hosts are where this model starts to make a lot more sense.

That is also why I think this work is worth calling out now. It is not just a refactor. It changes how Elsa can be assembled over time.

And if you have been looking at a growing `Program.cs` and thinking "this should not be the only place where Elsa composition can live", that instinct is probably right.
