---
title: "Building Elsa 4 · Week 16: Changing the Decision, Keeping the Contract"
slug: "building-elsa-4-week-16"
description: "Week 16 revises API assembly and endpoint-authoring decisions in public, adopts NativeEndpoints, and keeps Elsa's permissions and published conventions explicit."
publishedAt: "2026-08-28"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
featuredImage: "../assets/2026-08-28-building-elsa-4-week-16/featured.png"
featuredImageAlt: "Fixed external connection ports front reorganized API assemblies and an extracted generic toolkit on a side plinth."
excerpt: "The public record includes reversals: fewer API assemblies, a newly ratified endpoint-class model, and a generic framework moved out of Elsa."
---

# Building Elsa 4 · Week 16: Changing the Decision, Keeping the Contract

## The record includes changes of mind

Week 16 revises two recent API decisions rather than quietly stretching them. [ADR 0070](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/docs/adr/0070-rest-api-contracts-ship-in-one-assembly-per-domain.md) reunites public contracts and implementation in one API assembly per domain. [ADR 0071](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/docs/adr/0071-first-party-rest-apis-use-endpoint-classes.md) permits endpoint classes under explicit lifetime and composition constraints.

The window is **August 21 through August 27, 2026**, or `[2026-08-21, 2026-08-28)`. It ends with the generic endpoint framework moving out of Elsa's source tree and into a package. The interesting part is not that every earlier choice was wrong. It's that the revised choices name what they preserve and what they give up.

> **Key Takeaways**
> - API contracts and implementations reunite; first-party module unloadability is no longer promised.
> - Feature-disable remains distinct from assembly unloading.
> - Endpoint classes are ratified through a new decision, not an implicit exception.
> - NativeEndpoints supplies the generic layer.
> - Elsa retains its permission, ownership, and published operation conventions.

## Why put contracts back in the API assembly?

The split protected a capability that the review found no production host was exercising. [ADR 0070](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/docs/adr/0070-rest-api-contracts-ship-in-one-assembly-per-domain.md) records that collectible assembly contexts were created by test fixtures, not production composition. Meanwhile, linked compilation, exclusions, project references, and type forwarders imposed a concrete maintenance cost on the API modules.

The decision also separates feature-disable from unloading an assembly. Removing a disabled feature's routes and OpenAPI operations depends on the endpoint change-token bridge. It does not require the implementation assembly to become collectible. The earlier contract split wasn't buying that behavior.

The resulting rule is one `*.Api` assembly per domain, with public CLR namespaces and JSON contracts unchanged. [elsa-workflows/elsa-foundation#1415](https://github.com/elsa-workflows/elsa-foundation/pull/1415) implements the collapse. ADR 0070 still carries `proposed` in its frontmatter at this snapshot; that documentary status remains visible alongside the merged change.

<!-- [UNIQUE INSIGHT] -->

The cost is stated plainly: first-party REST modules are no longer unloadable. A host repeatedly replacing module generations can retain contract types through API Explorer. This is not presented as a solved third-party plugin lifecycle. It trades an unused first-party guarantee for simpler structure while leaving the broader contract-publication problem unresolved.

That is a more useful record than "simplified the projects." It tells future contributors which capability they must not infer from the new layout.

## How do endpoint classes fit the Minimal API decision?

They fit because a new ADR explicitly revises the old bound. [ADR 0071](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/docs/adr/0071-first-party-rest-apis-use-endpoint-classes.md), accepted August 25, acknowledges that the endpoint-class rollout crossed wording in ADR 0068 that prohibited request bases, handler bases, and another endpoint framework. It returns that change to an explicit decision.

The accepted constraints are specific. Mapping stays module-local inside the module's composition call. There is no process-global discovery registry. Framework statics must not retain consumer types. Handlers publish as bare `RequestDelegate`, and mapping returns the standard `IEndpointConventionBuilder`. Metadata lifetime validation runs as a final, fail-closed convention.

The distinction is not "base classes are always bad" versus "base classes are now good." It is whether the shared mechanism hides ASP.NET Core behavior or retains consumer objects beyond their intended lifetime. Authorization, filters, CORS, rate limiting, and results remain on standard framework paths.

The two lifetime decisions should not be conflated. A shared library avoiding static roots does not make first-party API contract assemblies unloadable again. ADR 0070 states the contract-assembly tradeoff; ADR 0071 constrains the machinery that maps endpoint implementations. Both facts can hold without pretending they provide the same guarantee.

## What moved out, and what stayed Elsa-owned?

The generic framework moved into NativeEndpoints; Elsa's own vocabulary stayed in Elsa. [The August 27 project file](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Api/AspNetCore/Elsa.Api.AspNetCore.csproj) now references the package, while [central package configuration](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/Directory.Packages.props) pins the NativeEndpoints family to `1.0.0-preview.6`. This is an inspectable dependency change, not just a proposed extraction.

[ADR 0071's externalization section](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/docs/adr/0071-first-party-rest-apis-use-endpoint-classes.md) records the deletion of `Elsa.Api.Endpoints` and the smaller role of `Elsa.Api.AspNetCore`. The [remaining layer](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Api/AspNetCore/ElsaEndpointConventions.cs) holds Elsa's endpoint ownership, security-disposition, authoring-model, and host-credential metadata and conventions, including its operation-identifier scheme.

Other Elsa-owned integrations do not all live in that layer. [Foundation Identity owns the permission attribute and policy integration](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Foundation/Identity/Abstractions/Authorization/AuthorizationContracts.cs). The [API extension-point inventory](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Api/EXTENSION_POINTS.md) marks the earlier `Elsa.Api.Mediator` bridge as retired. The ADR's broader ownership discussion should not be read as an inventory of surviving bridges.

The package doesn't need to learn what an Elsa permission means or which dynamic shell owns a route. Those concepts are attached through convention extension points. [elsa-workflows/elsa-foundation#1454](https://github.com/elsa-workflows/elsa-foundation/pull/1454) is the package-adoption change. The [NativeEndpoints introduction](/blog/introducing-nativeendpoints) provides broader context; this week's source shows where Elsa draws its side of the boundary.

## Why not simply inherit the package defaults?

Because the existing public conventions are already a contract. The [retained Elsa operation convention](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Api/AspNetCore/ElsaEndpointConventions.cs) preserves the `{Owner}Endpoints{Operation}` naming scheme instead of adopting the package's group-and-operation default. Generated clients can depend on those identifiers even when no route URL changes.

The same code deliberately keeps the documented 401/403 response pair. The package's inferred default could remove those entries from public endpoints and change already published documents. Preserving that documentation is a compatibility choice, not an assertion that every public request requires authentication.

<!-- [UNIQUE INSIGHT] -->

Extracting a library doesn't mean surrendering every decision to its defaults. A useful shared layer exposes enough standard extension points for consumers to preserve their own contracts. The Elsa convention shows exactly which differences are intentional, rather than scattering compensating changes through individual endpoints.

The [Studio Preferences mapper](https://github.com/elsa-workflows/elsa-foundation/blob/b20eb9bd340a3988e8a411a216d02bf39bcc3193/src/Elsa/Studio/Preferences/Api/StudioPreferencesApi.cs) illustrates another boundary. Its operations use the group's raw mapping seam to retain their own preconditions, ETags, problem shapes, and exception behavior. A common convention doesn't require forcing every HTTP operation through an identical handler shape.

## Keep the supersession visible

These are real revisions, including a surrendered unloadability guarantee and newly permitted shared endpoint machinery. The ADRs identify the previous decisions, explain the changed tradeoffs, and connect them to implemented code. That is more informative than rewriting the earlier history so the final arrangement appears inevitable.

For contributors, the useful path is to follow the decision and its compatibility obligations together. Which lifecycle guarantee still exists? Which public identifiers must not move? Which concepts remain Elsa-owned after extraction? Week 16 answers those questions in public while keeping the unresolved ones visible.
