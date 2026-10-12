---
title: "Why Elsa 4 Can Print the Same Console Line Twice"
slug: "elsa-4-replay-safe-console-output"
description: "Elsa 4 now treats WriteLine as safe to replay. Learn what repeated console output means for durable checkpoints, crash recovery, and custom activity design."
publishedAt: "2026-10-11"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "elsa-4", "dotnet", "durability", "custom-activities"]
featuredImage: "../assets/elsa-4-replay-safe-console-output/featured.png"
featuredImageAlt: "A replay loop crosses blue workflow blocks between durable checkpoints, with two matching output slips."
seoTitle: "Elsa 4 Replay Safety: Why Console Lines Can Repeat"
seoDescription: "Elsa 4 now treats WriteLine as safe to replay. Learn what repeated console output means for durable checkpoints, crash recovery, and custom activity design."
related:
  - "building-elsa-4-week-11"
  - "suspended-workflows-and-elsa-upgrades"
---

# Why Elsa 4 Can Print the Same Console Line Twice

A workflow prints a line, the host crashes, and recovery prints it again. Has the workflow completed the same step twice?

The console alone cannot answer that. In the evolving Elsa 4 runtime, repeating a console write can be an intentional part of recovering work that had not reached its next durable checkpoint.

Merged on October 10, 2026 (UTC), [Foundation PR #2610](https://github.com/elsa-workflows/elsa-foundation/pull/2610) changed `WriteLine` and `WriteLines` from `External` to `ReplaySafe`. That small classification change makes a useful design question concrete: **which effects are acceptable to repeat after a crash?**

This article describes Elsa 4 source behavior at [commit `24533cfe`](https://github.com/elsa-workflows/elsa-foundation/commit/24533cfe6fcdd000f518d1855a525cfe6b37d6f9). Elsa 4 is under development; the [rebuild's background](/blog/why-elsa-4-rebuilding-a-dotnet-workflow-engine) explains the wider direction. These attributes and checkpoint policies are not configuration instructions for Elsa 3.9.

> **Key Takeaways**
> - With coalesced persistence, `ReplaySafe` lets eligible work repeat after a crash before its next durable flush.
> - Console output can repeat even when the recovered workflow state is correct.
> - Unmarked activities retain the conservative `External` profile.
> - Checkpoint cadence and activity replay safety are separate choices; mandatory durability boundaries still apply.

## Why is a console write safe to replay?

Elsa 4's `WriteLine` writes its materialized text input to the console and returns a constant completion result. Repeating the body prints another line, but produces the same activity result. The [implementation comment](https://github.com/elsa-workflows/elsa-foundation/blob/24533cfe6fcdd000f518d1855a525cfe6b37d6f9/Essentials/src/Activities/Primitives/Activities/WriteLine.cs) explicitly accepts that duplicated output after a crash before the next commit.

Notice what this permits. `ReplaySafe` does not mean the activity has no observable effect. A person watching stdout can see the second line. It means that this effect is accepted as harmless to repeat under the activity's contract.

That is a deliberate change from the earlier classification. PR #2610 records that previous design documents kept console writes `External` because their output was observable. The current implementation accepts duplicate diagnostic output. `ReadLine` remains `External`: running it again can consume a different input and return a different result.

<!-- [UNIQUE INSIGHT] -->

The useful distinction is between an effect being **visible** and an effect being **safe to repeat**. Logging a progress message and charging a payment are both visible. They do not justify the same replay policy.

Replay safety also says nothing about whether the text is appropriate to print. At this source snapshot, [issue #2609](https://github.com/elsa-workflows/elsa-foundation/issues/2609) remains open because console activities can print resolved secret-bound inputs. Keep secrets out of these diagnostic messages.

## What does a checkpoint change?

A durable checkpoint establishes the runtime state recovery can rely on. With coalesced persistence, eligible intermediate changes can stay in a working set until a flush commits them together. If the process dies first, recovery may repeat work since the last durable boundary. Console output already emitted cannot be rolled back with that working set.

Consider this simplified sequence. It illustrates a replay window, not a dump of Elsa's internal scheduler commands:

```text
Durable checkpoint A
  -> calculate a value
  -> WriteLine("Value calculated")
  -> host crashes before checkpoint B commits

Recovery from A
  -> calculate the value again
  -> WriteLine("Value calculated") again
  -> commit checkpoint B
```

There are two printed lines. That is not evidence of two durable completions. The first line was emitted before the state in this example became durable.

The reverse inference is unsafe too: a missing console line does not prove that nothing committed. Use persisted runtime state when investigating workflow progress. Console output is useful context, but it is not a transaction receipt. The broader distinction between a workflow definition and its [persisted runtime state](/blog/suspended-workflows-and-elsa-upgrades) matters here.

## How do cadence and replay safety work together?

Cadence decides when eligible checkpoints flush. The activity profile decides whether its pre-activation attempt claim may be deferred. Under the [coalescing policy](https://github.com/elsa-workflows/elsa-foundation/blob/24533cfe6fcdd000f518d1855a525cfe6b37d6f9/Essentials/src/Workflows/Runtime/Elsa.Workflows.Runtime/Services/Coalescing/CoalescingRuntimeCheckpointPersistencePolicy.cs), a `ReplaySafe` claim can defer; an `External` or unmarked activity keeps its claim durable before the body runs.

`Deferred` means folded into a later commit. It does not mean discarded. Suspension, bookmark creation, incidents, cancellation, and workflow completion retain mandatory flush boundaries. A configured segment cap also bounds how many checkpoints accumulate before an intermediate flush.

| Choice | What it controls | What it does not promise |
| --- | --- | --- |
| `Immediate` cadence | Immediate checkpoint persistence | A transaction spanning an external API |
| `Coalesced` cadence | Batching eligible intermediate checkpoint state | Permission to defer mandatory boundaries |
| `ReplaySafe` activity profile | Deferral of its attempt claim under coalescing | Exactly one call to the activity body |
| `External` activity profile | A durable attempt claim before activation | Exactly-once execution of a remote business effect |

The runtime's [immediate persistence policy](https://github.com/elsa-workflows/elsa-foundation/blob/24533cfe6fcdd000f518d1855a525cfe6b37d6f9/Essentials/src/Workflows/Runtime/Elsa.Workflows.Runtime/Services/Checkpoints/ImmediateRuntimeCheckpointPersistencePolicy.cs) still asks for immediate persistence. Adding `ReplaySafe` does not, by itself, switch a host or workflow to coalesced cadence.

There is also an inspection tradeoff. If a replay-safe body runs and crashes before its claim becomes durable, that attempt may leave no persisted retry record. PR #2610 calls this out directly. Repeated work can be acceptable while the lost attempt visibility still matters to an operator.

## What should custom activity authors declare?

Start with the conservative default. The [activity profile attribute](https://github.com/elsa-workflows/elsa-foundation/blob/24533cfe6fcdd000f518d1855a525cfe6b37d6f9/Essentials/src/Activities/Runtime/Core/Attributes/ActivitySideEffectProfileAttribute.cs) treats absence as `External`. Its declaration is folded into the pinned activity contract at publication. A profile is part of the behavior the runtime relies on, rather than a hint that an activity would benefit from running faster.

For an Elsa 4 activity whose replay behavior you have established, this incomplete attribute fragment shows the imports and declaration to add to its class:

```csharp
using Elsa.Activities.Runtime.Core.Attributes;
using Elsa.Activities.Runtime.Core.Models;

// Apply to the activity class only after reviewing its replay behavior:
[ActivitySideEffectProfile(SideEffectProfile.ReplaySafe)]
```

The [earlier scheduler-fusion article](/blog/building-elsa-4-week-11) explains another optimization that depends on the same explicit contract and additional runtime eligibility checks.

Before making that declaration, work through three questions:

1. **Can the body reproduce its result?** Include input handling and any dependencies it reads, not just the final return statement.
2. **Can every effect repeat acceptably?** Consider files, messages, remote calls, counters, and console output separately.
3. **Is losing an uncommitted attempt record acceptable?** A harmless repeated calculation may still have operational inspection requirements.

<!-- [UNIQUE INSIGHT] -->

An idempotent-looking API call is not enough evidence on its own. Establish how its operation key survives recovery, how the receiver handles duplicates, and whether a repeated call returns a compatible result. Until that complete behavior is clear, retain `External` and address the external system's idempotency explicitly.

## How can you test the distinction?

Test recovery across the flush boundary, rather than only invoking an activity twice in one process. For a replay-safe activity, exercise a crash after its body has run but before the coalesced segment commits. Then recover from durable storage and check the result and effects separately.

For the console example, a useful test allows the diagnostic line to repeat while checking that the recovered workflow reaches the expected durable state. A stronger custom-activity test also checks downstream decisions, persisted outputs, and any external records. Counting console lines alone tests the wrong guarantee.

Compare that with a crash after a checkpoint has committed. Recovery uses that committed state as its anchor; work after the anchor can still replay. A checkpoint can also capture a running activity, rather than its completion. Foundation's [fused recovery fix, PR #2511](https://github.com/elsa-workflows/elsa-foundation/pull/2511), addresses precisely that case: preserving durable work that can resume a running replay-safe activity.

That PR's recovery tests use persisted SQLite snapshots and fresh providers, not OS process kills. They verify a recovery mechanism without establishing exactly-once body execution.

These are suggested test scenarios, not a claim that this article ran a crash harness. The source and merged fixes establish the mechanism; your activity and persistence composition need their own recovery evidence.

When a line appears twice, ask which state was durable at the crash, which activity contract was pinned, and which cadence the execution used. Those answers tell you far more than the duplicate line does.
