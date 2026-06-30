---
title: "Introducing Nuplane: NuGet Packages as a Runtime Primitive"
slug: "introducing-nuplane-nuget-packages-as-a-runtime-primitive"
description: "Nuplane lets .NET hosts install, update, reconcile, and optionally load NuGet packages at runtime without turning plugin infrastructure into app code."
publishedAt: "2026-04-19"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "dotnet"
  - "workflow"
  - "nuplane"
  - "nuget"
  - "plugins"
featuredImage: "https://cdn-images-1.medium.com/max/1200/1*G0FKt3R3fyuYfxEoHshuHQ.jpeg"
featuredImageAlt: "Introducing Nuplane: NuGet Packages as a Runtime Primitive"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/introducing-nuplane-nuget-packages-as-a-runtime-primitive-d1b168b9cd5a"
seoTitle: "Introducing Nuplane: NuGet Packages as a Runtime Primitive"
seoDescription: "Use Nuplane to reconcile NuGet packages at runtime, load assemblies safely, and keep plugin activation logic inside your .NET host."
redirectFrom: []
---

Most .NET applications treat NuGet packages as a build-time concern. You add a package reference, restore, compile, deploy, and restart when the package changes.

That is the right model for most applications. But some hosts need a different shape. Plugin systems, workflow engines, tenant extension platforms, and internal tool hosts often need to pick up new capabilities while the process is running.

**Nuplane** is a runtime control plane for NuGet packages. It can resolve packages, install them into a deterministic local store, track active versions, emit change events, and optionally load package assemblies into isolated contexts. Your host still decides what the package means.

![Nuplane package control plane illustration](https://cdn-images-1.medium.com/max/1200/1*G0FKt3R3fyuYfxEoHshuHQ.jpeg)

> **Key Takeaways**
> - **Nuplane** turns NuGet packages into runtime-managed inputs for a .NET host.
> - It separates package reconciliation from host semantics: Nuplane manages packages, while your app decides activation.
> - The current configuration model prefers keyed `Nuplane:Setup:Feeds` entries and explicit include filters such as `"IncludePatterns": ["*"]`.

The repository is available at [github.com/valence-works/nuplane](https://github.com/valence-works/nuplane), and its README describes Nuplane as infrastructure for feed resolution, deterministic storage, transactional updates, last-known-good fallback, optional assembly loading, and structured change events.

## What Problem Does Nuplane Solve?

The Nuplane README frames the core use case clearly: a .NET host can install, update, and load NuGet packages while it is running ([Nuplane README](https://github.com/valence-works/nuplane)). That matters when package delivery is part of the product, not just part of the build pipeline.

Without a package control plane, teams usually end up rebuilding the same infrastructure:

- Watch a folder for `.nupkg` files.
- Download packages from one or more feeds.
- Extract packages into a local store.
- Track which version is active.
- Load assemblies into `AssemblyLoadContext`.
- Handle type identity across shared contracts.
- Roll back or preserve the old version when a new package fails.
- Tell the host that something changed.

In our experience, the first prototype is often easy. The operational parts are what accumulate: state files, cleanup, retries, logging, metrics, health, trust policy, and restart behavior. Nuplane exists to keep that infrastructure out of host-specific application code.

This is useful for plugin systems, but it is not limited to plugins. It also fits workflow and rule engines, per-tenant extension points, modular feature delivery, and internal platforms where capabilities are packaged independently. That connects naturally to [building modular .NET applications with CShells](/blog/building-modular-dotnet-applications-with-cshells) and [building multitenant web apps with CShells](/blog/building-multitenant-web-apps-in-dotnet-with-cshells): packages can become the delivery unit for runtime capabilities.

## What Does Nuplane Actually Do?

Nuplane implements a reconciliation loop. It reads desired package state from configured sources, compares that to current state, applies package transactions, and emits observer events. The README calls this desired state versus actual state model the core concept of the system.

The loop looks like this:

1. Read desired packages from directory feeds, NuGet feeds, or other providers.
2. Compare them with active package state in the local store.
3. Resolve versions and compute add, update, and remove operations.
4. Apply transactional package changes.
5. Persist state.
6. Optionally load assemblies.
7. Notify host-owned observers.

That last phrase is important: host-owned observers. Nuplane does not define your plugin model. It does not mutate your app's dependency injection container. It does not decide which type is a workflow activity, a feature module, or a plugin. It gives your host a reliable package and loading substrate.

The current `AddNuplane` extension registers validators, options, and runtime services, then lets the builder add feeds, loading, and observers. Optional modules stay optional. Tests verify that core `AddNuplane` does not register loading services unless the loading module is added.

## How Does The Drop-Folder Workflow Work?

The ASP.NET Core sample wires a local directory feed, optional loading, observers, admin endpoints, and catalog endpoints. Its `appsettings.json` uses a keyed `Feeds` object under `Nuplane:Setup`, with `local-packages` pointing at the `packages` folder.

The host setup is small:

```csharp
using Nuplane;
using Nuplane.Admin;
using Nuplane.Admin.Api;
using Nuplane.Loading.Api;
using Nuplane.Loading.Hosting.Builder;
using Nuplane.Sources.Directory.Configuration;

var builder = WebApplication.CreateBuilder(args);
var nuplaneConfiguration = builder.Configuration.GetSection("Nuplane");

builder.Services.AddNuplane(nuplaneConfiguration, nuplane =>
{
    nuplane.AddDirectoryFeedsFromConfiguration(nuplaneConfiguration);
    nuplane.AutoloadPackages(nuplaneConfiguration.GetSection("Loading"));
    nuplane.OnPackagesChanged<PackageChangeObserver>();
    nuplane.OnPackagesChanged<PluginDiscoveryObserver>();
});

builder.Services.AddNuplaneAdmin();

var app = builder.Build();

app.MapNuplaneAdmin();
app.MapNuplaneLoadState();

app.Run();
```

The configuration declares the folder feed, watcher behavior, loading, and shared contract assemblies:

```json
{
  "Nuplane": {
    "Setup": {
      "AutomaticReconciliation": true,
      "PollInterval": "00:01:00",
      "Feeds": {
        "local-packages": {
          "DirectoryPath": "packages",
          "IncludePatterns": [
            "*"
          ],
          "Directory": {
            "Watch": true,
            "DebounceWindow": "00:00:01"
          }
        }
      }
    },
    "Loading": {
      "Enabled": true,
      "SharedAssemblies": [
        {
          "Name": "Nuplane.Abstractions",
          "PublicKeyToken": "31bf3856ad364e35",
          "MajorVersion": 1
        }
      ]
    }
  }
}
```

`AddDirectoryFeedsFromConfiguration` reads feed declarations, registers directory feeds with watch and debounce settings, and applies either `IncludeAll` or non-empty `IncludePatterns`. Nuplane now recommends the keyed feed object shape because layered .NET configuration can override `Feeds:feed-name` by identity instead of merging arrays by index.

Then the workflow is just package movement:

```bash
dotnet pack samples/Nuplane.Sample.Plugin/Nuplane.Sample.Plugin.csproj -c Debug
mkdir -p packages
cp samples/Nuplane.Sample.Plugin/bin/Debug/Nuplane.Sample.Plugin.1.0.0.nupkg packages/
```

When the watcher sees the file, reconciliation runs. The sample exposes package inventory, load state, assemblies, plugins, and admin views through endpoints such as `/catalog/packages`, `/catalog/load-state`, `/catalog/assemblies`, `/catalog/plugins`, and `/nuplane/admin/packages`.

## How Should A Host React To Package Changes?

Nuplane observers are callbacks, not the source of truth. The current `INuplaneObserver` contract includes `OnPackagesChangingAsync`, `OnPackagesChangedAsync`, `OnPackageFailedAsync`, and a default `OnPackagesReconciledAsync` method that receives the active packages for a cycle.

A typical observer logs and invalidates host-owned caches:

```csharp
internal sealed class PackageChangeObserver(ILogger<PackageChangeObserver> logger)
    : INuplaneObserver
{
    public Task OnPackagesChangingAsync(PackageChangeSet changeSet, CancellationToken ct)
    {
        logger.LogInformation(
            "Packages changing. Added={Added}, Updated={Updated}",
            changeSet.Added.Count,
            changeSet.Updated.Count);

        return Task.CompletedTask;
    }

    public Task OnPackagesChangedAsync(PackageChangeSet changeSet, CancellationToken ct)
    {
        logger.LogInformation(
            "Packages changed. Added={Added}, Updated={Updated}, Removed={Removed}",
            changeSet.Added.Count,
            changeSet.Updated.Count,
            changeSet.Removed.Count);

        return Task.CompletedTask;
    }

    public Task OnPackageFailedAsync(string packageId, Exception exception, CancellationToken ct)
    {
        logger.LogWarning(exception, "Package operation failed for {PackageId}", packageId);
        return Task.CompletedTask;
    }
}
```

After that, query the catalog. Do not replay observer events into your own package state machine unless you have a very specific reason. The Nuplane README says the same thing: observers are supplemental invalidation and logging signals, while catalog services are authoritative reads.

## Which Catalogs Should You Query?

Nuplane separates core package state from optional loading state. That separation keeps hosts honest: inventory, load status, loaded assemblies, and assignable types are related, but they are not the same question.

The loading abstractions expose two useful surfaces:

```csharp
public interface IPackageAssemblyCatalog
{
    Task<IReadOnlyList<PackageAssemblies>> GetPackagedAssembliesAsync(
        CancellationToken cancellationToken);

    Task<PackageAssemblies?> GetPackagedAssembliesAsync(
        string packageId,
        CancellationToken cancellationToken);
}

public interface IPackageTypeFinder
{
    Task<IReadOnlyList<Type>> FindTypesAsync<TInterface>(
        string packageId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Type>> FindTypesAsync(
        Type interfaceType,
        string packageId,
        CancellationToken cancellationToken);
}
```

The sample wraps those surfaces in a host-owned `PluginCatalog`. It reads all active packaged assemblies, filters packages with assembly references, then asks `IPackageTypeFinder` for assignable `IPlugin` implementations. That is the right layering: Nuplane finds loaded assemblies and types, while your application decides what a plugin is.

The same idea works for workflow engines. A host could scan packages for activity types, validators, expression functions, or rule providers, then publish those capabilities into the application catalog. That is directly relevant to runtime extension work in Elsa, including [Elsa 3.8 preview features](/blog/elsa-3-8-preview-1) and [workflow alterations in Elsa 3.8](/blog/workflow-alterations-in-elsa-3-8), where runtime behavior needs to remain observable and controllable.

## What Makes The Store Safe To Operate?

Nuplane's store is designed around deterministic state and last-known-good behavior. The README describes the layout as `state.json`, `packages/{id}/{version}`, `current/{id}`, and `staging`, with updates moving through staging, validation, immutable storage, active pointer switch, and state persistence.

The source tests cover the failure path. For example, a transaction that fails during validation preserves the previous active pointer, records the failure, and reports that last-known-good was preserved. Similar tests cover stage, publish, atomic switch, hash mismatch, trust policy, lock policy, and state persistence failures.

That matters because runtime package delivery is operationally sensitive. A package host should prefer "old version stays active" over "new version half-applied." Nuplane gives the host that behavior as infrastructure, not as custom plugin code.

## What Should You Watch Out For?

Nuplane is infrastructure, not a sandbox. The README explicitly says it does not define a plugin entrypoint model, mutate your DI container, impose activation semantics, guarantee unload, or sandbox untrusted code.

The AssemblyLoadContext boundary is especially worth understanding. **AssemblyLoadContext** is the .NET mechanism for loading dependencies and creating isolation contexts ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/core/dependency-loading/understanding-assemblyloadcontext)). Microsoft also documents assembly unloadability as cooperative: collectible contexts can unload only when references have drained ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/standard/assembly/unloadability)).

So the cautions are practical:

- Do not load untrusted packages without your own trust and policy controls.
- Keep shared abstractions in shared assemblies so type identity works across contexts.
- Avoid holding long-lived references to old package types if you expect unload to succeed.
- Persist state and package storage when warm restarts matter.
- Use explicit include filters. A feed without `IncludePatterns`, `IncludeAll`, or `feed.IncludeAll()` contributes no packages.

For Kubernetes, the README recommends persisting both the package install root and the store state file. A per-replica volume, often through a `StatefulSet`, avoids the worst case where every restart re-downloads and re-extracts the same package set.

## When Should You Use Nuplane?

Use Nuplane when packages are part of runtime operation. If a package only changes when you deploy the app, normal NuGet references are simpler and better. But if packages are delivered independently, Nuplane gives that flow a control plane.

Good fits include:

- Hot-reload plugin systems.
- Modular feature packages.
- Per-tenant extension packages.
- Workflow steps, validators, and rule packages.
- Internal platform hosts that watch a shared package folder.
- Hosts that need package inventory and load-state endpoints.

The boundary is deliberate. Nuplane handles package reconciliation, storage, loading, and signals. Your host handles meaning, activation, authorization, and user experience.

## FAQ

### Does Nuplane replace NuGet restore?

No. Build-time package restore is still the right model for normal application dependencies. Nuplane handles a different scenario: packages that the running host should reconcile, install, and optionally load at runtime.

### Does Nuplane automatically activate plugins?

No. Nuplane can load assemblies and expose catalog services, but your host decides what a plugin is and how to activate it. The sample `PluginCatalog` is intentionally host-owned code layered over Nuplane's assembly and type-finder surfaces.

### Does Nuplane sandbox package code?

No. Assembly loading is not sandboxing. If packages come from users, customers, or external feeds, enforce trust, validation, allowlists, and operational policy in the host and deployment environment.

## Closing Thoughts

NuGet packages are already the .NET ecosystem's unit of distribution. Nuplane asks a simple question: what if a running host could treat that unit as runtime state?

That does not make every app a plugin host. It gives plugin hosts, workflow engines, tenant platforms, and internal tools a package control plane they do not have to keep rebuilding. The result is a cleaner split: Nuplane manages runtime packages, and the application decides what those packages mean.
