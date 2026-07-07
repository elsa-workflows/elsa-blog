---
title: "Building Elsa 4 · Week 5: The Runtime Execution Seam Explodes into Specs"
slug: "building-elsa-4-week-5"
description: "Week 5 turns Elsa 4's runtime contract into 67 merged PRs of ordered specs, with Groundwork defining the persistence substrate."
publishedAt: "2026-06-12"
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
seoTitle: "Building Elsa 4 Week 5: Runtime Execution Seam Specs"
seoDescription: "Week 5 turns Elsa 4's runtime contract into 67 merged PRs of ordered specs, with Groundwork defining the persistence substrate."
excerpt: "The runtime execution seam finally moves from deferred architecture rule to ordered spec program."
---

# Building Elsa 4 · Week 5: The Runtime Execution Seam Explodes into Specs

## Where we are on the road

Last week, the Elsa 4 road was still mostly about shaping the boundary: Design and Runtime were separated, but the runtime execution seam remained the thing we had to specify before it could be implemented. That is the thread running back to the kickoff, “Why Elsa 4?”, and to the constitution's insistence that Elsa 4 should rebuild from clear seams instead of copying Elsa 3's accidental coupling.

This week is the turn. The runtime seam did not land as one grand rewrite. It exploded into an ordered spec program: 162 non-merge commits, 67 merged PRs, and a long run of small, inspectable slices.

> **Key Takeaways**
> - Week 5 turns the Runtime Execution Seam from deferred architecture into a numbered specification program.
> - The shape is now visible: pinned executable artifact, checkpoint commit, scheduler queue, post-commit outbox, recovery scanner, and execution context.
> - Groundwork advances in parallel as the persistence substrate, while workflow-as-activity forces a cleaner construction seam.

## The headline: the runtime execution seam becomes a spec program

The important thing this week is not that more than 70 spec slices appeared. The important thing is that they are ordered around one force: the runtime must execute a runtime artifact, not wander back into the design model whenever execution gets hard.

That force is already constitutional. In [§E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), the runtime contract says that if an artifact is published as runnable, the runtime “MUST be able to load and execute it.” The same section says the runtime depends on only the runnable artifact and configured runtime features. Design-side source artifacts, authoring history, draft revisions, designer layout, and projections do not participate in execution.

Week 5 converts that rule into machinery. The [Runtime Execution Seam program goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/runtime-execution-seam.md) frames the work as the place to “specify the seam between Workflows Design and Workflows Runtime before runtime implementation begins.” The first runtime slice, [007-runtime-executable-state-contracts](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/007-runtime-executable-state-contracts/spec.md), turns that into a testable contract: “A runtime maintainer can represent the exact executable artifact snapshot a workflow execution is allowed to run without loading the authored workflow document.” That slice was merged as [PR #7](https://github.com/elsa-workflows/elsa-foundation/pull/7).

From there, the sequence becomes legible. [008-checkpoint-commit-envelope](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/008-checkpoint-commit-envelope/spec.md), merged as [PR #8](https://github.com/elsa-workflows/elsa-foundation/pull/8), defines the checkpoint envelope. Its key sentence is the post-commit rule: outbound intents are recorded in the checkpoint and delivered “only after the checkpoint writer succeeds.” This is the seam between durable runtime facts and side effects.

Then the scheduler appears. [022-runtime-scheduler-work-queue](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/022-runtime-scheduler-work-queue/spec.md), merged as [PR #24](https://github.com/elsa-workflows/elsa-foundation/pull/24), stores scheduler work by `WorkflowExecutionId`, preserves per-workflow insertion order, and keeps queues idempotent within a workflow execution. That is not a full distributed scheduler yet. It is the smaller promise the rest of the runtime can build on.

The same pattern continues through post-commit and recovery. [046-runtime-post-commit-outbox-store](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/046-runtime-post-commit-outbox-store/spec.md), merged as [PR #48](https://github.com/elsa-workflows/elsa-foundation/pull/48), adds the in-memory outbox store. [048-runtime-post-commit-outbox-processor](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/048-runtime-post-commit-outbox-processor/spec.md), merged as [PR #50](https://github.com/elsa-workflows/elsa-foundation/pull/50), moves delivery into a processor. [049-runtime-recovery-scanner](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/049-runtime-recovery-scanner/spec.md), merged as [PR #51](https://github.com/elsa-workflows/elsa-foundation/pull/51), detects expired leases, stale heartbeats, and interrupted executions without pretending to requeue or repair everything in the same slice.

By the end of the chain, [064-runtime-workflow-execution-context](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/064-runtime-workflow-execution-context/spec.md), merged as [PR #66](https://github.com/elsa-workflows/elsa-foundation/pull/66), gives expression and JavaScript surfaces a runtime-owned context. It explicitly resolves workflow identity, inputs, variables, and activity outputs from runtime state, and it says the implementation must not reference Design-owned workflow or activity models.

That is the “what it rules out” insight for the week. A runtime that needs the authored workflow document to execute is not just inconvenient. Under [§E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), it is a broken runtime boundary. A checkpoint that dispatches side effects before commit is not just racy. Under [008](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/008-checkpoint-commit-envelope/spec.md), it violates the commit envelope.

## Supporting thread: Groundwork becomes the persistence substrate

Groundwork is the second story of the week because runtime seams eventually need state, and state needs a provider story. The [Groundwork Persistence Readiness program goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/groundwork-persistence-readiness.md) defines Groundwork as a provider-neutral persistence framework validated inside Elsa Foundation before it moves out.

The Week 5 framing is careful. Groundwork is not “put all runtime state in documents.” [012-groundwork-persistence-foundation](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/012-groundwork-persistence-foundation/spec.md), merged as [PR #18](https://github.com/elsa-workflows/elsa-foundation/pull/18), says a runtime checkpoint state store is benchmark-gated, while operational streams such as execution logs, queue backlog, and outbox records are specialized unless later evidence proves otherwise. That is an important refusal.

The generic promise sits one level lower. [013-groundwork-core-manifest-planner](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/013-groundwork-core-manifest-planner/spec.md) says a framework or application author can describe storage intent through a manifest: storage units, workload classification, lifecycle, identity, tenancy, concurrency, serialization, indexes, query contract, and schema version. The same manifest can produce relational and document plans, while unsupported capabilities fail clearly.

The first provider proof is [014-groundwork-sqlite-document-store](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/014-groundwork-sqlite-document-store/spec.md). It materializes document, index, and schema-history tables, then proves save, load, delete, declared-index queries, unique indexes, and optimistic concurrency. The spec also rules out silent scans: undeclared queries must fail clearly.

That matters for the runtime program. Elsa 4 can use Groundwork where the workload fits, but it does not need to lie about hot paths. The runtime outbox, scheduler queue, checkpoint store, recovery state, and durable values can each choose the right storage contract because Week 5 named them separately first.

## Supporting thread: workflow-as-activity exposes a leaky seam

Workflow-as-activity looks like a side feature until you follow the dependencies. It is actually a seam test. If a workflow can be surfaced as an activity, catalogued at design time, and later constructed at runtime, the architecture has to cross from Design to Runtime without smuggling Design into Runtime.

The historical [005-workflow-as-activity](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/005-workflow-as-activity/spec.md) spec now says it is superseded, but it also preserves the producer intent: marked workflows become version-distinct catalog rows, one backing activity type can represent many workflow-backed activities, and future specialized kinds should fit the same shape.

The implementation attempt rejected the first mechanism. [006-activity-construction-seam](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/006-activity-construction-seam/spec.md) lists the rejected parts plainly: an `IImplementationDescriptor` interface in Design Core, a hand-authored `Kind` discriminator, two registries, and a redundant `ClrImplementationDescriptor`. The reason is architectural, not stylistic. The first mechanism forced runtime-side construction code to know Design-side descriptor contracts, which violates the Workflows Design and Runtime split in [§E2.2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md).

The replacement is descriptor-type-driven construction. Design persists a `DescriptorType` string and opaque payload. Runtime features own the constructors for descriptor types they understand. The design domain transports descriptors; it does not deserialize them. That keeps workflow-as-activity possible without making the runtime dependent on design packages.

This is one of the better Week 5 examples of spec-driven scale. The team did not paper over a leaky abstraction to keep moving. It wrote down what failed, rejected the mechanism, retained the useful feature intent, and moved the seam.

## Supporting thread: the root activity correction narrows the model

The week also corrected the workflow boundary itself. [070-workflow-root-activity-contract](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/070-workflow-root-activity-contract/spec.md), merged as [PR #72](https://github.com/elsa-workflows/elsa-foundation/pull/72), says the foundation runtime slices had accidentally modeled `WorkflowDefinitionState` and `WorkflowExecutable` as flowchart-like containers.

The correction is simple and far-reaching: a workflow carries one root activity. That root may be a `Flowchart`, `Sequence`, `StateMachine`, primitive activity, or another activity kind. Flowchart connections, sequence ordering, `If.Then`, `If.Else`, `ForEach.Body`, and state transitions are activity-owned contract state, not generic workflow-level state.

This rules out a tempting shortcut. Workflows Core and Workflows Runtime Core should not define universal edge records, start node IDs, reserved slot constants, generic composition carriers, or flowchart semantics. If Flowchart needs edges, the Flowchart activity owns them. If Sequence needs order, Sequence owns it. Custom activities must be able to bring their own child structure without editing core runtime contracts.

That narrowing keeps the execution seam honest. The runtime schedules the executable root activity; activity modules interpret activity-owned structure. It also keeps Elsa 4 closer to the useful part of Elsa 3's model without copying Elsa 3's broader runtime coupling.

## What this unlocks next

Week 5 unlocks implementation by making the next work smaller. Runtime execution no longer has to begin with a giant executor. It can continue through named contracts: artifact pinning, scheduler work, checkpoint commits, post-commit delivery, recovery scanning, context values, and root activity scheduling.

It also gives Groundwork a cleaner validation path. Provider-neutral manifests can prove themselves on metadata, catalog, configuration, runtime-defined business data, and selected stores, while runtime hot paths remain behind explicit benchmark or specialization gates. That is healthier than adopting one persistence abstraction and discovering too late that queues, outboxes, leases, and execution logs needed different guarantees.

For Week 6 and Week 7, the obvious themes are implementation follow-through, activity-owned behavior, provider validation, and hardening. The specs now exist. The next question is which contracts survive contact with tests, execution, and real workflow behavior.

## This week by the numbers

This was the biggest week of the project so far: 162 non-merge commits, 67 merged PRs, and 3,678 files changed with +87,247/-25,855 lines in the research window.

The contributor shape changed too. Sipke Schoorstra authored 105 non-merge commits, Joey Barten authored 50 as “Joey Barten - Founder Orbyss”, and j03y-nxxbz authored 7. This is the week the work stopped looking like one maintainer arranging a skeleton and started looking like a team scaling a specification program.

If you read only a few primary sources, read [§E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), the [Runtime Execution Seam goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/runtime-execution-seam.md), [007-runtime-executable-state-contracts](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/007-runtime-executable-state-contracts/spec.md), [012-groundwork-persistence-foundation](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/012-groundwork-persistence-foundation/spec.md), and [070-workflow-root-activity-contract](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/070-workflow-root-activity-contract/spec.md).

## Follow along

The primary sources are public. Follow the [elsa-foundation repository](https://github.com/elsa-workflows/elsa-foundation), the [elsa-foundation-studio repository](https://github.com/elsa-workflows/elsa-foundation-studio), the [Elsa constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), and the [glossary](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/glossary). The best way to read this week is not as a flood of specs. Read it as the moment the runtime seam became inspectable.
