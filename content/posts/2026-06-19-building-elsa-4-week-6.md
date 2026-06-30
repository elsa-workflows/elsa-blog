---
title: "Building Elsa 4 · Week 6: Making the Engine Observable"
slug: "building-elsa-4-week-6"
description: "Week 6 of Elsa 4: structured logs and OpenTelemetry diagnostics land behind contracts, identity auth arrives, Studio is split into its own repo, and an agent harness appears."
publishedAt: "2026-06-19"
status: "draft"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
  - "observability"
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 6: Making the Engine Observable"
seoDescription: "Structured logs, OpenTelemetry, identity auth, a Studio repo split, and the first agent harness — week 6 makes the new Elsa 4 runtime observable and operable."
---

> **Key Takeaways**
> - Week 6 (2026-06-12 → 2026-06-19) makes the new runtime *observable*: **structured logs** ([PR #86](https://github.com/elsa-workflows/elsa-foundation/pull/86)) and **OpenTelemetry** diagnostics ([PR #88](https://github.com/elsa-workflows/elsa-foundation/pull/88)) are ported in behind contracts.
> - **Identity auth** lands as contracts plus a provider sign-in ([PR #85](https://github.com/elsa-workflows/elsa-foundation/pull/85), [PR #87](https://github.com/elsa-workflows/elsa-foundation/pull/87)), and **Studio is extracted to its own repository** ([PR #76](https://github.com/elsa-workflows/elsa-foundation/pull/76)).
> - A **Studio agent backend harness** appears ([PR #90](https://github.com/elsa-workflows/elsa-foundation/pull/90)) — the quiet groundwork for next week's Weaver assistant.

## Where we are on the road

Last week the runtime stopped being a stub: a checkpoint-based execution engine and a provider-neutral persistence foundation landed in a 67-PR burst ([week 5 specs 007–070](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs)). A real engine that nobody can see into is a liability. Week 6 answers the obvious next question — *what is it doing?* — and, in passing, reshapes the project's repository layout for the work still coming.

## The headline decision: diagnostics ported in behind contracts, not bolted on

The week's center of gravity is diagnostics, delivered as two coordinated slices. **Structured logs** arrive first — capture, server-sent-event live streaming, and EF Core persistence — ported into the foundation as a unit ([PR #86](https://github.com/elsa-workflows/elsa-foundation/pull/86), [spec 073 "Diagnostics — Structured Logs (Capture, Live Streaming & Query)"](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/073-diagnostics-structured-logs/spec.md)). Then **OpenTelemetry** diagnostics follow as a separate slice with its own ingestion and live-streaming path ([PR #88](https://github.com/elsa-workflows/elsa-foundation/pull/88), [spec 074 "Diagnostics — OpenTelemetry (Ingestion, Live Streaming & Query)"](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/074-diagnostics-opentelemetry/spec.md)).

The word that matters in both PR titles is **ported** — and the architecture decision is that diagnostics enter as *modules behind contracts*, not as ambient logging sprinkled through the domain. Structured logs and OpenTelemetry are two implementations of the same observability need, kept separate so a consumer can take one, both, or neither.

What this *rules out* is observability as a cross-cutting leak — the elsa-core pattern where infrastructure concerns embed themselves in the lowest layer and everyone inherits them ([worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). Here, the engine emits to a diagnostics contract; whether that's persisted to EF Core or exported via OTEL is a module choice at the edge. The work is tracked as an explicit program goal, Diagnostics Observability Readiness ([program goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/diagnostics-observability-readiness.md)).

## Supporting thread: identity and auth get real contracts

Authentication lands in two halves that mirror Elsa 4's whole method: first **identity auth contracts** ([PR #85](https://github.com/elsa-workflows/elsa-foundation/pull/85)), then a **provider that implements sign-in** against them ([PR #87](https://github.com/elsa-workflows/elsa-foundation/pull/87)). Contract first, implementation behind it.

The Studio side picks up the matching client work in its own repo — an auth system spec and a Studio auth SDK aligned to the backend sign-in endpoints ([studio PR #11](https://github.com/elsa-workflows/elsa-foundation-studio/pull/11), [studio PR #9](https://github.com/elsa-workflows/elsa-foundation-studio/pull/9)). Auth is the kind of capability that, done casually, leaks framework types everywhere; doing it as contracts plus a provider keeps it swappable and keeps the domain ignorant of the mechanism.

## Supporting thread: Studio moves into its own repository

This is the week the **workspace split** happens: the Studio prototype is extracted to a dedicated repository ([PR #76](https://github.com/elsa-workflows/elsa-foundation/pull/76)), and `elsa-foundation-studio` lights up with its own history — 36 commits and 13 merged PRs covering a UI system spec, package management, and the auth SDK above ([studio PR #8](https://github.com/elsa-workflows/elsa-foundation-studio/pull/8), [studio spec 001-ui-system](https://github.com/elsa-workflows/elsa-foundation-studio/blob/main/specs/001-ui-system/spec.md)).

The split is an architectural boundary made physical. The engine and the "modular React studio shell hosted by ASP.NET Core" ([studio README](https://github.com/elsa-workflows/elsa-foundation-studio/blob/main/README.md)) now version independently, which is tracked as a Workspace Split Readiness goal ([program goal](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/workspace-split-readiness.md)). Two repos, two release cadences, one protocol between them.

## Supporting thread: an agent harness appears

The quietest commit may be the most consequential: a **Studio agent backend harness** is added ([PR #90](https://github.com/elsa-workflows/elsa-foundation/pull/90)), with follow-up commits hardening agent resource ownership and proposal execution. On its own it's infrastructure. In context, it's the foundation the **Weaver** AI authoring assistant is built on next week — and the reason week 7's story is entirely about the *trust boundary* around that harness. The capability lands here; the safety envelope comes next.

## What this unlocks next

Observability plus an agent harness is exactly the runway week 7 uses: with execution finally visible and an agent backend in place, Elsa can give Weaver the power to author workflows directly — and spend most of its effort deciding how to keep that power safe ([week 7 trust-boundary ADRs](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/adr)).

## This week by the numbers

136 non-merge commits and 16 merged PRs in `elsa-foundation`, plus 36 commits and 13 merged PRs in `elsa-foundation-studio` — authored by Sipke Schoorstra across both ([foundation history](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-06-12&until=2026-06-19), [studio history](https://github.com/elsa-workflows/elsa-foundation-studio/commits/main/?since=2026-06-12&until=2026-06-19)). If you read only two sources, read the [structured logs spec (073)](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/073-diagnostics-structured-logs/spec.md) and the [Studio extraction PR (#76)](https://github.com/elsa-workflows/elsa-foundation/pull/76) — observability and the repo split are the week's two lasting moves.

## Follow along

Engine work lives in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation); Studio now lives in [`elsa-foundation-studio`](https://github.com/elsa-workflows/elsa-foundation-studio). Roadmap context is in [`docs/program-goals/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/program-goals). Next week: the agent enters the building — behind a trust boundary.
