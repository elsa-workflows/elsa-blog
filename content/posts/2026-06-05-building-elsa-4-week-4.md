---
title: "Building Elsa 4 · Week 4: One Command, One Event, One Version"
slug: "building-elsa-4-week-4"
description: "Week 4 collapses Elsa 4's design domain: 20 granular draft-mutation commands become one diff-based IUpdate, three pub/sub concepts collapse into IEvent, and activity versions move to author-controlled semver."
publishedAt: "2026-06-05"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
  - "workflow-engine"
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 Week 4: One Command, One Event, One Version"
seoDescription: "Week 4 collapses Elsa 4's design domain: 20 draft-mutation commands become one diff-based IUpdate, three pub/sub concepts merge into IEvent, and activity versioning moves to author-controlled semver."
excerpt: "Week 4 is about collapsing surface area in the design domain: one update command, one event abstraction, and one version format."
---

# Building Elsa 4 · Week 4: One Command, One Event, One Version

## Where we are on the road

Week 3 named two fences: `WorkflowDefinitionState` is authored content and nothing else, and the activity catalog is the picker's source of truth. Those fences were architectural claims. Week 4 is the week the build follows through on them — collapsing surface area instead of adding it.

Three decisions define the week. First, three separate in-process pub/sub mechanisms are folded into one. Second, twenty granular draft-mutation commands are replaced by one diff-based `IUpdate`. Third, system-assigned integer activity versions are retired in favor of author-controlled semantic version strings. All three are simplifications that land *because* the boundary work from weeks 1–3 made the consequences of carrying the old surface legible.

> **Key Takeaways**
> - 17 non-merge commits, 0 merged PRs, 3 new spec slices, sole contributor Joey Barten.
> - Unit 1 collapses `IDomainEvent`, `INotification`, and `ILifecycleEvent` into a single `IEvent` published via `IEventPublisher`.
> - Spec 003 retires 20 granular draft-mutation commands in favor of one diff-based `IUpdateDraftCommand` that emits one typed event per detected difference.
> - Spec 004 moves activity version ownership from the system (integer counter) to the author (semver string).

## The unified event system: three concepts become one

Unit 1 landed with the unified event system. Before this week, the codebase carried three distinct in-process pub/sub concepts: `IDomainEvent`, `INotification`, and `ILifecycleEvent`. They covered overlapping territory, forcing callers to decide which channel to use and forcing readers to track three separate routing paths ([Unit 1 checkpoint commit](https://github.com/elsa-workflows/elsa-foundation/commit/0efefb64)).

The replacement is one concept: `IEvent`, published via `IEventPublisher.Publish(IEvent, IEventPublishingStrategy?, …)` in `Elsa.Events.Core` / `Elsa.Events`. The publishing strategy controls delivery mode. A sequential strategy blocks the caller until all handlers complete — the gate pattern, used for validation that must finish before the command continues. A background strategy fires after the current operation commits — the outcome pattern, used for side effects that should not hold the lock. The distinction between gate and outcome was always present in the old system; the new one makes it an explicit parameter rather than a consequence of which pub/sub interface you happened to choose ([Unit 1 addendum commit](https://github.com/elsa-workflows/elsa-foundation/commit/e2c8c940)).

The `EXTENSION_POINTS.md` rollout that followed is the documentation side of the same decision. Every domain now carries an explicit record of its contribution points — the places where an outside module can hook into the domain's behavior without reaching into its internals ([Unit 1 extension commit](https://github.com/elsa-workflows/elsa-foundation/commit/71e1cb75)). That document turns contribution intent into auditable architecture: a future maintainer can read which events a domain publishes, which commands it exposes, and which handler slots it opens, without reading the implementation.

What the unified event system rejects is the implicit. Three different pub/sub abstractions made it easy to publish to the wrong channel by accident, or to miss a publication point entirely because it was registered on a different interface. One `IEvent` and one `IEventPublisher` make the audit path clear: if something was published, it went through `IEventPublisher`. If a handler was registered, it registered for `IEvent`.

## The headline: twenty commands become one

The design domain's most significant structural change this week is spec 003 ([003-single-update-command](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)).

Week 3's Unit C shipped a granular command surface for draft authoring: one command per mutation kind — add activity, remove activity, update activity input, add connection, remove variable, update workflow input, and so on. The full count was 20 mutation commands and 20 corresponding mutation events in `Elsa.Workflows.Design.Core/Events`, alongside 3 lifecycle events (`OnDraftCreated`, `OnDraftClonedFromVersion`, `OnDraftDiscarded`).

The 2026-06-01 architecture review leaned toward collapsing the mutation surface into one command. The reasons were practical. Twenty distinct commands force the UI to decide which one to call for each edit. Batching becomes a coordination problem. Ordering interacts with validation in unexpected ways. And event-sourcing — Unit H on the roadmap — gains nothing from twenty separate entry points if all twenty are going to run in sequence anyway.

The replacement is `IUpdateDraftCommand` (Unit 2): one command that accepts the complete desired Draft state, loads the currently-stored state, and diffs them. For each detected difference, it emits exactly one typed event from the existing 20-event catalog — an `OnActivityAddedToDraft`, an `OnVariableUpdatedInDraft`, an `OnConnectionRemovedFromDraft`. Then it persists the new state, runs the `OnDraftValidating` sequential gate and `OnDraftValidated` background outcome pair, and releases the per-Draft distributed lock. The 20 public command contracts are deleted. The per-action apply logic that the old commands carried survives as private apply-steps inside the diff engine ([IUpdate implementation](https://github.com/elsa-workflows/elsa-foundation/commit/f590e4ce)).

The diff is semantic, not structural. It diffs at the level of the domain concepts the event surface already names: each activity, connection, variable, workflow input, workflow output, activity input, and activity output. A renamed variable whose id is unchanged is one `OnVariableUpdatedInDraft` event, not a remove-and-add pair. Stable synthetic ids (NodeId for activities, stable ids for other dimensions) make that work. The diff engine is concept-aware by design, so the event stream it produces is usable by event-sourcing consumers without interpretation overhead ([spec 003 diff granularity](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)).

The `IUpdate` command is also where layout now flows. Designer layout — activity positions and sizes, stored in the `WorkflowDefinitionDraftLayout` sibling, not in `WorkflowDefinitionState` — is part of the desired-state input `IUpdate` receives. The command diffs layout alongside content and emits `OnActivityMovedInDraft` for each layout difference. This closes the move-event producer gap without putting layout back inside `WorkflowDefinitionState`, keeping §E2.9's fence intact.

What this week rejects is the open-ended command surface. Every new mutation kind would have added a 21st command, a 21st event type, a 21st UI binding question, and a 21st test fixture. The diff-based approach absorbs new mutation kinds into the diff engine's concept list instead.

## Supporting thread: the definition becomes a visual shell

A quieter structural correction landed alongside the command collapse. Source provenance — the origin information describing where a workflow definition's content came from — was moved from the `WorkflowDefinition` entity to the `WorkflowDefinitionVersion` ([source-to-version commit](https://github.com/elsa-workflows/elsa-foundation/commit/2e40a37d)). The definition is now explicitly framed as "a visual shell": it holds presentation and organizational data, not provenance, not content, not runtime policy.

The `Activities.Json` and `Workflows` reconciliation tests that relied on the old provenance location were removed rather than migrated ([reconciliation cleanup commit](https://github.com/elsa-workflows/elsa-foundation/commit/962923ff)). That is consistent with Unit B's no-preserved-production-data convention: the migration regenerates fresh rather than carrying old assumptions forward.

The practical effect is that each version now fully self-describes its own origin. A version knows where its content came from; the definition does not need to. That makes the definition leaner and the version more self-contained, which is the right direction as the version becomes the pinnable unit both for activity semantic versioning (spec 004, below) and for the runtime's artifact pinning.

## Supporting thread: activity versions move from integer to semver

Spec 004 ([004-activity-semantic-versioning](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)) addresses a model inconsistency that would have become a real problem once workflow definitions started pinning activity versions.

Before this week, the activity catalog carried integer version numbers assigned by the system. A version was a counter the system incremented; the activity author had no say. That model works for change tracking but fails at the seam Unit 4 needs: a workflow definition that wants to pin "Elsa.Http.SendRequest at 2.1.0" cannot express that with a system-assigned integer that might be 1 on one host and 3 on another.

Spec 004 moves version ownership to the author. The source of truth is the declaring assembly's version — a semantic version string the author already controls by bumping their assembly. When an author needs a per-activity override (to ship multiple versions of one activity in the same assembly, or to evolve one activity's version independently of the rest), a `[Version("x.y.z")]` attribute on the type provides the override. The catalog records the resolved string — attribute override if present, otherwise the assembly version — and the system never invents, increments, or reinterprets the number ([spec 004 user story 1](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)).

Versions are ordered by semantic-version precedence, not lexical order. `10.0.0` is newer than `2.0.0`; `1.0.10` is newer than `1.0.2`. Lexical ordering silently gets this wrong (`"10.0.0" < "2.0.0"` as a string) — a silent-wrong-answer class of bug, not a crash. The spec pins correct ordering from the first commit of the new model.

The hash-mismatch guard survives the type change. If an author bumps an activity's content without bumping its version, the catalog detects a hash mismatch for the same `(DefinitionId, Version)` key and throws rather than silently overwriting. The guard existed for system bugs; now it catches a common author oversight.

The CLR assembly scanner that reads the versions is a new project, `Elsa.Activities.Design.Reconciliation.Clr`, registered as an `IActivityReconciliationSource`. It loads and scans a configured folder of DLLs, resolves each activity's version (attribute override or assembly version), and contributes to the catalog. It is the only reconciliation project that references runtime activity abstractions, which is the allowed §E2.2 direction: Design may depend on Runtime, not the reverse. The spec also corrects the reconciliation feature's inheritance-based contribution pattern — consumers now register an `IActivityReconciliationSource` in DI from their own feature rather than deriving from an abstract base ([spec 004 FR-021](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)).

The initial Unit 4 commit dropped at the end of the week ([Unit 4 initial commit](https://github.com/elsa-workflows/elsa-foundation/commit/b5adc5c3)), and a JSON reconciliation source was added as a worked example of the `IActivityReconciliationSource` contribution pattern beyond CLR scanning ([JSON source commit](https://github.com/elsa-workflows/elsa-foundation/commit/9eb43309)). Both are scaffolding for the next unit — workflow-as-activity, which needs a stable activity identity and a pinnable version to land cleanly.

## What this unlocks next

The unified event system gives the whole design domain one auditable publication path. When Week 5's runtime execution seam starts publishing its own events, it can use the same `IEvent` substrate rather than introducing a fourth pub/sub concept.

The single update command gives the UI a simpler contract: send the complete desired state, let the command figure out what changed. The per-diff event stream is still there for event-sourcing (Unit H) and for validation consumers that want to react to specific change types. The stream just has one producer now.

Author-controlled semver unblocks the activity-pinning that workflow-as-activity needs. A workflow definition will be able to say "use version 2.1.0 of this activity" and mean it durably, independent of system state or host configuration. That is the prerequisite the runtime's artifact-pinning contract (spec 007, Week 5) needs to land on firm ground.

## This week by the numbers

- **17 non-merge commits** in the 2026-05-29 → 2026-06-05 exclusive window ([commits](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-29&until=2026-06-05)).
- **0 merged PRs** in the same window ([GitHub PR search](https://github.com/elsa-workflows/elsa-foundation/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-05-29..2026-06-04)).
- **3 spec slices active**: Unit 1 addendum (unified event system), [003-single-update-command](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md), and [004-activity-semantic-versioning](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md).
- **1 contributor**: Joey Barten (`j03y-nxxbz`).

If you read one primary source from the week, read [spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md) — specifically the clarification that resolves the diff granularity question (semantic per domain concept, not structural per field). That decision is what makes the event stream useful for Unit H without additional interpretation.

## Follow along

- [elsa-foundation](https://github.com/elsa-workflows/elsa-foundation)
- [elsa-foundation-studio](https://github.com/elsa-workflows/elsa-foundation-studio)
- [Elsa constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)
- [Elsa glossary](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/glossary)
