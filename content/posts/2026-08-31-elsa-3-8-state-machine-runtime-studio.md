---
title: "How Elsa 3.8 State Machines Run: Runtime and Studio"
slug: "elsa-3-8-state-machine-runtime-studio"
description: "Elsa 3.8 defines a 7-step StateMachine transition lifecycle. Learn how competing triggers, persistence, automatic cycles, and Studio authoring behave."
publishedAt: "2026-08-31"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "state-machines"
  - "workflow-runtime"
  - "elsa-studio"
  - "persistence"
featuredImage: "../assets/2026-08-31-elsa-3-8-state-machine-runtime-studio/featured.png"
featuredImageAlt: "Soft 3D illustration of blue state nodes connected by a transition path with entry, condition, action, and exit markers"
seoTitle: "How Elsa 3.8 State Machines Run: Runtime and Studio"
seoDescription: "Elsa 3.8 defines a 7-step StateMachine transition lifecycle. Learn how competing triggers, persistence, automatic cycles, and Studio authoring behave."
redirectFrom: []
related:
  - "suspended-workflows-and-elsa-upgrades"
  - "workflow-alterations-in-elsa-3-8"
  - "why-elsa-payloads-change-shape-after-persistence"
---

# How Elsa 3.8 State Machines Run: Runtime and Studio

The useful way to understand Elsa's StateMachine work for the 3.8 line is to follow one transition from beginning to end. A transition is not just an arrow between two states. It is a runtime contract: source Entry, trigger, condition, source Exit, transition actions, and target Entry.

That contract is now explicit in the [Elsa Core StateMachine changes](https://github.com/elsa-workflows/elsa-core/pull/8010) and reflected in [Elsa Studio's StateMachine authoring work](https://github.com/elsa-workflows/elsa-studio/pull/958). It gives you a practical way to diagnose why a transition did—or did not—happen.

> **Key Takeaways**
> - A successful transition follows `Entry → Trigger → Condition → Exit → Action → target Entry`, then schedules the target state's outbound work.
> - A false condition on one eventful transition re-arms that trigger without discarding distinct competing triggers.
> - Triggerless cycles yield through the scheduler, and transition continuation identity is persisted in declaration order.
> - Studio now presents transitions as **WHEN → ONLY IF → THEN → TO**, while preserving condition data it cannot currently edit.

> **Availability:** The Core and Studio changes discussed here merged into the `release/3.8.0` branches on August 30-31, 2026, after the respective [Core](https://github.com/elsa-workflows/elsa-core/releases/tag/3.8.0-rc2) and [Studio](https://github.com/elsa-workflows/elsa-studio/releases/tag/3.8.0-rc2) 3.8.0 RC2 tags. They are not in those RC2 packages, and there is no final 3.8.0 package to point to yet. Evaluate them from post-merge `release/3.8.0` builds or aligned Feedz packages. Keep Core and Studio versions aligned while testing.

This is an implementation guide, not a release-note inventory. For broader preview context, see [Elsa 3.8 Preview 1](/blog/elsa-3-8-preview-1). For persisted runtime-state upgrades, see [Suspended Workflows Are Runtime State, Not Just Definitions](/blog/suspended-workflows-and-elsa-upgrades).

## What is the StateMachine transition lifecycle?

The runtime now makes the order of work concrete. For a transition from a source state to a target state, the lifecycle is:

1. The source state's Entry activity completes.
2. The transition's Trigger completes. A transition without a trigger is immediately eligible.
3. The transition's Condition runs. A transition without a condition is treated as true.
4. The source state's Exit activity completes.
5. The transition's Action activity runs.
6. The target becomes current and its Entry activity runs.
7. Outbound transitions from the target are scheduled.

The [accepted StateMachine lifecycle decision](https://github.com/elsa-workflows/elsa-foundation/issues/1457) names the boundaries in the same order the runtime implements them. Exit is not an informal visual step, and Action is not part of source Entry: each is a separate point where activities can suspend, complete, or fail.

If an approval transition sends a notification, the notification belongs to transition Action. If it needs several actions, model them as a nested `Sequence` so the action boundary remains one transition step. Once the target becomes current, its Entry is a new state boundary.

The runtime also evaluates triggerless transitions immediately after entering a state, before it waits for eventful alternatives. This makes an automatic branch a continuation of the state entry rather than an event that happens later by coincidence. A condition still decides whether that triggerless branch is eligible.

## What happens when transitions compete?

With more than one outbound transition, one branch may wait for an event while another is triggerless and checks a condition. A rejected branch should not erase other work that is still valid.

If a triggerless condition is false while an eventful alternative is available, the eventful transition remains usable. If every triggerless option is false, Elsa leaves the state active without spinning forever.

When an eventful transition receives its trigger but its condition is false, Elsa re-arms that trigger without canceling distinct competitors. A later event can still select another transition from the same state.

When a transition is accepted, the runtime cancels competing transitions with distinct trigger identities before running source Exit, transition Action, and target Entry. The trigger identity therefore matters.

Do not reuse one Trigger activity across multiple transitions. The runtime rejects shared trigger identities and requires each transition to have its own trigger activity with a unique ID. Configure each trigger's event data consistently.

The stored continuation identifies a transition by declaration order. That is a persistence detail, not a documented business-priority system.

## Why do automatic cycles need scheduler care?

An automatic transition can point back to a state that immediately offers another automatic transition. Executing that cycle as one call stack would make the runtime vulnerable to runaway recursion.

The runtime detects an automatic cycle and queues an automatic-transition continuation instead of repeatedly nesting execution. The scheduler can yield between iterations. A logically valid graph can still need an operational guard if it never reaches an eventful wait.

Use conditions to make automatic loops converge. Test the false path and the eventual eventful path; a diagram does not make an always-true cycle safe.

The runtime also preserves callback identity and queued scheduling metadata when an instance is suspended and resumed, so the continuation retains its meaning.

Reordering transitions is therefore compatibility-sensitive for suspended instances: a stored continuation number can refer to a different transition after the reorder. Test representative records, drain them, or plan a migration. The guidance in [Suspended Workflows and Elsa Upgrades](/blog/suspended-workflows-and-elsa-upgrades) applies directly here.

## How does Studio expose the same model?

Studio gives the transition a semantic shape instead of making users infer the runtime from an arrow:

| Runtime concept | Studio transition surface |
| --- | --- |
| Trigger | **WHEN** |
| Condition | **ONLY IF** |
| Transition actions | **THEN** |
| Target state | **TO** |

The [Studio implementation](https://github.com/elsa-workflows/elsa-studio/pull/958) adds searchable Trigger and Action pickers, nested Sequence editing, and a Boolean condition editor. The [branch chooser](https://github.com/elsa-workflows/elsa-studio/pull/946) supports StateMachine branches in the embedded designer.

The Boolean editor understands canonical literals, older wrapped `Input<bool>` data, and safe shorthand forms. An explicit edit emits canonical data; an unchanged value returns the original data. Unknown providers, unavailable activity types, and malformed conditions are preserved instead of silently rewritten.

That matters when the server has extensions the designer does not. If Studio cannot render a condition, identify the missing extension or data issue before making a deliberate change.

## How should you trial this StateMachine work?

Use a small workflow that exercises the boundaries:

- Build from a post-merge `release/3.8.0` Core and Studio revision, or use aligned Feedz packages. Do not infer availability from 3.8.0 RC2.
- Create one state with an automatic transition and an eventful alternative. Make the automatic condition false, send the event, and verify the alternative works.
- Give every transition its own trigger. Reject one eventful condition, then send a competing event and verify it remains available.
- Add a transition Action that can suspend, resume after persistence, and verify target state, continuation, and outbound scheduling.
- Test a bounded automatic loop and its false or eventful exit path. Never deploy an unbounded always-true cycle.
- Save a workflow with a condition Studio cannot resolve and confirm unknown data remains intact before editing it.
- Before changing the order of transitions in a live definition, test suspended instances or choose a drain/migration plan.

These checks complement the operational controls in [Workflow Alterations in Elsa 3.8](/blog/workflow-alterations-in-elsa-3-8); an alteration does not replace understanding persisted continuation.

## Frequently asked questions

### Does a transition Action run before the source state's Exit?

No. The source Exit completes before the transition Action starts. The target then becomes current and runs its Entry activity.

### What if a transition condition is false?

A false triggerless condition leaves the state active and permits an eventful alternative to win. A false eventful condition re-arms that rejected trigger and preserves distinct competing triggers.

### Can multiple transitions share one Trigger activity?

No. The runtime rejects shared trigger identities. Use a separate trigger activity with a unique ID for each transition.

### Is this behavior in Elsa 3.8.0 RC2?

No. The changes merged to `release/3.8.0` after RC2. Use a later branch build or aligned Feedz packages while waiting for an official package that contains them.

## The practical takeaway

For Elsa StateMachines, the arrow is only the visible part of the contract. The durable behavior is the ordered lifecycle around it: source Entry, trigger, condition, source Exit, transition Action, target Entry, and scheduled outbound work.

That model gives you a reliable way to design and debug branches. Give triggers unique identities, preserve competing event paths when conditions reject a branch, make automatic cycles converge, and treat transition reordering as a persisted-state change. Studio's **WHEN → ONLY IF → THEN → TO** surface now mirrors that same reasoning, while its lossless condition editing protects workflows that use extensions the designer does not yet understand.

## Primary sources

- [Elsa Core PR #8010: StateMachine runtime semantics and persistence fixes](https://github.com/elsa-workflows/elsa-core/pull/8010)
- [Elsa Foundation issue #1457: accepted StateMachine lifecycle decision](https://github.com/elsa-workflows/elsa-foundation/issues/1457)
- [Elsa Studio PR #958: StateMachine authoring and lossless Boolean editing](https://github.com/elsa-workflows/elsa-studio/pull/958)
- [Elsa Studio PR #946: embedded branch chooser](https://github.com/elsa-workflows/elsa-studio/pull/946)
- [Microsoft Workflow Foundation state machine workflows](https://learn.microsoft.com/en-us/dotnet/framework/windows-workflow-foundation/state-machine-workflows)

Sources were reviewed on August 31, 2026.
