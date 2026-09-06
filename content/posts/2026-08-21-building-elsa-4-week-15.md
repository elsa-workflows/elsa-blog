---
title: "Building Elsa 4 · Week 15: Less Framework, Explicit Lifetimes"
slug: "building-elsa-4-week-15"
description: "Week 15 moves first-party REST APIs to Minimal APIs while preserving public contracts, centralizing permissions, and separating stable DTOs from unloadable code."
publishedAt: "2026-08-21"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
featuredImage: "../assets/2026-08-21-building-elsa-4-week-15/featured.png"
featuredImageAlt: "A granite contract arch spans removable endpoint components linked through one central permission manifold."
seoTitle: "Building Elsa 4 Week 15: Explicit API Lifetimes"
seoDescription: "Follow Elsa 4's Minimal API migration, Foundation Identity permissions, OpenAPI lifetime boundaries, and the compatibility guarantees preserved during retirement."
excerpt: "Retiring an endpoint framework is only useful if the public contracts, permission rules, and module lifecycle remain understandable afterward."
---

# Building Elsa 4 · Week 15: Less Framework, Explicit Lifetimes

## A migration with a defined finish line

In August 2026, Foundation's [REST consolidation completion report](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/reports/first-party-rest-api-consolidation-completion-2026-08.md) records a move from 164 first-party FastEndpoints registrations across 18 owner assemblies to zero. The important qualifier is **first-party**. The same report deliberately retains a host compatibility seam for third-party FastEndpoints features.

Week 15 covers **August 14 through August 20**, the window `[2026-08-14, 2026-08-21)`. The migration is more interesting than replacing endpoint syntax. It makes three responsibilities explicit: which module maps a route, who evaluates permission requirements, and which metadata can outlive a replaceable implementation.

> **Key Takeaways**
> - The completion report records zero remaining first-party FastEndpoints registrations.
> - Modules map ordinary ASP.NET Core endpoints explicitly.
> - Foundation Identity owns permission semantics.
> - Stable API contracts and replaceable implementations have different lifetimes.
> - Third-party compatibility and guards for surviving behavior were retained deliberately.

## What replaces endpoint discovery?

An explicit module mapper accepts `IEndpointRouteBuilder`. [ADR 0068](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/adr/0068-first-party-rest-apis-use-aspnet-core-minimal-apis.md), accepted August 15, makes ASP.NET Core Minimal APIs the first-party authoring model. Module composition calls the mapper; process-global assembly discovery is not the target contract.

The [Studio Preferences mapper](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/src/Elsa/Studio/Preferences/Api/StudioPreferencesApi.cs) provides a small concrete example. It maps GET and PUT routes, attaches owner and authoring-model metadata, and declares read or write permission requirements. The mechanism remains recognizable ASP.NET Core rather than an Elsa-only endpoint builder.

The ADR also limits the shared layer. It may provide necessary metadata and conventions, but it must not reconstruct the retired framework with new request bases, handler bases, discovery, or a parallel endpoint language. A little module-local repetition is preferable to an abstraction whose main contribution is renaming framework primitives.

This isn't permission to redesign the public API. The decision keeps existing HTTP/JSON contracts in force unless a separately approved change replaces them. Framework migration and client migration are different projects.

## Who owns permission semantics?

Foundation Identity owns permission evaluation; endpoints declare requirements. [ADR 0068's security contract](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/adr/0068-first-party-rest-apis-use-aspnet-core-minimal-apis.md) keeps implication, normalized claims, wildcard compatibility, replaceable evaluators, and resource handling out of individual route mappers. Moving to Minimal APIs must not create another permission implementation.

The metadata distinguishes permission-protected, intentionally public, host-credential-protected, and host-policy-protected endpoints. Those are not interchangeable labels. Public endpoints need an explicit reason or category. A host-management credential is not a user permission. Dynamic workflow routes can carry an established host-policy model without turning that into an escape hatch for ordinary module permissions.

That preserves the distinction behind [Week 9's server-side Studio management bridge](/blog/building-elsa-4-week-9). Endpoint consolidation does not move the management key into the browser or collapse server trust into user authorization. Ownership metadata makes the boundary inspectable while the existing authentication mechanism remains responsible for enforcement.

## Why can OpenAPI keep a module alive?

OpenAPI metadata can retain types from a collectible module after its endpoints are removed. The [unload-safe OpenAPI report](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/reports/unload-safe-openapi-boundary-2026-08.md) documents a framework-only reproduction with the installed .NET and OpenAPI versions. Real API description and document generation, not routing alone, exposed the lifetime problem.

The chosen boundary gives public request and response contracts a stable `*.Api.Core` lifetime. Mappers, handlers, binders, provider adapters, and runtime serialization remain in the replaceable implementation. A final endpoint convention rejects API Explorer-facing metadata that retains collectible artifacts before those endpoints become visible.

<!-- [UNIQUE INSIGHT] -->

This makes metadata part of the architecture, not passive documentation. A request DTO named in an OpenAPI description has a different lifetime obligation from the handler that processes it. Keeping both in one replaceable assembly would ignore the framework's retained references.

[ADR 0069](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/adr/0069-openapi-contract-types-use-stable-api-core.md) remains marked `proposed` in this snapshot, while the report records delivered work in [elsa-workflows/elsa-foundation#1394](https://github.com/elsa-workflows/elsa-foundation/pull/1394). It also states the tradeoff: stable public contract changes require normal versioning and a host restart. Only the implementation is hot-replaceable.

The report identifies another composition requirement: dynamic hosts connect endpoint-source change notifications to API Explorer's standard invalidation seam through `AddDynamicEndpointApiExplorerRefresh()`. Native document generation remains authoritative. The solution doesn't introduce a private Elsa OpenAPI cache or rely on mutating framework internals.

## What deliberately survived retirement?

The third-party host seam and several kinds of evidence survived. The [completion report](https://github.com/elsa-workflows/elsa-foundation/blob/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45/docs/reports/first-party-rest-api-consolidation-completion-2026-08.md) retains `CShells.FastEndpoints` in Foundation Host, authoring metadata, the empty-first-party-surface guard, and compatibility baselines. Removing a first-party authoring model is not the same as withdrawing every capability a plugin might use.

Authorization tests needed particular care. Some test-only endpoints inherited from the infrastructure being removed. Deleting them by name would also delete checks for permission behavior that must continue to exist. Reimplementing the old permission composition only inside tests would be little better: those tests could pass while exercising a copy of the rule.

<!-- [UNIQUE INSIGHT] -->

The recorded solution moves the surviving permission helper to the appropriate shared identity boundary and re-anchors the tests there. That is the difference between removing dead infrastructure and removing inconvenient evidence. The report names what was examined and retained so a future cleanup doesn't have to rediscover the reason.

The final retirement landed in [elsa-workflows/elsa-foundation#1405](https://github.com/elsa-workflows/elsa-foundation/pull/1405). Its [commit](https://github.com/elsa-workflows/elsa-foundation/commit/d3fb25f4dc3d4e6657bab0e36afe20b175a79c45) and completion report are better anchors than a broad assertion that every mention of FastEndpoints disappeared. Historical specifications and third-party compatibility are supposed to remain.

## Make subtraction reviewable

Week 15's result is a smaller first-party framework surface with more explicit ownership. Module mapping is visible. Permission semantics have one owner. API contracts and implementations no longer pretend to have identical lifetimes. The public record also identifies the compatibility boundary that wasn't removed.

For contributors, those are concrete review points: follow a mapper, inspect its security metadata, and trace the lifetime of each documented contract type. Building Elsa 4 in the open means showing not just what was deleted, but which guarantees survived and why the remaining code still belongs.
