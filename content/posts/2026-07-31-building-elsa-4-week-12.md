---
title: "Building Elsa 4 · Week 12: Recovery Has More Than One Contract"
slug: "building-elsa-4-week-12"
description: "Week 12 separates durable runtime alteration jobs from interactive design recovery, making target snapshots, atomicity, retries, and unknown outcomes explicit."
publishedAt: "2026-07-31"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
excerpt: "A durable bulk operation and an interrupted editor request should not acquire the same recovery machinery by accident."
---

# Building Elsa 4 · Week 12: Recovery Has More Than One Contract

## A timeout is not an outcome

Losing a response doesn't prove that the server failed to commit. [ADR 0051](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0051-interactive-design-commands-recover-from-authoritative-state.md) makes that uncertainty explicit for interactive design commands. The client must recover from authoritative state rather than assume success, assume failure, or blindly repeat the request.

Week 12 covers **July 24 through July 30, 2026**, the window `[2026-07-24, 2026-07-31)`. Its companion decision, [ADR 0049](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0049-runtime-alterations-use-snapshotted-atomic-jobs.md), gives runtime alterations a durable plan-and-job model. These decisions agree about uncertainty without prescribing the same mechanism everywhere.

> **Key Takeaways**
> - Alteration plans seal their target cohort before dispatching jobs.
> - Atomicity belongs to each target execution, not the entire fleet.
> - Retries use idempotency and durable evidence; cancellation is cooperative.
> - Ordinary editor commands recover through authoritative rereads.
> - Publication, promotion, and runtime delivery retain separately justified reliability contracts.

## Why capture the whole cohort first?

An alteration plan fixes who it will affect before changing anyone. [ADR 0049](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0049-runtime-alterations-use-snapshotted-atomic-jobs.md), accepted July 26, requires durable keyset-paged capture, deduplication of execution identities, and a sealed snapshot. Dispatch begins only after that capture phase is complete.

Otherwise, a bulk operation can change its own selection criteria. Mutating executions from an earlier page might alter which executions appear on a later page. The accepted design separates capture from execution so the meaning of the operator's request doesn't drift while it runs.

<!-- [UNIQUE INSIGHT] -->

The snapshot is therefore more than a scheduling convenience. It preserves the scope of the request. The ADR rejects both a live query reevaluated during execution and silent target truncation. Paged capture, backpressure, and deployment storage quotas provide operational controls without disguising an incomplete cohort as a completed operation.

That doesn't mean physical capacity is unlimited. It means the contract doesn't quietly change the requested population to fit a convenient API limit. The scope and its operational cost stay visible.

## Where does atomicity begin and end?

Atomicity is per target execution. The [alteration contract](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0049-runtime-alterations-use-snapshotted-atomic-jobs.md) creates one durable job for each captured execution, preflights its ordered alterations, and applies them through that execution's single-writer boundary. A failing alteration commits none of that job's changes; other jobs continue independently.

This is not a fleet-wide transaction. Some executions can succeed while another fails validation. The plan keeps those outcomes rather than describing the whole cohort as rolled back. The design also marks later alterations in a failed job as skipped, which distinguishes "not attempted" from another independent failure.

The first migration contract is deliberately narrow. It admits a suspended, fully quiescent execution and an exact same-definition target artifact with compatible identities and contracts. It isn't an arbitrary state-mapping language for moving any running workflow to any graph.

The ordering rules are similarly explicit. `CancelWorkflow` must be the only alteration. `Migrate` can occur once and must come first. The [plan service](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/src/Elsa/Workflows/Runtime/Services/Alterations/WorkflowAlterationPlanService.cs) enforces those admission rules before capture. The implementation arrived in [elsa-workflows/elsa-foundation#1080](https://github.com/elsa-workflows/elsa-foundation/pull/1080).

## What happens after a retry or cancellation?

Retries use a tenant-scoped idempotency key and canonical request identity. [ADR 0049](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0049-runtime-alterations-use-snapshotted-atomic-jobs.md) requires the same key and request to recover the existing plan, while changed content conflicts. The delivery model remains at least once; it doesn't claim that transport suddenly became exactly once.

The [admission service](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/src/Elsa/Workflows/Runtime/Services/Alterations/WorkflowAlterationPlanService.cs) derives plan identity from the tenant and hashed key, canonicalizes the request, and protects its execution payload before storing the capturing plan. Structural identity and the data needed to execute the plan have distinct roles.

Uncertain acknowledgement is not permission to apply the alterations again. The ADR requires reconciliation against durable checkpoint evidence before retrying. This is where the [persistence boundary](/blog/groundwork-and-the-persistence-boundary-in-elsa) becomes an operational concern: evidence of a committed transition must survive the caller losing its connection.

Cancellation also has a boundary. It stops capture and prevents undispatched jobs from beginning, but a job already executing inside the workflow actor finishes its atomic checkpoint. The plan preserves completed results and reports the mixed outcome. "Cancel" doesn't rewrite history to make earlier successful work disappear.

## Why not keep a replay ledger for every edit?

Ordinary interactive design mutations use a different recovery contract. [ADR 0051](https://github.com/elsa-workflows/elsa-foundation/blob/ca818b649d85c5167e2222c0ec534e215153d473/docs/adr/0051-interactive-design-commands-recover-from-authoritative-state.md), accepted July 28, requires atomic server-side transitions, authorization, validation, uniqueness, and optimistic concurrency. It does not promise exact replay of every previously returned response.

The client instead needs a stable target identity or deterministic lookup. After a timeout, it rereads authoritative state. It can accept a committed result, reapply still-relevant intent against the new revision, or report a conflict. Client-local bookkeeping alone can't establish whether the server committed.

<!-- [UNIQUE INSIGHT] -->

This is not an argument against durable receipts. The ADR explicitly excludes publication, promotion, automated reconciliation, runtime delivery, and bulk or long-running administrative work. Those boundaries may justify replay records. The decision rejects making a permanent operation ledger the default cost of every routine editor interaction.

The status matters: this week's ADR calls for a follow-up inventory and a safe migration or retirement path for the shared design-operation ledger. It is not evidence that every endpoint already completed that transition. A journal should preserve the difference between an accepted recovery model and its finished rollout.

## Make the recovery model reviewable

The alteration implementation and the design-recovery decision make a useful contrast. One operation needs a durable, sealed cohort and per-execution jobs. Another needs a trustworthy way to find current design state after an ambiguous response. Neither benefits from blind retries or success-shaped guesses.

That fits the [Elsa 4 rebuild's emphasis on explicit boundaries](/blog/why-elsa-4-rebuilding-a-dotnet-workflow-engine). For contributors, the productive review question is concrete: after losing an acknowledgement, what evidence establishes what happened? Week 12 gives different operations different answers, with the decisions and implementation available to inspect.
