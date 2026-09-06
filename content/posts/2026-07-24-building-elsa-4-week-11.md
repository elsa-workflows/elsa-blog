---
title: "Building Elsa 4 · Week 11: Shortcuts with Guardrails"
slug: "building-elsa-4-week-11"
description: "Week 11 cuts ReplaySafe scheduler dispatches while preserving durable fallback paths, and makes BPMN race cleanup and its limitations explicit in source."
publishedAt: "2026-07-24"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
featuredImage: "../assets/2026-07-24-building-elsa-4-week-11/featured.png"
featuredImageAlt: "A guarded glass shortcut runs above an intact sequence of discrete scheduler stages before both paths rejoin."
excerpt: "The runtime gets a faster path, but the interesting part is where it refuses to take it."
---

# Building Elsa 4 · Week 11: Shortcuts with Guardrails

## Less machinery, not less responsibility

In July 2026, the experiment recorded in [Foundation's ADR 0047](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/docs/adr/0047-replaysafe-activities-execute-as-fused-hops-with-precomputed-routing.md) reduced scheduler dispatches from 58 to 5 for its ReplaySafe hot-loop workload. That's a specific dispatch-count result, not a claim that every workflow became eleven times faster. The useful question is what allowed those dispatches to disappear.

Week 11 covers **July 17 through July 23**, the window `[2026-07-17, 2026-07-24)`. Two threads make a useful pair: optimizing repeatable runtime work, and making BPMN event races deal with real suspended children. Both force the engine to say where its shortcuts stop.

> **Key Takeaways**
> - The recorded ReplaySafe experiment used 5 dispatches instead of 58; that isn't a general latency benchmark.
> - Fusion requires an explicit activity contract and a live coalescing session.
> - The discrete execution path remains available.
> - BPMN race tests make cleanup guarantees, including their fault-path limits, inspectable.

## When may Elsa fuse scheduler stages?

Fusion is conditional, not a replacement execution model. The [implemented driver](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/src/Elsa/Workflows/Runtime/Services/ReplaySafeFusionDriver.cs) checks that fusion is enabled, the node declares `SideEffectProfile.ReplaySafe`, the node isn't an intrinsic, and a live coalescing session belongs to the execution. Without those conditions, it doesn't take the fused path.

The schedule, start, and invoke stages still have jobs to do. The optimization runs their existing work within one dispatch rather than repeatedly returning through queue and drain machinery. Completion propagation can also run inline when the driver can establish that the next work belongs to an eligible continuation.

Why require a declaration? [ADR 0047](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/docs/adr/0047-replaysafe-activities-execute-as-fused-hops-with-precomputed-routing.md) draws the line around replay semantics. External or unmarked activities keep their existing boundaries. Treating an arbitrary external effect as safely repeatable would turn a performance assumption into a correctness change.

This builds on the [runtime execution seam described in Week 8](/blog/building-elsa-4-week-8). The improvement isn't "trust the fast path." It's "make the fast path prove that this activity and this execution context qualify."

## What remains when the shortcut stops?

The ordinary discrete path remains the fallback. The [fusion driver's completion pump](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/src/Elsa/Workflows/Runtime/Services/ReplaySafeFusionDriver.cs) uses the existing handler, queue, and outbox machinery in drain order. Work it cannot safely fuse stays available to the outer drain loop rather than disappearing into a separate optimization-only state machine.

The boundaries are concrete. Join edges, child-fault evaluations, non-ReplaySafe parents, workflow-tail work, and bookmark or cancellation work can end the inline cascade. The implementation also guards re-entry so a long chain doesn't turn the optimization into unbounded recursive calls. These details are more useful than a broad claim that the scheduler is now faster.

<!-- [UNIQUE INSIGHT] -->

The architectural constraint is that dispatch locality must not become a second recovery protocol. [ADR 0047's guardrails](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/docs/adr/0047-replaysafe-activities-execute-as-fused-hops-with-precomputed-routing.md) require equivalent durable state with fusion enabled or disabled and crash-convergence coverage. The repository contains [fusion guardrail tests](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/tests/Elsa/Activities/Runtime/Tests/ReplaySafeFusionGuardrailTests.cs). Their existence is evidence of the intended comparison, not a claim that this journal reran them.

## Why derive routing from an immutable graph?

Routing relationships that are determined by the executable don't need a fresh graph walk for every completion. [ADR 0047's routing decision and resolution](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/docs/adr/0047-replaysafe-activities-execute-as-fused-hops-with-precomputed-routing.md) choose derived routing tables, recomputed on materialization. That keeps the persisted schema and content hash unchanged while making the routing knowledge reusable.

The distinction between the proposal's name and its final placement matters. "Publish-time routing tables" describes moving knowledge out of repeated runtime traversal. The documented implementation uses a materialization-time memo rather than adding another independently versioned payload to storage. [elsa-workflows/elsa-foundation#947](https://github.com/elsa-workflows/elsa-foundation/pull/947) is the merged routing slice; [elsa-workflows/elsa-foundation#969](https://github.com/elsa-workflows/elsa-foundation/pull/969) completes the inline completion work.

## Does winning a BPMN race cancel every wait?

The successful race path tears down losing waits, but the historical fault path has a narrower guarantee. [The event-based gateway spec](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/specs/119-bpmn-event-based-gateway/spec.md) distinguishes canceling a logical token from canceling the runtime subtree that owns a bookmark or timer. Those aren't interchangeable operations.

An event-based gateway arms alternative catch events. The first catch wins and routes its path; losing catches need to stop participating. Their suspended child executions make this more than changing a token's status in a diagram. The happy path uses the runtime child-subtree cancellation seam to remove the losing work.

The [tests at this week's snapshot](https://github.com/elsa-workflows/elsa-foundation/blob/67efaa76b719301c16a1fc017bdc93e17e660515/tests/Elsa/Activities/Bpmn/Tests/BpmnEventBasedGatewayTests.cs) make the scope unusually clear. They cover first-catch cleanup, canceling two losers in a three-member race, and absorbing racing completions. They also explicitly cover a winner-routing fault that doesn't stage subtree cancellation, and termination that cancels race members logically without that teardown.

<!-- [UNIQUE INSIGHT] -->

That limitation belongs in the story. The spec accepts logical-only cancellation on those paths for this slice; it doesn't claim universal cleanup. Describing the feature simply as "first catch wins and cancels everything else" would erase the distinction the source goes out of its way to preserve. Building in the open should make these edges easier to see, not smooth them away.

## Keeping the evidence inspectable

The pinned ADR still opens with a planning-era statement that nothing is implemented yet, while its follow-up records shipped work. The merged PRs and driver show the implementation. Reading those together is necessary; neither an old status sentence nor a commit title alone provides a reliable weekly account.

That is the practical value of the public chain. Contributors can inspect eligibility guards, fallback behavior, the recorded experiment, and the BPMN exception cases separately. The runtime has a shorter path through eligible work. The journal's job is to show the boundaries that make that shorter path acceptable.
