---
title: "Building Elsa 4 · Week 4: One Command, One Event Surface"
slug: "building-elsa-4-week-4"
description: "Week 4 collapses draft updates into one diff-based command while preserving typed lifecycle events, semver activity versions, and explicit extension seams."
publishedAt: "2026-06-05"
status: "draft"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
  - "workflow-engine"
featuredImage: "../assets/2026-06-05-building-elsa-4-week-4/featured.png"
featuredImageAlt: "Workflow update inputs converging into one command and fanning into events."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 4: One Command, One Event Surface"
seoDescription: "Week 4 collapses draft updates into one diff-based command while preserving typed lifecycle events, semver activity versions, and explicit extension seams."
excerpt: "The workflow-draft write path gets one diff-based update command, while the event surface stays typed and ready for future event sourcing."
---

## Where we are on the road

Week 4 applies the seam discipline from the earlier Elsa 4 work to the authoring write path. Last week pinned the activity catalog as the source of truth for picker visibility and gave `WorkflowDefinitionState` a scope policy so it would not become a god object ([activity catalog spec](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md), [state scope spec](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)). The kickoff post, "Why Elsa 4? Rebuilding a .NET Workflow Engine from the Foundation Up", framed the project as a thin protocol, not a fat platform; the repo says that directly in its philosophy section ([README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md)). This week, that philosophy reaches the workflow-draft lifecycle.

> **Key Takeaways**
> - The draft mutation surface collapses to one diff-based `IUpdateDraftCommand`, but the typed per-diff event stream stays intact.
> - Activity versions move from engine-assigned integers to author-controlled SemVer strings.
> - `EXTENSION_POINTS.md` catalogs make override and contribution seams explicit across domains.

## The headline: one command, one event surface

The main Week 4 decision is not "fewer events". It is fewer public mutation commands while preserving the event vocabulary that makes draft changes observable. The `003-single-update-command` spec says Unit C had produced 20 granular draft-mutation commands and 20 granular mutation events, plus lifecycle events ([spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)). Week 4 keeps the typed event surface, but moves the producer to one command.

The problem was the public write surface. A designer save should not force the UI to choose among 20 commands, batch them, order them, or recover from a partially applied sequence. The spec records the new shape: one command receives the complete desired draft state, loads the stored draft, computes a semantic diff, emits one event per detected difference, validates, and persists under the existing per-draft lock ([spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)).

The implementation names that command `IUpdateDraftCommand`. Its contract says callers submit an `UpdateDraftRequest`; the command runs under `workflow-draft:{DraftId}`, diffs desired state against stored state, emits per-concept mutation events, runs validation, and persists ([IUpdateDraftCommand.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/Core/Contracts/IUpdateDraftCommand.cs), [UpdateDraftRequest.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/Core/Contracts/UpdateDraftRequest.cs)). The EF Core command documents the shell in order: acquire the lock, load state and layout, assign the desired state, diff, validate, save, release the lock, then background-publish per-diff events before `OnDraftValidated` ([UpdateDraft.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/EFCore/Commands/UpdateDraft.cs)).

That ordering is the architecture. `OnDraftValidating` remains the synchronous contribution gate, while `OnDraftValidated` remains the background outcome event ([UpdateDraft.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/EFCore/Commands/UpdateDraft.cs)). The implementation commit describes the combined move as a unified event system plus a single update command ([f590e4ce](https://github.com/elsa-workflows/elsa-foundation/commit/f590e4ce2960d815003a47ca72e9fdb06abd6f70)). It builds on the earlier lifecycle-persistence commit that introduced a draft mutation pipeline handling commands consistently ([b3137551](https://github.com/elsa-workflows/elsa-foundation/commit/b313755160efc8d2064e7339de2810aaba2279fa)).

The "what it rules out" is just as important. This design rules out a partial patch API, because `UpdateDraftRequest` carries the complete desired state and layout ([UpdateDraftRequest.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/Core/Contracts/UpdateDraftRequest.cs)). It rules out a single opaque `DraftUpdated` event, because the Workflows.Design event catalog still lists per-concept events emitted by `IUpdateDraftCommand` ([Workflows.Design extension catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Api/EXTENSION_POINTS.md)). It also rules out treating create, clone, discard, and promote as ordinary content mutations; the command contract keeps those lifecycle commands distinct ([IUpdateDraftCommand.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Persistence/Core/Contracts/IUpdateDraftCommand.cs)). The constitution now pins that command surface in §E2.9.7 ([constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).


## Supporting thread: activity versions become author-owned SemVer

The second thread is activity semantic versioning. The `004-activity-semantic-versioning` spec replaces integer activity versions with author-controlled SemVer strings across the activity-definition-version model ([spec 004](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)). The load-bearing reason is exact version identity: a consuming workflow needs to pin a meaningful activity version, not an engine-assigned counter ([spec 004](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)).

The model reflects that. `ActivityDefinitionVersion.Version` is a string with a `SemVerSortKey` for precedence ordering ([ActivityDefinitionVersion.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Design/Persistence/Core/Entities/ActivityDefinitionVersion.cs)). The optional `[Version("…")]` attribute overrides the declaring assembly's version for one activity type, and the resolver falls back through attribute, `AssemblyInformationalVersion`, then major/minor/build mapped into SemVer ([VersionAttribute.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Runtime/Core/Attributes/VersionAttribute.cs), [ActivityTypeVersionResolver.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Design/Reconciliation/Clr/Services/ActivityTypeVersionResolver.cs)).


## Supporting thread: extension points are now explicit per domain

The root `EXTENSION_POINTS.md` indexes two sanctioned extension axes: override a default implementation, or extend by adding another implementation to an owner-owned contribution flow ([EXTENSION_POINTS.md](https://github.com/elsa-workflows/elsa-foundation/blob/main/EXTENSION_POINTS.md)). Commit `71e1cb75` records the repo-wide rollout ([71e1cb75](https://github.com/elsa-workflows/elsa-foundation/commit/71e1cb754562708563e88eb41b10390baf742ed5)).

This is the kickoff's "thin protocol" idea made inspectable. A [shell](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md) composes features; it should not inherit hidden behavior by accident. The root index says extension-point detail belongs in per-domain catalogs, while the root file stays an index ([EXTENSION_POINTS.md](https://github.com/elsa-workflows/elsa-foundation/blob/main/EXTENSION_POINTS.md)).

The Workflows.Design catalog makes `IUpdateDraftCommand`, lifecycle commands, and `IDraftStateDiffEngine` overridable surfaces ([Workflows.Design extension catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Api/EXTENSION_POINTS.md)). The Activities CLR catalog shows the contribution side: `ClrActivityReconciliationSource` registers `IActivityReconciliationSource`, and the reconciliation handler consumes all registered sources ([CLR reconciliation catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Design/Reconciliation/Clr/EXTENSION_POINTS.md), [ClrActivityReconciliationSource.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Design/Reconciliation/Clr/Services/ClrActivityReconciliationSource.cs)).

## Supporting thread: definition stays a visual shell

The cleanup around "definition is a visual shell" supports the same boundary story. Commit `962923ff` drops definition provenance and dissolves obsolete reconciliation tests; commit `2e40a37d` moves source details to versions ([962923ff](https://github.com/elsa-workflows/elsa-foundation/commit/962923ff544fe43e47dd353964aef5aa9a2a0f22), [2e40a37d](https://github.com/elsa-workflows/elsa-foundation/commit/2e40a37d4f026d327f0ac6114f79980a2d47accf)). The constitution already separates authored state, read projections, and `WorkflowExecutable`; Week 4 applies the same instinct to definitions and versions ([constitution §E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).

## What this unlocks next

Future event sourcing can subscribe to the per-diff stream because `IUpdateDraftCommand` preserves mutation event types ([spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md), [Workflows.Design extension catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Api/EXTENSION_POINTS.md)). Workflow-as-activity work can build on exact SemVer lookup because the catalog stores author-owned version strings and SemVer ordering ([spec 004](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md), [ActivityDefinitionVersion.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Design/Persistence/Core/Entities/ActivityDefinitionVersion.cs)). Future provider work also has a map: expected seams should appear in an extension catalog ([EXTENSION_POINTS.md](https://github.com/elsa-workflows/elsa-foundation/blob/main/EXTENSION_POINTS.md)).

## This week by the numbers

The week produced 18 non-merge commits in `elsa-foundation`, with no merged PRs found for the window ([commit query](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-29&until=2026-06-05), [merged PR query](https://github.com/elsa-workflows/elsa-foundation/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-05-29..2026-06-04)). `elsa-foundation-studio` had no commit activity in the same window ([studio commit query](https://github.com/elsa-workflows/elsa-foundation-studio/commits/main/?since=2026-05-29&until=2026-06-05)). The work was authored by Joey Barten, `j03y-nxxbz`, across the verified commit set, including the lifecycle pipeline commit ([b3137551](https://github.com/elsa-workflows/elsa-foundation/commit/b313755160efc8d2064e7339de2810aaba2279fa)), the unified event/update command commit ([f590e4ce](https://github.com/elsa-workflows/elsa-foundation/commit/f590e4ce2960d815003a47ca72e9fdb06abd6f70)), and the extension-point rollout ([71e1cb75](https://github.com/elsa-workflows/elsa-foundation/commit/71e1cb754562708563e88eb41b10390baf742ed5)).

If you read only four sources this week, read the single update command spec ([spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)), the activity semantic versioning spec ([spec 004](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)), the root extension-point index ([EXTENSION_POINTS.md](https://github.com/elsa-workflows/elsa-foundation/blob/main/EXTENSION_POINTS.md)), and the draft-mutation command surface in the constitution ([constitution §E2.9.7](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).

## Follow along

Follow the engine work in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation) and Studio work in [`elsa-foundation-studio`](https://github.com/elsa-workflows/elsa-foundation-studio). Architecture rules live in the constitution ([Elsa](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), [framework](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution-framework.md)); vocabulary lives in the glossary ([Elsa](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md), [framework](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/root.md)).
