---
title: "Building Elsa 4 · Week 8: The Runtime Execution Seam Becomes Real"
slug: "building-elsa-4-week-8"
description: "Week 8 makes the Elsa 4 runtime pipeline the real execution spine (ADR 0029) and retires the DI-injected execution context for a parameter-threaded live carrier (ADR 0030)."
publishedAt: "2026-07-03"
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
  - "runtime-execution-seam"
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 Week 8: Runtime Execution Seam Becomes Real"
seoDescription: "Week 8 makes the Elsa 4 runtime pipeline the real execution spine (ADR 0029) and retires the DI-injected execution context (ADR 0030)."
excerpt: "The runtime execution seam stops being a spec program and starts being running code."
---

# Building Elsa 4 · Week 8: The Runtime Execution Seam Becomes Real

## Where we are on the road

Three weeks ago, the runtime execution seam was still a plan. Week 5 turned it into an ordered spec program — a numbered stack of slices describing how an Elsa 4 workflow should actually run. This week, those specs stop being documents and start being running code.

The force behind all of it is still constitutional. In [§E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), the runtime contract says that anything published as runnable *must* load and execute against only the runnable artifact and its configured runtime features — never the design model. The [runtime-execution-seam program goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/runtime-execution-seam.md) is where that contract turns into work. Week 8 is where two of its keystones landed.

> **Key Takeaways**
> - ADR 0029 flips the runtime pipeline from dead scaffolding into the real execution spine, wrapping the scheduler work handler so behavior is byte-for-byte preserved (Move 1).
> - ADR 0030 retires the DI-injected `IWorkflowExecutionContext`; expression state now travels as a parameter-threaded live carrier.
> - The Elsa 3 control-flow library ports onto the Elsa 4 harness (For/ForEach/While/Do/Switch/Break/Fork+Join), and container-scoped variables run end-to-end.
> - Studio grows a Slots-and-Contributions platform, a unified Weaver agent surface, and a shared code-editor substrate.

## The headline: the runtime pipeline becomes the real execution spine

[ADR 0029](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0029-runtime-execution-flows-through-the-pipelines.md) makes the runtime pipeline the real execution spine. The pipeline contract already existed — middleware interfaces, builders, slot definitions — but nothing invoked it. A module could register runtime middleware and it would silently never run. That is a false affordance: a type that advertises a capability it does not have.

The fix is deliberately small. The scheduler stays exactly as it is — the durable work-item queue, the drain coordinator, the checkpoint machinery are all correct and well tested. What changes is that the single handler-dispatch point in the drain coordinator now runs *through* a pipeline executor, with the existing work handler as the pipeline's `Invoke`-slot body. This is Move 1: wrap, do not replace.

Because the built-in slots stay pass-throughs, the change is behavior-preserving. With no non-placeholder middleware registered, execution is byte-for-byte what it was before. But the pipeline is now live and extensible: a module installs middleware through one mechanism (`AddActivityRuntimeMiddleware<T>`), placement is declarative rather than positional, and ordering is deterministic regardless of load order. Crucially, the change ships with a guardrail test that asserts a registered marker middleware is *actually invoked during a real dispatch* — so the pipeline can never quietly regress back to dead scaffolding. The implementation landed in [PR #357](https://github.com/elsa-workflows/elsa-foundation/pull/357), specified as [082-runtime-pipeline-execution-spine](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/082-runtime-pipeline-execution-spine) and accepted in [PR #354](https://github.com/elsa-workflows/elsa-foundation/pull/354).

## Why retire the execution context?

[ADR 0030](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0030-runtime-expression-evaluation-uses-a-parameter-threaded-live-carrier.md) retires the DI-injected `IWorkflowExecutionContext` and routes expression state through a carrier passed as the `IExpressionExecutionContext` parameter instead. It is the same failure class as the pipeline, wearing a different mask.

The JavaScript runtime feature registered six pre/post-processors. Five of them took `IWorkflowExecutionContext` by constructor injection — but that type is registered nowhere in `src/`. Because the processor list is resolved as an `IEnumerable`, MS DI eagerly constructs every implementation, so one missing dependency throws for the whole set. Turning the JS feature on in a host would silently break all JavaScript evaluation, taking the one working processor down with it.

The runtime already had the right shape. Its materialization-time processor takes no constructor dependencies: it reads variables, inputs, and outputs from the carrier it is handed. ADR 0030 ratifies parameter-threading as the single expression-state mechanism and adds a live execution-time carrier for `Run JavaScript`-style activities that read and write state mid-execution. JS variable write-back — the highest-risk surface — folds into the existing durable-value write-back on the checkpoint-commit boundary, never a second persistence route. `IWorkflowExecutionContext` as a DI service is retired for good. The decision came in via [PR #363](https://github.com/elsa-workflows/elsa-foundation/pull/363), specified as [083-runtime-execution-expression-carrier](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/083-runtime-execution-expression-carrier).

## The control-flow activity library lands

With the execution harness real, the Elsa 3 control-flow set could finally be ported onto Elsa 4. This week consolidated the composites into a single `Elsa.Activities.ControlFlow` project ([PR #320](https://github.com/elsa-workflows/elsa-foundation/pull/320)) and filled it out.

The looping composites all arrived: [For](https://github.com/elsa-workflows/elsa-foundation/pull/265), [ForEach](https://github.com/elsa-workflows/elsa-foundation/pull/264), [While](https://github.com/elsa-workflows/elsa-foundation/pull/266), and [Do/DoWhile](https://github.com/elsa-workflows/elsa-foundation/pull/267), each running against a reusable execution-test harness. [Switch](https://github.com/elsa-workflows/elsa-foundation/pull/290) added multi-way branching, [Parallel](https://github.com/elsa-workflows/elsa-foundation/pull/268) added Fork and Join, and [Break](https://github.com/elsa-workflows/elsa-foundation/pull/299) can now propagate out of a Flowchart to end the enclosing loop ([PR #304](https://github.com/elsa-workflows/elsa-foundation/pull/304)). Underpinning the loops is a [per-iteration loop variable scope primitive](https://github.com/elsa-workflows/elsa-foundation/pull/259), so each pass gets its own isolated variable frame.

## Variables that know their scope

Container-scoped variables now run end-to-end — isolated per execution and resolved through the live publish-to-run pipeline. This is the counterpart to the loop scope: variables declared on a container are visible to descendants, isolated between concurrent executions, and repaired when the structure is edited.

The work arrived as a sequence of small slices under the [scoped-variables umbrella](https://github.com/elsa-workflows/elsa-foundation/pull/220): a read path for Sequence containers ([#207](https://github.com/elsa-workflows/elsa-foundation/pull/207)), extension to Flowchart with a picker contract ([#208](https://github.com/elsa-workflows/elsa-foundation/pull/208)), per-execution value isolation ([#210](https://github.com/elsa-workflows/elsa-foundation/pull/210)), reference validation and repair after structural edits ([#211](https://github.com/elsa-workflows/elsa-foundation/pull/211)), JavaScript visible-scope helpers ([#212](https://github.com/elsa-workflows/elsa-foundation/pull/212)), and the backend wire contract for authoring ([#213](https://github.com/elsa-workflows/elsa-foundation/pull/213)). Container-scope completion and retention closed out via a capture policy ([#226](https://github.com/elsa-workflows/elsa-foundation/pull/226)).

## Studio grows a platform, not just screens

On the Studio side, the theme was infrastructure. Studio gained a Slots-and-Contributions extensibility platform — a registry and SDK vocabulary ([#96](https://github.com/elsa-workflows/elsa-foundation-studio/pull/96), [#99](https://github.com/elsa-workflows/elsa-foundation-studio/pull/99)) delivered as one platform ([#103](https://github.com/elsa-workflows/elsa-foundation-studio/pull/103)) — so dashboards, diagnostics, and expression editors become contributions rather than hardcoded screens.

Weaver, the in-Studio agent, collapsed into a single unified assistant surface ([#140](https://github.com/elsa-workflows/elsa-foundation-studio/pull/140)) that now receives the live workflow graph ([#151](https://github.com/elsa-workflows/elsa-foundation-studio/pull/151)) and offers applyable suggestions with an Autopilot mode ([#171](https://github.com/elsa-workflows/elsa-foundation-studio/pull/171)). A shared internal code-editor substrate ([#93](https://github.com/elsa-workflows/elsa-foundation-studio/pull/93), [#138](https://github.com/elsa-workflows/elsa-foundation-studio/pull/138)) now backs JavaScript and Liquid expression editing and the Extension Builder. Rounding it out: a scoped-variable authoring UI matching the backend contract ([#156](https://github.com/elsa-workflows/elsa-foundation-studio/pull/156)) and a broad editor UX pass — palette search, tabs, auto-layout, undo/redo, and an instance Timeline ([#147](https://github.com/elsa-workflows/elsa-foundation-studio/pull/147)).

## The numbers behind the week

For an honesty check on velocity: across 2026-06-26 to 2026-07-03, the foundation repo saw 180 non-merge commits and 119 merged pull requests, changing 1,616 files (+53,600 / -17,228). Studio added 85 commits across 71 merged PRs.

Those numbers are only sane because of how the work is done: a single maintainer directing AI agents — the `claude/`, `codex/`, and Weaver-authored branches visible throughout the merge history. Building Elsa 4 in the open is also an experiment in building it *with agents*, and the pipeline and expression-context decisions were both shaped to survive that pace without accumulating false affordances.

## What this unlocks next

With Move 1 done, Move 2 becomes tractable. Move 2 — relocating the handler's inlined phases into slot-bound middleware — was deliberately deferred, because each phase carries its own hazard: atomic checkpoint folding, transactional fault arms, control-leaf intents, container scope-completion capture. Now it can proceed incrementally, easiest handler first, instead of as one risky rewrite. ADRs 0031 and 0032 are already queued further along the seam.

On the design side, the [typed argument model](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/081-typed-argument-model) ([PR #330](https://github.com/elsa-workflows/elsa-foundation/pull/330)) gives authored arguments a real type descriptor registry — the authoring counterpart to the runtime carrier. Next week continues down the same road: making the seam not just real, but ergonomic.

---

### Sources

All links verified against `main` on 2026-07-06.

- Elsa Workflow Engine Constitution §E2.6 — https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md
- Program goal: Runtime Execution Seam — https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/runtime-execution-seam.md
- ADR 0029 — Runtime Execution Flows Through The Workflow And Activity Pipelines — https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0029-runtime-execution-flows-through-the-pipelines.md
- ADR 0030 — Runtime Expression Evaluation Uses A Parameter-Threaded Live Carrier — https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0030-runtime-expression-evaluation-uses-a-parameter-threaded-live-carrier.md
- Spec 082 — Runtime Pipeline Execution Spine — https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/082-runtime-pipeline-execution-spine
- Spec 083 — Runtime Execution-Time Expression Carrier — https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/083-runtime-execution-expression-carrier
- Spec 081 — Typed Argument Model — https://github.com/elsa-workflows/elsa-foundation/tree/main/specs/081-typed-argument-model
- Foundation PRs: #354, #357, #363, #330, #320, #268, #290, #299, #304, #264, #265, #266, #267, #259, #220, #207, #208, #210, #211, #212, #213, #226 — https://github.com/elsa-workflows/elsa-foundation/pulls
- Studio PRs: #96, #99, #103, #140, #151, #171, #93, #138, #156, #147 — https://github.com/elsa-workflows/elsa-foundation-studio/pulls
