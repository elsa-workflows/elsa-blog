---
title: "Building Elsa 4 · Week 2: Porting Features and Killing the Provider Zoo"
slug: "building-elsa-4-week-2"
description: "Week 2 of Elsa 4: HTTP, JavaScript, and FastEndpoints land in elsa-foundation — and the provider zoo is replaced by domain event handlers via Mediator."
publishedAt: "2026-05-22"
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
seoTitle: "Building Elsa 4 · Week 2: Porting Features and Killing the Provider Zoo"
seoDescription: "Week 2 of Elsa 4 dev journal: HTTP, JavaScript, and FastEndpoints ported from elsa-core, and the provider-zoo anti-pattern replaced by domain event handlers."
---

> **Key Takeaways**
> - Week 2 (2026-05-15 → 2026-05-22) is the first real feature migration: HTTP, JavaScript, and FastEndpoints land in `elsa-foundation`.
> - The headline architectural decision is replacing the **provider zoo** — a tangle of `IFunctionsProvider`, `IFunctionDeclarationsProvider`, `IObjectProvider`, and five more interfaces — with domain event handlers wired through Mediator ([commit a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb7497ed205e589ad4fb27b1a7d20203fe)).
> - The HTTP port deliberately leaves runtime-coupled services deferred — an early test of the Design/Runtime boundary holding under migration pressure.
> - Four non-merge commits, zero merged PRs, one contributor (Joey Barten) — a build week, not a merge week.

## Where we are on the road

Week 1 wrote the rules: a [two-layer constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), clean primitives, and a first pass at separating persistence. Week 2 is where those rules face their first real test — porting working features from `elsa-core` into a codebase that, by constitutional rule, cannot repeat `elsa-core`'s mistakes.

The two most important questions this week are: *does the JavaScript subsystem's extension model re-leak the provider zoo?* And *does the HTTP port respect the Design/Runtime split when some services were never split to begin with?* The answer to the first is no, after a course correction. The answer to the second is: not yet, and that deferred answer is itself a sign of healthy discipline.

## The headline decision: replacing the provider zoo

In `elsa-core`, the JavaScript expression engine was extended through a set of named provider interfaces: `IFunctionsProvider`, `IFunctionDeclarationsProvider`, `IObjectProvider`, `ITypeAliasRegistry`, `IVariableDeclarationProvider`, `ITypeDescriptorProvider`, and `IExecutionContextFactory`, plus pre- and post-processor hooks. Any feature that needed to inject JavaScript context had to know about and implement one or more of these contracts. The JavaScript core, in turn, had to know about all of them.

That is the provider zoo. And it is a precise re-run of anti-pattern #1 from the [elsa-core baseline case study](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md): a god package whose interface surface grows without limit because anyone who wants to extend anything has to add another provider contract.

The first pass at porting JavaScript to `elsa-foundation` preserved this structure — it was the obvious move when you are lifting code wholesale from an existing system. Then Joey Barten met with Sipke Schoorstra, and the decision was clear: use domain event handlers via Mediator instead.

The result, landed in [commit a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb7497ed205e589ad4fb27b1a7d20203fe), is a significant structural simplification. The entire provider zoo is gone. In its place:

- **Two events** in `Elsa.Expressions.JavaScript.Core/Events/`: `OnEvaluatingScript` and `OnScriptEvaluated` — raised when a script is about to run and after it finishes.
- **One event** in the new `Elsa.Expressions.JavaScript.Rendering.Core`: `OnDeclarationsDocumentGenerating` — raised when TypeScript declaration output is being assembled.
- **~20 `IDomainEventHandler<T>` implementations** spread across 8 feature modules, each owning the knowledge it contributes, rather than a central registry owning everything.

The JavaScript core now knows about events, not about the features that handle them. A feature that needs to inject a function into the JavaScript engine registers an event handler. The JavaScript core fires the event; the handler populates it. No new interface in the core is needed. The extension contract is the event shape, not a new provider interface.

This is the "thin protocol" principle ([README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md)) applied at the expression engine layer. The core exports a narrow seam — the events — and feature modules extend through it without the core accumulating provider registrations. The final JINT engine adaptor commit ([a9d0697f](https://github.com/elsa-workflows/elsa-foundation/commit/a9d0697f2adb43e855b9f0a243f1347d3271361b)) wires the remaining pieces: the JINT engine itself now registers functions and gets/sets values through the event model, and the missing services for `DomainEventSender` are registered.

## Supporting thread: HTTP porting and the deliberate deferred seam

The HTTP feature port ([commit 1783b5](https://github.com/elsa-workflows/elsa-foundation/commit/1783b5132c094ce0852b762b46ea5eb99c007393)) is honest about what it cannot finish. The commit message names the problem directly:

> "HTTP Still has some services that are not yet shipped over to elsa-foundfation, because they were coupled to Workflows.Runtime functionality. I have recorded the services and will fix them when working on HttpWorkflowsMiddleware."

This is worth noting not as a deficiency but as a discipline. In `elsa-core`, the equivalent decision would have been to port the services anyway, accepting an implicit coupling to the runtime. Here the port stops at the boundary: the services that belong to runtime live in runtime, and the HTTP feature in `elsa-foundation` compiles without them, with the debt made explicit and named.

The constitution's §E2.2 separates Workflows Design from Workflows Runtime and requires that runtime depends on the published runnable artifact, not on Design-side models. HTTP services that book-end workflow execution — the middleware that receives an HTTP trigger and resumes a suspended workflow — belong on the runtime side of that seam. Porting them prematurely into `elsa-foundation`'s design layer would have pulled the runtime boundary into the wrong place. Week 2 declines to do that.

What did land is the transport-agnostic part of HTTP: activity definitions, the endpoint abstractions, and the wiring that does not depend on how workflow execution is managed. The runtime-coupled piece is flagged and deferred to a dedicated `HttpWorkflowsMiddleware` phase.

## Supporting thread: FastEndpoints lands and reorganizes

FastEndpoints — the library `elsa-foundation` uses for its API endpoints — arrived in the same initial port commit. The first check-in added `Elsa.FastEndpoints`, `Elsa.Nuplane.FastEndpoints`, and `Elsa.Shells.FastEndpoints` as new projects, carrying their filter infrastructure, serialization configurators, endpoint abstractions, and the first concrete endpoints (package catalog, reconcile, shell reload).

The subsequent "finalized" commit ([a33351cb](https://github.com/elsa-workflows/elsa-foundation/commit/a33351cb8ff0af57f59ce633b16be2a4cd81eb63)) then removed `Elsa.Nuplane.FastEndpoints` and `Elsa.Shells.FastEndpoints` as standalone projects, along with the old `src/Api/` test host and its test workflow definition. This is the cleanup half of a port: land everything, reorganize, remove what doesn't belong as a top-level project yet.

The commit also removed `src/Elsa.Activities.Core/` — specifically `IActivityDescriber`, `IActivityNode`, `IActivityProvider`, `ActivityDescriptor`, `InputDescriptor`, `OutputDescriptor`, and `PropertyDescriptor` — replacing them with design-layer contracts under `src/Elsa.Activities.Design.Core/`. The old `Elsa.Activities.Core` abstractions were design and runtime mixed together; the new split puts design descriptors in the design layer where the constitution says they belong.

## What this unlocks next

Replacing the provider zoo with domain events is not just a cleanup — it is a commitment to an extension model that the rest of the system can follow. Any subsystem that needs cross-domain hooks now has a pattern: raise a domain event, let feature handlers populate it. This keeps cores narrow and feature modules independent.

The deferred HTTP/runtime seam is explicitly on the roadmap: `HttpWorkflowsMiddleware` has a named slot. When the runtime layer is ready to accept it, the port can finish without needing to revisit the design layer. That is the benefit of making the debt explicit instead of papering over it.

FastEndpoints' presence means the server-side API surface has a foundation. The Nuplane package-management endpoints and shell-reload endpoints that were added and then removed as standalone projects will need a home; they are not gone, just deferred to a cleaner location.

Week 3 will continue migration: more features from `elsa-core`, more tests of the Design/Runtime boundary, and the first real checks of whether the domain-event extension model scales beyond the JavaScript subsystem.

## This week by the numbers

Four non-merge commits, zero merged PRs, and one contributor — Joey Barten ([j03y-nxxbz](https://github.com/j03y-nxxbz)) — with roughly 15,000 lines added across the week's migration work. No ADRs or spec slices landed; this week's decisions live in commit messages, not formal artifacts. The most important document this week is the commit message of [a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb7497ed205e589ad4fb27b1a7d20203fe), which names both the old structure and the replacement clearly enough that you do not need to read the diff to understand the decision.

If you read only one primary source this week, read the [elsa-core baseline case study](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md) alongside the provider-zoo removal — the case study names the anti-pattern, and the commit shows the cure in action.

## Follow along

Follow the engine in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation). The rules live in the [Elsa constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md) and [framework constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution-framework.md); the vocabulary lives in the [glossary](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/glossary). Next week: migration continues, and the constitution's rules get their next real test.
