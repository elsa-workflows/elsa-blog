---
title: "Elsa 3.8 Is Stable: A Practical Upgrade Guide"
slug: "elsa-3-8-stable-upgrade-guide"
description: "Elsa 3.8.4 aligns Core, Studio, and Extensions. Avoid broken 3.8.1 and 3.8.3 package combinations, then follow this practical production upgrade checklist."
publishedAt: "2026-09-07"
updatedAt: "2026-09-21"
status: "published"
authors:
  - "sipke"
category: "Release"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "release"
  - "upgrade"
  - "elsa-studio"
  - "security"
featuredImage: "../assets/2026-09-07-elsa-3-8-stable-upgrade-guide/featured.png"
featuredImageAlt: "Soft 3D illustration of aligned Elsa runtime, Studio, and extension layers with workflow, diagnostics, and security symbols"
seoTitle: "Elsa 3.8 Is Stable: A Practical Upgrade Guide"
seoDescription: "Elsa 3.8.4 aligns Core, Studio, and Extensions. Avoid broken 3.8.1 and 3.8.3 package combinations, then follow this practical production upgrade checklist."
redirectFrom: []
related:
  - "elsa-3-8-preview-1"
  - "elsa-3-8-state-machine-runtime-studio"
  - "managing-elsa-users-and-roles-in-studio-3-8"
  - "secret-references-in-elsa-3-8"
---

# Elsa 3.8 Is Stable: A Practical Upgrade Guide

Elsa 3.8.4 is now the current aligned patch across Core, Studio, and Extensions. Elsa 3.8.0 established the stable package line; the later patches fixed two package-integrity failures that a normal source review could easily miss. The first could stop MongoDB and Dapper hosts during startup. The second could break a clean Studio restore.

The short version is simple. Align every Elsa package on 3.8.4, avoid Studio 3.8.3, treat the new modules as opt-in, review the hardened identity and scripting defaults, and rehearse persistence changes before touching a production database.

> **Key Takeaways**
> - Use the aligned 3.8.4 package train for Core, Studio, and Extensions.
> - Avoid Studio 3.8.3: its published package points to an unavailable `Elsa.Api.Client` preview.
> - Avoid Extensions 3.8.1 with MongoDB or Dapper: those published binaries can fail during `AddElsa()` with `TypeLoadException`.
> - The release centers on operations, diagnostics, secrets, authentication, and richer Sequence and StateMachine authoring.
> - New security defaults and provider migrations deserve explicit rollout checks, not a blind package bump.

## Which Elsa 3.8 patch should you use?

Use 3.8.4 across the package graph. The 3.8.2 train corrected stale MongoDB and Dapper artifacts from Extensions 3.8.1. The 3.8.4 train then repaired Studio 3.8.3's dependency on an unpublished `Elsa.Api.Client` preview. NuGet packages are immutable, so neither affected version can be repaired in place.

| Package train | What happened | Recommendation | Evidence |
| --- | --- | --- | --- |
| 3.8.0 | First stable 3.8 release | Upgrade past it when practical | Original release table below |
| 3.8.1 | Extensions shipped stale MongoDB and Dapper binaries that did not implement Core's three-parameter `TryMarkInterruptedAsync` contract | Do not pair Extensions 3.8.1 MongoDB or Dapper packages with Core 3.8.1 or later | [Extensions issue #205](https://github.com/elsa-workflows/elsa-extensions/issues/205), resolved 2026-09-15 |
| 3.8.2 | Republished the corrected provider assemblies and aligned the package train | Valid fix for the 3.8.1 provider failure | [Extensions 3.8.2 release](https://github.com/elsa-workflows/elsa-extensions/releases/tag/3.8.2), published 2026-09-15 |
| Studio 3.8.3 | `Elsa.Studio.Core` referenced unavailable `Elsa.Api.Client` version `3.8.0-preview.5565` | Do not use for a new restore | [Studio issue #1052](https://github.com/elsa-workflows/elsa-studio/issues/1052), resolved 2026-09-20 |
| 3.8.4 | Studio points to published stable API client packages; Core and Extensions provide an aligned version set | Preferred 3.8 patch for new upgrades | [Core](https://github.com/elsa-workflows/elsa-core/releases/tag/3.8.4), [Studio](https://github.com/elsa-workflows/elsa-studio/releases/tag/3.8.4), and [Extensions](https://github.com/elsa-workflows/elsa-extensions/releases/tag/3.8.4) releases, published 2026-09-20 |

These were package-integrity failures, not broad changes to Elsa's runtime behavior. Core 3.8.4 contains no product-behavior changes over 3.8.2, and Extensions 3.8.4 is also an alignment release over 3.8.2. That is exactly why checking only source diffs is insufficient. Test the packages that NuGet actually serves.

## What shipped in Elsa 3.8?

Three coordinated repositories define the stable line. Core supplies the runtime and APIs, Studio supplies the operator and authoring experiences, and Extensions aligns its packages with both. The `Elsa` 3.8.4 meta-package is [available on NuGet](https://www.nuget.org/packages/Elsa/3.8.4).

| Release | Published | What to inspect first | Evidence |
| --- | --- | --- | --- |
| Elsa Core 3.8.0 | September 5, 2026 | Runtime operations, security defaults, diagnostics, secrets, StateMachine | [Core 3.8.0 release notes](https://github.com/elsa-workflows/elsa-core/releases/tag/3.8.0), retrieved 2026-09-07 |
| Elsa Studio 3.8.0 | September 5, 2026 | Dashboard, diagnostics, workflow designers, authentication, administration | [Studio 3.8.0 release notes](https://github.com/elsa-workflows/elsa-studio/releases/tag/3.8.0), retrieved 2026-09-07 |
| Elsa Extensions 3.8.0 | September 5, 2026 | Stable package alignment, package discovery, Webhooks source-reference changes | [Extensions 3.8.0 release notes](https://github.com/elsa-workflows/elsa-extensions/releases/tag/3.8.0), retrieved 2026-09-07 |

The table records the original 3.8.0 baseline. For a current deployment, take that feature set through the aligned 3.8.4 patch train.

The important word is *aligned*. A Studio upgrade changes which backend contracts the UI expects. An Identity upgrade changes which persistence implementations it can load. An Extensions upgrade can change where a module comes from. Treat the three repositories as one compatibility set even if your application consumes only part of that set.

## Why is Elsa 3.8 an operations release?

Elsa 3.8 makes more runtime state visible and more operator actions explicit. Structured logs, console logs, and OpenTelemetry remain separate diagnostic models. Secrets become named references instead of ordinary workflow data. Alterations become staged plans. Runtime drain, recovery, readiness checks, dispatch outbox behavior, and bookmark dead letters make clustered hosts easier to reason about.

Those boundaries are intentional. A structured `ILogger` event is not a console line. A recent OTLP trace is not a long-term telemetry backend. An alteration is not a substitute for migration planning. The existing guides explain the individual surfaces in more depth:

- [Structured Logs in Elsa 3.8](/blog/structured-logs-in-elsa-3-8)
- [Console Logs in Elsa 3.8](/blog/console-logs-in-elsa-3-8)
- [OpenTelemetry Diagnostics in Elsa 3.8](/blog/opentelemetry-diagnostics-in-elsa-3-8)
- [Secret References in Elsa 3.8](/blog/secret-references-in-elsa-3-8)
- [Workflow Alterations in Elsa 3.8](/blog/workflow-alterations-in-elsa-3-8)

Studio follows the same operational model. Its home page is now a composable dashboard, while diagnostics, Secrets, Alterations, Webhooks, and Weaver remain independently registered experiences. Remote feature checks keep unavailable backend capabilities out of the normal path.

## What changed for workflow authors?

Studio 3.8 adds dedicated Sequence and StateMachine authoring instead of forcing every workflow into a Flowchart-shaped experience. Root activity selection, better activity picking, safer JSON editing, and visible validation errors make the designer more useful for workflows that do not fit one canvas model.

StateMachine has the most important persistence caveat. Elsa stores transition continuation identity in declaration order, so reordering transitions can change the meaning of suspended state. The [StateMachine runtime and Studio guide](/blog/elsa-3-8-state-machine-runtime-studio) explains the seven-step transition lifecycle, competing triggers, automatic cycles, and the checks to run before changing live definitions.

Sequence authoring also moves into its own designer with explicit sequence mode, layout controls, and reordering actions. In both designers, activity identity matters. A convenient visual edit can still be a runtime compatibility change when instances are already suspended.

## What should you check before upgrading?

Start with package alignment, then review host behavior. A recent [Elsa issue about mixed Identity and EF Core versions](https://github.com/elsa-workflows/elsa-core/issues/8015) reproduced a `TypeLoadException` on every startup even though restore and compilation succeeded. The fix was to use the renamed `Elsa.Persistence.EFCore*` packages and align every Elsa dependency to one version.

1. **Align Core, Studio, API client, persistence, and Extensions packages on 3.8.4.** Inspect central package management files and transitive dependencies. Do not leave an old `Elsa.EntityFrameworkCore*` reference behind, and make sure no Studio 3.8.3 or Extensions 3.8.1 package survives transitively.
2. **Configure production identity bootstrap and secrets before startup.** The reference server no longer provides production-usable admin credentials or API keys. Seed initial administrative access through `DefaultAdminUser` or `UseDefaultAdmin(...)`, and configure initial applications or API keys through environment-specific configuration or a secret manager. Configure a JWT signing key with at least 32 printable ASCII characters and no surrounding whitespace.
3. **Choose your bootstrap path deliberately.** Localhost no longer receives security-root permissions by default. Enable the development-only localhost grant explicitly or configure an authenticated administrator.
4. **Treat C# and Python execution as privileged host-code execution.** Both require their `AllowHostCodeExecution` option and the matching execution permission. They are not sandboxes.
5. **Plan provider migrations for modules you add.** Secrets and external authentication add persistence packages and provider-specific migrations. Include only the migrations for modules you actually enable.
6. **Select one Studio authentication composition.** Elsa Identity, direct OpenID Connect, and brokered External Authentication are distinct choices. Do not register overlapping login stacks. The [Studio external-authentication migration guide](https://github.com/elsa-workflows/elsa-studio/blob/3.8.4/docs/migrations/external-authentication.md) documents the Server and WebAssembly trust models.
7. **Review .NET 10 endpoint integrations.** The .NET 10 package set uses FastEndpoints 8.2.0. `ResumeRequest` is obsolete, the resume endpoint uses `FastEndpoints.EmptyRequest`, and custom `ElsaEndpoint` wrappers may need attention.
8. **Replace Webhooks project references.** HTTP Webhooks moved out of Extensions. Applications that referenced those projects by path should consume the corresponding Core and Studio packages.

The recurring failure pattern is version drift hidden by an incomplete gate. A build cannot prove that a clean machine will resolve every declared package, and a successful compile cannot prove that every runtime type came from a compatible Elsa generation. Restore from a clean CI environment, start the real host, and exercise each enabled persistence provider.

## How should teams roll out Elsa 3.8?

A safe rollout separates dependency resolution, schema movement, host startup, and workflow compatibility. That gives each failure one likely cause instead of changing packages, databases, security configuration, and workflow definitions in the same deployment.

1. **Inventory the resolved graph.** Record every `Elsa.*` package, version, and provider package in each deployable host.
2. **Create an aligned 3.8.4 build.** Update Core-facing packages before Studio and Extensions consumers, then restore from a clean package graph. Confirm the resolved graph contains neither Studio 3.8.3 nor Extensions 3.8.1.
3. **Rehearse migrations on a production-shaped copy.** Include the modules and providers you will actually deploy. Verify upgrade and rollback procedures before promotion.
4. **Start the host with production-like security settings.** Exercise authentication, permissions, secrets, diagnostics, and background work. A development bootstrap can hide missing production identity configuration.
5. **Test persisted workflows across the boundary.** Resume representative suspended instances, especially workflows with StateMachine transitions, alterations, custom serializers, or long-running bookmarks. [Suspended workflows are runtime state, not just definitions](/blog/suspended-workflows-and-elsa-upgrades).
6. **Enable new modules one at a time.** Diagnostics, Secrets, Dashboard, Webhooks, and Weaver require explicit registration. Add each module because you need it, not because it appears in the release notes.

Do not combine this release upgrade with unrelated workflow redesign unless the same rehearsal must prove both. Smaller change sets make rollback and diagnosis far easier.

## What changed since Preview 1?

[Elsa 3.8 Preview 1](/blog/elsa-3-8-preview-1) introduced the operational direction: structured logs, console logs, OpenTelemetry diagnostics, secrets, and alterations. The stable release keeps those boundaries and adds the later work needed to operate and author them as one product line.

The largest visible additions are the operational dashboard, dedicated Sequence and StateMachine designers, root activity selection, external authentication management, login themes, user and role administration, and broader runtime controls. The stable release is therefore not just Preview 1 with a new version label. It closes the package line around several months of Core and Studio integration work.

For existing users, the upgrade notes matter more than the feature count. New modules remain opt-in, security defaults fail more safely, and Studio expects the matching 3.8.4 API client and backend capabilities.

## Frequently asked questions

### Which Elsa 3.8 version should I install?

Use 3.8.4 for Core, Studio, and Extensions. Version 3.8.2 corrected the MongoDB and Dapper provider artifacts from Extensions 3.8.1, while 3.8.4 corrected Studio 3.8.3's dependency on an unavailable preview package. Keep Elsa package references aligned unless a specific integration documents another supported combination.

### Can I enable every new module by upgrading packages?

No. Structured Logs, Console Logs, OpenTelemetry diagnostics, Secrets, Dashboard, Webhooks, Weaver, and related Studio experiences use explicit registration and feature discovery. Install and configure the modules you need, map their routes or hubs where required, and apply their persistence migrations deliberately.

### Should I upgrade workflow definitions at the same time?

Not automatically. First prove that existing definitions and suspended instances resume under 3.8.4. Then make authoring changes in a separate rollout. Transition order, activity identity, serializer configuration, and long-running bookmarks can all carry persisted meaning beyond the JSON shape you see in Studio.

## The practical takeaway

Elsa 3.8 is a substantial stable release for teams that operate workflows, not only teams that design them. The new diagnostics, security, administration, and authoring surfaces are useful because they keep different concerns separate.

Keep that separation during the upgrade. Align the package graph on 3.8.4, restore it in a clean environment, rehearse migrations, prove production security configuration, start the actual host, and resume representative workflow state. Once those gates pass, enable the new modules that solve a real operational problem for your team.
