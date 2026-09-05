---
title: "Building Elsa 4 · Week 13: Absence Needs Evidence"
slug: "building-elsa-4-week-13"
description: "Week 13 proposes execution evidence tied to committed checkpoints, explicit capture sessions, and complete ranges that distinguish absence from delivery lag."
publishedAt: "2026-08-07"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
excerpt: "A test timing out is not proof that an activity never ran. Week 13 designs the evidence needed to tell those cases apart."
---

# Building Elsa 4 · Week 13: Absence Needs Evidence

## Designing for the event that never appears

A timeout proves that a consumer didn't observe a match in time. It doesn't prove that the activity never executed. [The proposed ADR 0058](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0058-negative-evidence-claims-require-a-complete-gap-free-range.md) starts from that distinction: delivery lag, an open workflow, or missing evidence can all look like absence to a waiting test.

Week 13 covers **July 31 through August 6, 2026**, the window `[2026-07-31, 2026-08-07)`. The Execution Evidence work this week is a **proposed design and a completed disposable seam prototype**, not a finished evidence product. That status is part of the story.

> **Key Takeaways**
> - The proposal records evidence intent with the checkpoint that makes a fact true.
> - Capture requires both module enablement and an explicit evidence session.
> - Negative assertions need a bounded, gap-free range, not just a timeout.
> - Value capture is opt-in and sanitized before persistence.
> - A prototype supports the seam choice; full delivery remains planned.

## When does an execution fact become true?

Under [proposed ADR 0052](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0052-execution-evidence-is-checkpoint-atomic-and-at-least-once-delivered.md), the complete evidence intent is recorded atomically with the runtime checkpoint. The query-store record can be materialized later. This separates the moment a semantic fact becomes committed from the moment a consumer can query it.

Both naive alternatives have a problem. Emit before the commit, and a test can observe behavior that rolls back. Emit best-effort afterward, and committed behavior can leave no evidence. The proposal instead makes required evidence preparation part of checkpoint success for executions that opted into capture.

Delivery remains at least once. A stable evidence identifier lets the materializer recognize a retry rather than invent a second occurrence. Workflow-local sequence numbers provide ordering and expose gaps. Failure after the checkpoint commits doesn't roll workflow state back; it leaves delivery pending and the evidence range incomplete.

<!-- [UNIQUE INSIGHT] -->

The transaction boundary is the intent, not a distributed transaction spanning every consumer store. The [August 5 prototype report](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/reports/runtime-execution-evidence-seam-prototype.md) records that the existing generic checkpoint-enricher and post-commit outbox seams supported this shape. It explicitly doesn't claim cross-store ACID or exactly-once side effects.

## Which executions should be captured?

There are two gates in [proposed ADR 0053](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0053-execution-evidence-capture-is-explicitly-session-scoped.md): the host enables the module, and a caller associates an execution with an `EvidenceSessionId`. Enabling a shared QA host would not automatically capture every workflow running there.

The distinction limits both overhead and data exposure. It also gives concurrent verification activities separate evidence sets. A session association is intended to survive scheduler work, stimuli, child dispatch, and resumption; losing it must be visible as broken continuity, not silently create unrelated records.

The vocabulary is deliberately neutral. Test infrastructure can correlate a session with its own test-run or case identifier, but that doesn't make a particular test runner's model part of Elsa's runtime contract. The [program goal](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/program-goals/runtime-execution-evidence.md) likewise excludes an assertion DSL and a Studio evidence UI from the initial scope.

## What would make an absence claim conclusive?

A conclusive absence claim needs a complete, gap-free range. [ADR 0058](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0058-negative-evidence-claims-require-a-complete-gap-free-range.md) proposes boundaries such as terminal workflow evidence, an explicit settled barrier, or a completed evidence session. An open range cannot become complete merely because a client stopped waiting.

The proposed API distinguishes a match, an inconclusive timeout, a completeness boundary reached without a match, and an integrity failure. Those outcomes tell a test different things. A gap might contain exactly the event being checked, so it cannot be ignored to produce a passing negative assertion.

Duplicates are different from gaps. If stable identity establishes that a second delivery repeats an already observed record, it doesn't invalidate the range. This is why delivery identity and workflow-local sequence are both necessary parts of the proposed contract.

The exact settlement mechanics are left to the feature specifications. That is an intentional unfinished part of the design, not permission for clients to substitute a sleep interval. Long-running and suspended workflows need bounded verification points without waiting for the entire workflow to terminate.

## Where should value redaction happen?

Redaction belongs before checkpoint and outbox persistence, not only in API responses. [Proposed ADR 0056](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0056-execution-evidence-value-capture-is-explicit-and-lean.md) makes actual values opt-in through a session profile and explicit subject allowlists. Metadata can remain useful without retaining every input, output, variable, or stimulus payload.

The proposed dispositions are `captured`, `redacted`, `omitted`, and `truncated`. A consumer should not infer which occurred from a missing value or JSON null. A module-wide size limit bounds captured values, while contributed sanitizers handle application-specific types and conventions.

<!-- [UNIQUE INSIGHT] -->

Moving sanitization earlier changes what can be exposed at all. Query-time redaction would leave sensitive material in checkpoint and delivery records. The design refuses that shortcut while also deferring a generalized classification-policy engine. It chooses a narrower explicit capture contract rather than pretending every governance requirement is already solved.

## What landed, and what remains a proposal?

[elsa-workflows/elsa-foundation#1139](https://github.com/elsa-workflows/elsa-foundation/pull/1139) merged the design on August 5. The [prototype report](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/reports/runtime-execution-evidence-seam-prototype.md) records deterministic replay and idempotent redelivery experiments, including a simulated failure after writing evidence. It also states that the disposable prototype code was not retained.

[ADR 0062](https://github.com/elsa-workflows/elsa-foundation/blob/928f05c99cdac6eda29820886295484d706a0563/docs/adr/0062-execution-evidence-starts-in-memory-and-adds-groundwork-durability.md) lays out an in-memory first slice and later Groundwork durability. An in-memory collector would not prove completeness across process failure. Nor is this work intended to replace the [logs](/blog/structured-logs-in-elsa-3-8) or [traces](/blog/opentelemetry-diagnostics-in-elsa-3-8) used for observability.

Building in the open includes publishing the questions a feature must answer before it earns trust. Here the most useful review isn't "can we record another event?" It's "when may a consumer conclude that an event did not happen?" The proposed contracts make that harder question explicit.
