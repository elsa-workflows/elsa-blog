---
title: "Building Elsa 4 · Week 3: The First Specs, and a Rule Against God Objects"
slug: "building-elsa-4-week-3"
description: "Week 3 of Elsa 4: the first numbered Speckit slices land — an activity identity catalog and a §E2.9 scope policy that stops WorkflowDefinitionState becoming a god object."
publishedAt: "2026-05-29"
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
featuredImage: "../assets/2026-05-29-building-elsa-4-week-3/featured.png"
featuredImageAlt: "Building Elsa 4 DevJournal cover — Week 3, “The First Specs, and a Rule Against God Objects” — on a dark slate background with an abstract workflow-node graph motif."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 3: The First Specs and a Rule Against God Objects"
seoDescription: "Elsa 4's first Speckit slices arrive: an activity identity catalog as source of truth, and a constitution scope policy that prevents a workflow-state god object."
---

> **Key Takeaways**
> - Week 3 (2026-05-22 → 2026-05-29) starts spec-driven development for real: the first numbered Speckit slices, **001-activity-identity-catalog** and **002-workflow-state-scope**, land ([spec 001](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md), [spec 002](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)).
> - The headline rule is **constitution §E2.9**: a scope policy that stops `WorkflowDefinitionState` from becoming a god object ([commit d01eed8a](https://github.com/elsa-workflows/elsa-foundation/commit/d01eed8a)).
> - Fifteen commits this week turn "we have rules" into "we have specs that enforce the rules."

## Where we are on the road

The first two weeks built the law (a two-layer constitution) and the wiring (domain events, adapters). Week 3 introduces the *process* that connects them: Speckit, the spec-driven workflow where each unit of work becomes a numbered slice with a spec, plan, tasks, and contracts. This is the week the journal you're reading becomes possible to write — because the decisions start arriving as readable, numbered artifacts.

## The headline decision: scope the workflow state before it sprawls

The most important slice is **002-workflow-state-scope**, and its commit is blunt about what it's defending against: a §E2.9 scope policy with documentation headers and audits ([d01eed8a "Unit C Phase 3 — US1 MVP: §E2.9 scope policy + doc header + audits"](https://github.com/elsa-workflows/elsa-foundation/commit/d01eed8a); [spec 002](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)).

`WorkflowDefinitionState` is the kind of type that, left unmanaged, eats the codebase. Everything about a workflow is *tempting* to hang off it: authored content, read projections, layout, execution data. That temptation is precisely how elsa-core grew god packages ([elsa-core worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). The §E2.9 scope policy answers preemptively by drawing a line around what state is allowed to live where, separating authored state from read projections from the executable representation ([constitution §E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).

What it *rules out* is the path of least resistance — one fat state object that every feature reaches into. By making "what belongs in workflow state" a written, audited policy in week three, the project pays a small cost now to avoid the expensive untangling later. This is the same instinct week 4 will reuse when it keeps definitions a "visual shell" and pushes source detail down to versions.

## Supporting thread: activities get a real identity model

The other founding slice is **001-activity-identity-catalog**, implemented as the activity identity and catalog model ([db691030 "Unit B — Activity identity & catalog model (implementation complete)"](https://github.com/elsa-workflows/elsa-foundation/commit/db691030); [spec 001](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md)).

An activity catalog is the source of truth for which activities exist and how they're identified — the foundation the designer's picker and, later, semantic versioning depend on. Establishing identity *before* building features on top of activities is the right order: it means version pinning and catalog-driven visibility have a stable substrate. Week 4's author-owned SemVer work builds directly on this identity model ([spec 004](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/004-activity-semantic-versioning/spec.md)).

## Supporting thread: required-ness and a metadata cleanup

The week also tightens the model around required fields and removes a stale abstraction: an `IsRequired` contract arrives, `WorkflowMetadata` is deleted, and the migration is reset ([99da3acb "Unit C Phase 2 — IsRequired contract + WorkflowMetadata deletion + migration reset"](https://github.com/elsa-workflows/elsa-foundation/commit/99da3acb)). Layout siblings and a `NodeId` rename follow, collapsing an `ActivityVersionId` along the way ([ca1957d3 "Unit C Phases 4 + 5 — US2 Layout siblings + US3 NodeId rename + ActivityVersionId collapse"](https://github.com/elsa-workflows/elsa-foundation/commit/ca1957d3)).

Deleting `WorkflowMetadata` rather than letting it linger is the small move that matters: an unused catch-all is a future god object waiting to happen. Removing it keeps the §E2.9 scope policy honest.

## What this unlocks next

With activity identity pinned and workflow state scoped, the authoring write path can be redesigned cleanly — which is exactly what week 4 does, collapsing twenty draft-mutation commands into one diff-based `IUpdateDraftCommand` while keeping a typed event per change ([spec 003](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)). None of that is safe without first deciding what state is allowed to exist.

## This week by the numbers

Fifteen non-merge commits in `elsa-foundation`, zero merged PRs, authored by Joey Barten (`j03y-nxxbz`) ([commit history for the window](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-22&until=2026-05-29)). No `elsa-foundation-studio` activity yet. The two slices to read are [001-activity-identity-catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md) and [002-workflow-state-scope](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md), with the policy itself pinned in [constitution §E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md).

## Follow along

Specs live under [`specs/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs); the rules they enforce live in the constitution ([Elsa](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), [framework](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution-framework.md)). Next week: one command, one event surface.
