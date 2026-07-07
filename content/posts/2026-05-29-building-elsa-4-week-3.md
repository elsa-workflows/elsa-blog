---
title: "Building Elsa 4 · Week 3: The First Speckit Slices"
slug: "building-elsa-4-week-3"
description: "Week 3 turns Elsa 4 decisions into Speckit slices: WorkflowDefinitionState scope, the activity catalog source of truth, and numbered specs."
publishedAt: "2026-05-29"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
featuredImage: "../assets/2026-05-29-building-elsa-4-week-3/featured.png"
featuredImageAlt: "Translucent numbered specification cards in a modular grid over a dark technical surface."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 Week 3: The First Speckit Slices"
seoDescription: "Week 3 turns Elsa 4 architecture into Speckit slices: WorkflowDefinitionState scope, activity catalog identity, and numbered specs."
excerpt: "Week 3 is where Elsa 4 starts turning architecture decisions into numbered Speckit slices."
---

# Building Elsa 4 · Week 3: The First Speckit Slices

## Where we are on the road

Week 3 is where the Elsa 4 rebuild starts becoming legible as numbered Speckit slices. Week 2 was still about folding review feedback into seams: domain-event handlers replaced direct cross-domain hooks, and the Jint adapter work was accepted in follow-up commits ([a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb), [a9d0697f](https://github.com/elsa-workflows/elsa-foundation/commit/a9d0697f)).

The kickoff post, “Why Elsa 4?”, named the reason for this rebuild. The old `elsa-core` shape had god packages, most visibly `Elsa.Workflows.Core`, which mixed runtime, design, persistence, and serialization concerns ([elsa-core baseline case study](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). This week applies the same lesson one level down: if packages can become god packages, state objects can become god objects too.

> **Key Takeaways**
> - Week 3 produced 15 non-merge commits, two numbered specs, and no merged PRs.
> - §E2.9 defines `WorkflowDefinitionState` as authored content, not runtime, projection, layout, or executable state.
> - The activity catalog becomes the design-time source of truth for picker visibility.

## The headline decision: `WorkflowDefinitionState` gets a fence

The main decision this week is §E2.9: `WorkflowDefinitionState` is the canonical authored workflow document, not a convenient bag for every workflow-shaped concern. The rule landed in the constitution and in the code documentation header in Unit C Phase 3 ([constitution §E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e29-workflowdefinitionstate-scope-policy--architectural-triplet-unit-c-2026-05-28-pending-2026-06-01-architecture-review), [d01eed8a](https://github.com/elsa-workflows/elsa-foundation/commit/d01eed8a7e95712ea9d47c99e4e75f4d39e745ec)).

The constitution says the quiet part directly:

> `WorkflowDefinitionState` is “the canonical authored document of a workflow definition” and pinning its scope “prevents the god-object failure mode flagged in Sipke's 2026-05-26 entity-design review” ([constitution §E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e29-workflowdefinitionstate-scope-policy--architectural-triplet-unit-c-2026-05-28-pending-2026-06-01-architecture-review)).

That sentence matters because workflow definition state is an attractive dumping ground. It is already close to the designer. It already persists. It already feels like “the workflow.” Without a fence, every later unit would have a plausible reason to add one more field.

§E2.9 names the fence as a triplet: [`WorkflowDefinitionState`](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md) ↔ read models/projections ↔ [`WorkflowExecutable`](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md). Those are three different scopes: authoring, reading, and executing. The design/runtime [bounded-context split](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e22-workflowsdesign--workflowsruntime-bounded-context-split) depends on keeping them separate, and the artifact-only runtime rule says Runtime executes the artifact, not the design document ([constitution §E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e26-runtime-contract--executable-always-runs-and-artifact-only-design)).

The most useful part is what the rule rejects. §E2.9.2 explicitly keeps instance state, execution logs, executable/build metadata, publication state, listing projections, security ownership, designer layout, and validation errors out of `WorkflowDefinitionState` ([constitution §E2.9.2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e292-out-of-scope-of-workflowdefinitionstate)). That is the architecture doing work before a feature request arrives.

It also changes the review conversation. A proposed field no longer starts with “can we store this in State?” It starts with “is this authored content?” If the answer is no, §E2.9 already tells us where to look next: projection, executable, sibling entity, security model, or runtime state.

## Why did the activity catalog matter this week?

The activity catalog decision is the sibling story: design-time activity visibility now comes from catalog rows, not live provider discovery. Spec 001 says the picker should show exactly what the catalog contains, and a loaded CLR type without a catalog row must not appear in the picker ([spec 001](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md)).

That closes another drift path from Elsa 3. If the picker can scan assemblies or query live providers independently, the designer can show activities the persisted model does not understand. Spec 001 makes the [activity catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md) the source of truth, and Unit B completed the model work in [db691030](https://github.com/elsa-workflows/elsa-foundation/commit/db6910306cebc36e41be318275878ae204d70bd9).

The identity part is just as important. The spec describes an `ActivityTypeKey` that survives CLR renames, namespace moves, and assembly repackaging ([spec 001 user story 1](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md)). A workflow should not break because an implementation class moved. The durable authored reference is logical activity identity, not `TypeInformation`.

This rule also rejects a tempting toggle. §E2.8 says `IsBrowsable` is not the visibility mechanism; visibility is structurally derived from catalog membership ([constitution §E2.8](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e28-activity-catalog-is-the-single-source-of-truth-for-picker-visibility)). Context-aware filtering can still exist later, but it filters catalog facts. It does not create picker entries by bypassing the catalog.

## How did the first Speckit slices make the build legible?

The week’s theme is not only “two things changed.” It is that the changes now have numbered slices: `001-activity-identity-catalog` and `002-workflow-state-scope` ([spec 001](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md), [spec 002](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)). That makes the rebuild auditable in a way a long refactor branch never is.

Spec 001 carved out activity identity, catalog truth, descriptor storage, provenance, and construction seams. Spec 002 carved out the `WorkflowDefinitionState` policy, layout siblings, NodeId naming, and the `ActivityVersionId` reference back into the catalog ([spec 002 requirements](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)).

The commits show the same slicing. The §E2.9 policy and documentation header landed in Phase 3 ([d01eed8a](https://github.com/elsa-workflows/elsa-foundation/commit/d01eed8a7e95712ea9d47c99e4e75f4d39e745ec)). The layout siblings, NodeId rename, and `ActivityVersionId` collapse followed in Phases 4 and 5 ([ca1957d3](https://github.com/elsa-workflows/elsa-foundation/commit/ca1957d3cfda30da92845353eea80e867ddcb6fc)). The `IsRequired` contract, legacy `WorkflowMetadata` deletion, and migration reset landed in Phase 2 ([99da3acb](https://github.com/elsa-workflows/elsa-foundation/commit/99da3acbf7c49171e6a07c3428b8651970b9e5a2)).

That sequence matters. Layout did not get smuggled into State. Spec 002 sends designer layout to `WorkflowDefinitionVersionLayout` and `WorkflowDefinitionDraftLayout`, both exposed through `IWorkflowDefinitionLayout` ([spec 002 user story 2](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md), [layout contract](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Core/Contracts/IWorkflowDefinitionLayout.cs)). The `WorkflowDefinitionState` header then repeats the rule in code, where future contributors will see it first ([WorkflowDefinitionState.cs](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Design/Core/Models/WorkflowDefinitionState.cs)).

## What did Week 3 deliberately reject?

Week 3 rejected four shortcuts. First, it rejected a god `WorkflowDefinitionState`; §E2.9 says ambiguous fields escalate to architecture review instead of silently landing in State ([constitution §E2.9.2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e292-out-of-scope-of-workflowdefinitionstate)).

Second, it rejected picker truth from runtime discovery. Spec 001 says a CLR activity loaded in the process but missing from the catalog does not appear in the picker ([spec 001 acceptance scenarios](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md)).

Third, it rejected layout as a field on the authored document. Spec 002 sends layout to sibling entities and keeps it unreachable through `WorkflowDefinitionState` ([spec 002 FR-006](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md)).

Fourth, it rejected a vague metadata catch-all. The spec clarifies that the old `WorkflowMetadata` value object is deleted because its current fields are not needed, and future version-level metadata belongs to a later allocation pass ([spec 002 clarification](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md), [99da3acb](https://github.com/elsa-workflows/elsa-foundation/commit/99da3acbf7c49171e6a07c3428b8651970b9e5a2)).

## What this unlocks next

The payoff is that future units can now attach new concerns to the right surface. Runtime can receive a `WorkflowExecutable` without loading design-side state, which preserves the artifact-only runtime contract ([constitution §E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e26-runtime-contract--executable-always-runs-and-artifact-only-design)). Dashboards can add projections without turning the authored document into a listing model ([constitution §E2.9.3](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e293-architectural-triplet)).

The activity catalog also has room to grow. Non-CLR activities, workflow-as-activity, scripts, and remote implementations can become catalog rows instead of special picker branches, because Spec 001 treats implementation kind as data behind a stable catalog identity ([spec 001 user story 3](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md)).

This is the kind of week that looks small from the outside. No big UI screenshot. No public release. But the boundary is now named, quoted, and checked into the place future work has to pass through.

## This week by the numbers

- **15 non-merge commits** in the 2026-05-22 → 2026-05-29 exclusive window, verified against the local `elsa-foundation` Git history and visible in the repository commit stream ([commits](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-22&until=2026-05-29)).
- **0 merged PRs** in the same window ([GitHub PR search](https://github.com/elsa-workflows/elsa-foundation/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-05-22..2026-05-28)).
- **2 new spec slices**: [001 Activity Identity & Catalog](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/001-activity-identity-catalog/spec.md) and [002 WorkflowDefinitionState Scope Policy](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/002-workflow-state-scope/spec.md).
- **1 contributor** in the week’s commit log: Joey Barten.

If you read one thing from the week, read [§E2.9](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md#e29-workflowdefinitionstate-scope-policy--architectural-triplet-unit-c-2026-05-28-pending-2026-06-01-architecture-review), then the commit that put it into the code path ([d01eed8a](https://github.com/elsa-workflows/elsa-foundation/commit/d01eed8a7e95712ea9d47c99e4e75f4d39e745ec)).

## Follow along

- [elsa-foundation](https://github.com/elsa-workflows/elsa-foundation)
- [elsa-foundation-studio](https://github.com/elsa-workflows/elsa-foundation-studio)
- [Elsa constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)
- [Elsa glossary](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/glossary/elsa.md)
