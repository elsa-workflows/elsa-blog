---
title: "Building Elsa 4 · Week 8: The Engine Starts Executing"
slug: "building-elsa-4-week-8"
description: "Week 8 of Elsa 4: the runtime pipeline becomes the real execution spine (ADR 0029), the Elsa 3 control-flow activity library is ported and actually runs, and loops get per-iteration scopes."
publishedAt: "2026-07-03"
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
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 8: The Engine Starts Executing"
seoDescription: "How Elsa 4 flipped its runtime pipeline from dead scaffolding into the real execution spine, ported the Elsa 3 activity library, and gave loops per-iteration variable scopes."
excerpt: "For weeks the runtime described execution. This week it runs it."
---

# Building Elsa 4 · Week 8: The Engine Starts Executing

> **Key Takeaways**
> - Week 8 (2026-06-26 → 2026-07-03) flips the runtime pipeline from dead scaffolding into the real execution spine — a behavior-preserving "wrap, don't replace" move ([ADR 0029](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0029-runtime-execution-flows-through-the-pipelines.md), [spec 082](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/082-runtime-pipeline-execution-spine/spec.md)).
> - The Elsa 3 control-flow activity library lands and executes: For, ForEach, While, Do/DoWhile, Switch, Fork/Join, Break, and If ([#262](https://github.com/elsa-workflows/elsa-foundation/pull/262)–[#308](https://github.com/elsa-workflows/elsa-foundation/pull/308)).
> - Loops get correct semantics from a per-iteration variable scope ([ADR 0028](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0028-loop-body-runs-in-a-per-iteration-variable-scope.md)) built on stable scoped references ([ADR 0027](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0027-scoped-variable-references-include-declaring-scope.md)); mid-run scripts get a live expression carrier ([ADR 0030](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0030-runtime-expression-evaluation-uses-a-parameter-threaded-live-carrier.md)).

## Where we are on the road

For three weeks the Elsa 4 runtime has been *described* rather than *run*. [Week 5](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs) turned the runtime execution seam into an ordered spec program. [Week 7](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0021-copilot-provider-keeps-tool-mutation-elsa-owned.md) built AI authoring on top of that floor and spent most of its energy on the trust boundary. All of it produced contracts, slots, and specifications — not a running engine.

This week is the turn from description to execution. The runtime pipeline stops being scaffolding nobody invokes, the Elsa 3 activity library gets ported and actually runs through it, and the scoping rules that make loops correct land underneath. By the end you should understand how you flip a contract into a live execution path without a big-bang rewrite.

## The headline: the pipeline becomes the real execution spine

The runtime pipeline contract had existed for weeks, and nothing ever invoked it. That is the problem [ADR 0029](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0029-runtime-execution-flows-through-the-pipelines.md) (accepted 2026-07-02) fixes: it makes the pipeline the *real execution spine*, so a module that registers runtime middleware against a slot now actually runs during execution.

The ADR is blunt about what was wrong. The built-in middleware were "empty placeholders," the pipeline was "registered in no feature and no DI container," and real execution was inlined in scheduler work handlers — `WorkflowInvokeActivitySchedulerWorkHandler` alone is "~970 lines." The consequence is the sharpest phrase in the document: a module that registers an `IActivityRuntimeMiddleware` is "silently never run — a false affordance, and the same failure class as the JS expression pre-processors whose unregistered dependency makes them dead code."

The mechanism is deliberately small. ADR 0029 calls it "wrap, do not replace (Move 1)." A pipeline executor is invoked at the single handler-dispatch point in the drain coordinator:

```csharp
pipeline.InvokeAsync(context, () => handler.HandleAsync(workItem, cancellationToken))
```

The built-in slots stay pass-throughs and the handler stays intact as the `Invoke`-slot body, so the change is "behavior-preserving: with no non-placeholder middleware registered, execution is byte-for-byte what it is today." This is the minimum change that flips the pipeline "from dead scaffolding to a live, extensible spine." It is implemented in [spec 082](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/082-runtime-pipeline-execution-spine/spec.md), *Runtime Pipeline Execution Spine (ADR 0029 Move 1)*.

What does the decision rule out? Three things it explicitly rejected. Deleting the pipeline types and keeping execution handler-inlined — rejected because it "contradicts the modular charter." A single unified pipeline for both workflow and activity execution — rejected because the two context types "already separate the concerns." And replacing handler internals with per-slot middleware as the *first* move — rejected because it "forces the hazardous decomposition up front with no incremental safety net."

That last rejection is the interesting part: the ADR is defined as much by what it defers as what it commits. Move 1 makes the pipeline live; **Move 2** — relocating the handlers' inlined phases into slot-bound middleware — is endorsed as the direction but held back, because each phase "carries hazards that demand case-by-case design": atomic checkpoint-commit folding, transactional fault arms, control-leaf intents, and container scope-completion capture. The guardrail against backsliding is a test asserting a registered marker middleware "is *actually invoked* during a real work-item dispatch." Since the whole point is fixing "types that look wired but are not," that guardrail is the load-bearing bit.

## The activity library gets ported — and actually runs

A spine is only worth building if real activities run through it, and this is the week they arrive. The Elsa 3 control-flow library was ported wholesale in a two-day burst (2026-06-29 to 06-30), each activity as its own inspectable slice rather than a single dump.

The loops came first: [For](https://github.com/elsa-workflows/elsa-foundation/pull/265) (#265), [ForEach](https://github.com/elsa-workflows/elsa-foundation/pull/264) (#264), [While](https://github.com/elsa-workflows/elsa-foundation/pull/266) (#266), and the post-test [Do/DoWhile](https://github.com/elsa-workflows/elsa-foundation/pull/267) (#267). Then branching and parallelism: the [Switch](https://github.com/elsa-workflows/elsa-foundation/pull/290) multi-way branch (#290) and the [Fork + Join](https://github.com/elsa-workflows/elsa-foundation/pull/268) parallel activity (#268). Then the leaves: [If and Fault](https://github.com/elsa-workflows/elsa-foundation/pull/257) (#257), the [data leaves](https://github.com/elsa-workflows/elsa-foundation/pull/260) SetVariable/SetVariables/SetName/SetOutput (#260), the [code and I/O leaves](https://github.com/elsa-workflows/elsa-foundation/pull/262) Inline/WriteLines/ReadLine (#262), and [Finish/Complete + Correlate](https://github.com/elsa-workflows/elsa-foundation/pull/292) (#292).

Break is a good example of the port not being a copy-paste. It landed as its own activity ([#299](https://github.com/elsa-workflows/elsa-foundation/pull/299)), then immediately needed a fix to [propagate out of a Flowchart to end the enclosing loop](https://github.com/elsa-workflows/elsa-foundation/pull/304) (#304) — the kind of cross-activity control-flow edge that only surfaces when the activities genuinely execute.

The proof that the port is real and not just present is the acceptance keystone: [Section-1 activity-library acceptance](https://github.com/elsa-workflows/elsa-foundation/pull/269) (#269), which composes If + ForEach + SetVariable and runs it end-to-end against a server. This is the contrast with Elsa 3 that matters. The activity *concepts* are the same; what changed is that they now run on a clean seam instead of carrying Elsa 3's accidental runtime coupling with them.

## Loops and scopes get correct semantics

Loops are where variable scoping quietly goes wrong, so the port could not land without settling how iteration variables behave. [ADR 0028](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0028-loop-body-runs-in-a-per-iteration-variable-scope.md) (accepted 2026-06-29) says a loop body "runs its body once per pass inside a dedicated iteration scope … isolated per pass so two passes never observe each other's item."

The isolation rule is precise, and it rejects a tempting shortcut. Each pass "builds a fresh iteration scope — a distinct object with its own private value store." The engine records an `IterationId` on the scope, but the ADR is emphatic that this is "inert descriptive metadata — value resolution never consults it, and it is *not* the isolation key." In other words, you do not keep passes apart with an identifier; you keep them apart with separate value stores. Reusing one scope instance across passes "would defeat isolation."

That machinery is not new — it reuses the container-scoped variable model from [ADR 0027](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0027-scoped-variable-references-include-declaring-scope.md), rather than inventing a parallel one. ADR 0027's own headline decision is about stability: an authored variable expression stores "both the variable reference key and the declaring scope identity," so that "moving activities between containers should not silently retarget a saved expression to a different variable with the same reference key." When you move an activity out of the scope that declares a variable, the reference "is preserved and validation marks it invalid rather than retargeting it." Stable references over implicit rebinding — a small rule that prevents a whole class of silent corruption.

Studio grew the authoring surface to match, adding a [scoped-variable authoring UI](https://github.com/elsa-workflows/elsa-foundation-studio/pull/156) tied to ADR-0027 and making [Variables, Inputs, and Outputs editable in the Properties tab](https://github.com/elsa-workflows/elsa-foundation-studio/pull/152).

## A live expression carrier and typed arguments

Mid-run scripts need to read and write live workflow state, and the runtime had five dead code paths pretending to provide it. [ADR 0030](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0030-runtime-expression-evaluation-uses-a-parameter-threaded-live-carrier.md) (accepted 2026-07-02) resolves this by threading state through "a carrier passed as the `IExpressionExecutionContext` parameter, never from a DI-registered live context."

The problem is the same failure class as ADR 0029. Five JavaScript pre/post-processors took `IWorkflowExecutionContext` by constructor injection, "but `IWorkflowExecutionContext` is registered nowhere in `src/`." Because the container eagerly constructs every registered processor, one missing dependency "throws for the whole enumerable" — so "turning the JS runtime feature on in a host today would silently break all JavaScript evaluation." The fix re-points those five processors onto the live carrier and retires the DI-injected context. Crucially, script write-back "MUST NOT introduce a second persistence route; it reuses the atomic checkpoint fold" — the same checkpoint-commit boundary the durable-value write-back already uses.

Alongside it, the [typed argument model](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/081-typed-argument-model/spec.md) (spec 081) unified how activity arguments carry type information, landing on the backend as [#330](https://github.com/elsa-workflows/elsa-foundation/pull/330) and in Studio as [#180](https://github.com/elsa-workflows/elsa-foundation-studio/pull/180), which merges Variables, Inputs, and Outputs into one typed model.

## What this unlocks next

With Move 1 live, the deferred handler decomposition (Move 2) can now proceed incrementally — the ADR sequences it "easiest handler first," with the 970-line workflow-invoke handler last. Built-in phase behavior can migrate into named slots one guarded slice at a time, instead of a risky mass rewrite.

The week also produced a mirror. A formal [Elsa 4 architecture review (2026-07)](https://github.com/elsa-workflows/elsa-foundation/pull/369) landed as report #369 and immediately spun up a remediation program goal, [Elsa 4 Architecture Review Remediation](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/elsa-4-review-remediation.md), organizing the findings into a W1–W21 execution plan. The engine can finally be measured by running workflows rather than by reading specs — and the first thing the team did with that ability was audit itself.

## This week by the numbers

In the research window, `elsa-foundation` saw 180 non-merge commits, 119 merged PRs, and 1,616 files changed (+53,600 / −17,228). `elsa-foundation-studio` added 85 commits across 71 merged PRs. The window's new ADRs were [0026](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0026-activity-availability-policy-stack.md) through 0030 in the foundation — including the [activity availability policy stack](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0026-activity-availability-policy-stack.md) — and Studio's first ADR set, [0001–0006](https://github.com/elsa-workflows/elsa-foundation-studio/tree/main/docs/adr), which formalizes Slots/Contributions and names dispatched execution "[Runs](https://github.com/elsa-workflows/elsa-foundation-studio/blob/main/docs/adr/0005-use-runs-as-the-user-facing-workflow-execution-term.md)."

If you read only one thing this week, read [ADR 0029](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0029-runtime-execution-flows-through-the-pipelines.md). It is the moment the runtime stopped describing execution and started performing it.

## Follow along

The primary sources are public. Follow the [elsa-foundation repository](https://github.com/elsa-workflows/elsa-foundation), the [elsa-foundation-studio repository](https://github.com/elsa-workflows/elsa-foundation-studio), the [Elsa constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), and the [glossary](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/glossary). The best way to read Week 8 is not as a list of merged PRs. Read it as the week the seam finally ran.
