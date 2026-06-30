---
title: "Building Elsa 4 · Week 2: How Domains Talk Without Touching"
slug: "building-elsa-4-week-2"
description: "Week 2 of Elsa 4: cross-domain hooks move to Mediator domain events, and the Jint scripting engine is accepted only behind an adapter — coupling stays visible."
publishedAt: "2026-05-22"
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
seoTitle: "Building Elsa 4 · Week 2: How Domains Talk Without Touching"
seoDescription: "Cross-domain communication via Mediator domain events and the Jint engine behind an adapter — week 2 is about wiring domains together without coupling them."
---

> **Key Takeaways**
> - Week 2 (2026-05-15 → 2026-05-22) is a quiet wiring week, and its decision is durable: cross-domain hooks go through **Mediator domain events**, not direct references ([commit a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb)).
> - The **Jint** JavaScript engine is accepted only **behind an adapter** — scripting power without a leaked dependency ([commit a9d0697f](https://github.com/elsa-workflows/elsa-foundation/commit/a9d0697f)).
> - Four commits, zero PRs, one author: small surface area, high architectural signal.

## Where we are on the road

Last week the project wrote its constitution and renamed `Elsa.Common` to `Elsa.Primitives` to seal the oldest leak ([week 1 commits](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-08&until=2026-05-15)). The rules existed; now the engine had to start obeying one of the hardest ones: how do separate domains coordinate without referencing each other?

Week 2 is short — four commits — but it answers exactly that question, and the answer recurs for the rest of the journey.

## The headline decision: cross-domain hooks are domain events through Mediator

The commit message is unusually candid about its own origin: cross-domain hooks should use **DomainEvent handlers via Mediator**, recorded as advice from a design conversation ([a56190fb "Processed feedback with Sipke: to use DomainEvent handlers using Mediator in order to expose cross-domain hooks"](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb)). The follow-up wires the missing services so the `DomainEventSender` actually works ([a9d0697f](https://github.com/elsa-workflows/elsa-foundation/commit/a9d0697f)).

Why is this the headline? Because it's the mechanism that lets the "thin protocol" hold. If domain A needs something to happen when domain B does something, the lazy option is a direct reference from A to B — and that's exactly how elsa-core grew its tangled dependency graph and inverted dependency directions ([elsa-core worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). Routing the interaction through a published domain event means the *producer* doesn't know who's listening and the *consumer* doesn't reach into the producer's internals. The coupling becomes a contract — a named event — instead of a compile-time edge.

What this *rules out* is the ambient cross-reference: a domain quietly taking a dependency on another domain's implementation "just to call one method." In Elsa 4 that call has to become an event somebody chose to publish and somebody chose to handle.

## Supporting thread: Jint is allowed in — but only behind an adapter

Workflow engines need expression evaluation, and JavaScript via Jint is the obvious choice. The decision recorded this week is *how* it's allowed in: the **Jint engine adaptor is accepted** — register functions, get and set values — rather than letting Jint types spread through the codebase ([a9d0697f "JINT Engine adaptor accepted (register functions, get/set values)"](https://github.com/elsa-workflows/elsa-foundation/commit/a9d0697f)).

This is the lock-provider pattern from the constitution's worked examples applied to scripting: a core contract owns the capability, and a heavy third-party library lives behind it ([worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). In elsa-core, expression engines were transitively reachable from the contract layer, so every consumer pulled them whether they scripted or not. Behind an adapter, Jint becomes a swappable implementation detail — and a consumer that never scripts never pays for it.

## Supporting thread: HTTP and endpoints get the same treatment

The week closes its refactor by aligning HTTP, JavaScript, and FastEndpoints behind the same discipline ([a33351cb "Finalized Http + JAvaScript + FastEndpoints refactoring"](https://github.com/elsa-workflows/elsa-foundation/commit/a33351cb)), with an interim checkpoint along the way ([1783b513](https://github.com/elsa-workflows/elsa-foundation/commit/1783b513)). The throughline is consistent: transport and framework concerns sit behind contracts rather than inside domain packages — the direct countermeasure to elsa-core's "framework leakage into domain code."

## What this unlocks next

Domain events as the coordination primitive are what make later weeks' lifecycle and runtime work composable. When week 4 collapses draft mutations into a single command that still emits a typed event per change, it's spending the currency minted here ([single update command spec](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/003-single-update-command/spec.md)). Events you can subscribe to, engines you can swap — that's the seam the rest of the build relies on.

## This week by the numbers

Four non-merge commits in `elsa-foundation`, zero merged PRs, authored by Joey Barten (`j03y-nxxbz`) ([commit history for the window](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-15&until=2026-05-22)). No `elsa-foundation-studio` activity yet. The one source to read this week is the cross-domain-hooks decision itself ([a56190fb](https://github.com/elsa-workflows/elsa-foundation/commit/a56190fb)) — small commit, big precedent.

## Follow along

Engine work lives in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation); the rules it answers to live in the constitution ([Elsa](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), [framework](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution-framework.md)). Next week the project starts cutting its first formal Speckit slices.
