---
title: "Configuring Elsa with Shell Features: Modular Hosts"
slug: "configuring-elsa-with-shell-features"
description: "Elsa shell features move host composition into module descriptors and configuration, helping modular and multi-tenant workflow hosts stay understandable."
publishedAt: "2026-06-07"
updatedAt: "2026-06-30"
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
seoTitle: "Configuring Elsa with Shell Features: Modular Hosts"
seoDescription: "Elsa shell features move host composition into module descriptors and configuration, helping modular and multi-tenant workflow hosts stay understandable."
redirectFrom: []
---

# Configuring Elsa with Shell Features: Modular Hosts

Elsa shell features are module-level building blocks that can describe dependencies, settings, metadata, and infrastructure expectations. In Elsa 3.8, that model matters because host composition is moving beyond one fixed `Program.cs` file ([PR #7278](https://github.com/elsa-workflows/elsa-core/pull/7278), 2026).

At small scale, explicit startup code is fine. At platform scale, `Program.cs` can turn into a policy document: persistence, auth, routing, dashboard modules, diagnostics, package loading, tenant setup, and environment differences all compete for the same file.

> **Key Takeaways**
> - Shell features let Elsa modules describe what they provide, depend on, and configure.
> - The modular server sample wires shells once, then lets `CShells:Shells` choose feature sets and settings per shell.
> - This is most useful for modular hosts, multi-tenant systems, internal platforms, and package-driven servers.

In our experience, this is the point where configuration stops being "JSON instead of code" and becomes a composition boundary.

## What problem do shell features solve?

A **shell feature** is a named module contribution that can be enabled for a shell. It can carry dependencies, options, categories, and infrastructure hints, so the host does not need to manually understand every low-level registration detail.

That becomes useful when a workflow host is no longer one setup. One shell might use SQLite for a local server. Another might use SQL Server for a tenant. A package might contribute dashboard modules. A platform server might load extensions from NuGet-style packages through [NuPlane](/blog/introducing-nuplane-nuget-packages-as-a-runtime-primitive).

This relates closely to the broader CShells model. CShells gives a .NET host named shells, web routing, and per-shell feature composition. Elsa shell features plug Elsa-specific modules into that shape ([Building Modular .NET Applications with CShells](/blog/building-modular-dotnet-applications-with-cshells), 2025; [Building Multitenant Web Apps in .NET with CShells](/blog/building-multitenant-web-apps-in-dotnet-with-cshells), 2026).

## What does the modular server wire up?

The current `Elsa.ModularServer.Web` sample wires shell infrastructure once. It adds host assemblies, a NuPlane assembly provider, configuration, path routing, authentication/authorization, and a common Elsa feature baseline ([Program.cs](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/Program.cs), 2026).

The shape is intentionally different from a single global Elsa runtime:

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
            typeof(ElsaPlatformIntegrationFeature),
            typeof(DashboardApiFeature),
            typeof(WorkflowRuntimeDashboardFeature),
            typeof(ConsoleLogsDashboardFeature),
            typeof(StructuredLogsDashboardFeature),
            typeof(WorkflowsApiFeature));
    }));
```

That code sets the host-wide shell environment. The per-shell feature list and feature settings then come from configuration.

## What does configuration look like?

The sample `appsettings.Example.json` uses `CShells:Shells` as an array of shell objects. The default shell enables a small workflow server with SQLite persistence ([appsettings.Example.json](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/apps/Elsa.ModularServer.Web/appsettings.Example.json), 2026):

```json
{
  "Name": "Default",
  "Description": "Uses unified persistence configuration - all persistence features share the same settings",
  "Properties": {
    "WebRouting": {
      "Path": ""
    }
  },
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

A second shell can route under `tenant1`, use a different API prefix, and select SQL Server persistence:

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

The interesting part is not the JSON syntax. It is that the host can apply different composition choices per shell without turning startup into a long chain of `if tenant then register this` logic.

## What do feature classes describe?

Feature classes now carry more of the module contract. `HttpFeature`, for example, declares two manifest categories, display metadata, dependencies on `HttpJavaScriptFeature` and `ResilienceFeature`, and HTTP-specific options ([HttpFeature.cs](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Http/ShellFeatures/HttpFeature.cs), 2026).

```csharp
[ManifestFeatureCategory("HTTP")]
[ManifestFeatureCategory("Workflows")]
[ShellFeature(
    DisplayName = "HTTP",
    Description = "Provides HTTP-related activities and services for workflow execution",
    DependsOn = [typeof(HttpJavaScriptFeature), typeof(ResilienceFeature)])]
public class HttpFeature : IMiddlewareShellFeature
{
    public HttpActivityOptions HttpActivityOptions { get; set; } = new();
}
```

The SQLite workflow persistence feature shows a different kind of value. It combines definition, instance, and runtime persistence into one feature and declares that it needs SQLite-style infrastructure ([SqliteWorkflowPersistenceShellFeature.cs](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Persistence.EFCore.Sqlite/ShellFeatures/SqliteWorkflowPersistenceShellFeature.cs), 2026).

```csharp
[ManifestFeatureCategory("Persistence")]
[ManifestFeatureCategory("Workflows")]
[ShellFeature(
    DisplayName = "Sqlite Workflow Persistence",
    Description = "Provides Sqlite persistence for workflow definitions, instances, and runtime data with unified configuration",
    DependsOn = [
        typeof(SqliteWorkflowDefinitionPersistenceShellFeature),
        typeof(SqliteWorkflowInstancePersistenceShellFeature),
        typeof(SqliteWorkflowRuntimePersistenceShellFeature)])]
[ManifestInfrastructure("sqlite-database", "database",
    Reason = "Stores workflow definitions, instances, and runtime data in SQLite.",
    Providers = new[] { "SQLite" },
    ConfigurationKeys = new[] { "ConnectionString" })]
public class SqliteWorkflowPersistenceShellFeature : CombinedPersistenceShellFeatureBase
{
}
```

That lets a feature say: I am persistence, I depend on these lower-level pieces, and my important infrastructure setting is a connection string.

## Why are manifest hints useful?

Recent follow-up work added package manifest and runtime-kind hints:

- [Add `PackageManifestHints.cs` to solution and compile include in build props](https://github.com/elsa-workflows/elsa-core/commit/2f668738113f3518dab2b565fcbe0b16420f010b)
- [Add platform manifest runtime kind hints](https://github.com/elsa-workflows/elsa-extensions/commit/d407e9621770a55427ac6c2315bd779da08d5fea)
- [Add shell feature manifest categories](https://github.com/elsa-workflows/elsa-core/commit/4c104635ac64f082bb468ed44e51f7f6d5f4e45f)

I would not sell those commits as a flashy end-user feature. They are better understood as catalog infrastructure. Packages and shell features are getting better at describing what they are, where they belong, and what infrastructure they expect.

That is the kind of foundation a package-driven host needs. If a server can load modules dynamically, it also needs enough metadata to explain those modules to humans and tooling.

## When should you use this model?

Use shell features when composition varies by shell, tenant, package, environment, or product edition. They are a strong fit for internal platforms, white-label products, multi-tenant workflow servers, and modular Elsa hosts that load packages over time.

Keep explicit startup code when the host is simple. One application, one persistence option, one authentication model, and no meaningful modularity pressure do not require a configuration-driven shell system.

The useful shift is optionality. Elsa can still be wired directly. But when `Program.cs` starts absorbing every product and environment decision, shell features give those decisions a cleaner place to live.
