---
title: "Building Elsa 4 · Week 5: The Runtime Stops Being a Stub"
slug: "building-elsa-4-week-5"
description: "Week 5 of Elsa 4 is the explosion: 67 merged PRs and 60+ numbered specs turn the deferred runtime execution seam into a real checkpoint-based engine, plus Groundwork persistence."
publishedAt: "2026-06-12"
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
featuredImage: "../assets/2026-06-12-building-elsa-4-week-5/featured.png"
featuredImageAlt: "Building Elsa 4 DevJournal cover — Week 5, “The Runtime Stops Being a Stub” — on a dark slate background with an abstract workflow-node graph motif."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 5: The Runtime Stops Being a Stub"
seoDescription: "67 merged PRs and 60+ runtime specs in one week: how Elsa 4 built its checkpoint-based execution seam and the Groundwork persistence foundation under it."
---

> **Key Takeaways**
> - Week 5 (2026-06-05 → 2026-06-12) is the busiest of the series: **162 commits and 67 merged PRs** in `elsa-foundation`, with a second author scaling in.
> - The deferred **runtime execution seam** becomes real — a long, deliberate series of numbered specs (007–070) builds a checkpoint-based engine one contract at a time ([spec 007](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/007-runtime-executable-state-contracts/spec.md), [spec 008](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/008-checkpoint-commit-envelope/spec.md)).
> - The **Groundwork persistence foundation** lands underneath it ([PR #18](https://github.com/elsa-workflows/elsa-foundation/pull/18), [spec 012](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/012-groundwork-persistence-foundation/spec.md)).

## Where we are on the road

For four weeks the runtime was honestly described as stubs — the execution seam was deliberately deferred while the foundation, the rules, and the design side took shape ([constitution §E2.2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)). Week 5 is where that debt gets paid, all at once. The numbers tell the story before the prose does: 67 pull requests merged in a single week, against four in the entire month prior.

When a week produces this much, the worst thing a journal can do is list it. The right move — and the project's own — is to narrate the *series* as one decision: how do you build an execution engine you'll trust?

## The headline decision: build the runtime as a chain of small contracts

Elsa 4 didn't merge "a runtime." It merged a **numbered chain of runtime contracts**, each its own spec and PR, from executable-state contracts through to the workflow root activity contract ([spec 007 "Runtime Executable Artifact And Execution State Contracts"](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/007-runtime-executable-state-contracts/spec.md) … [spec 070 "Workflow Root Activity Contract"](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/070-workflow-root-activity-contract/spec.md)). The PR list reads like a ladder: executable state contracts (#7), checkpoint commit envelope (#8), pipeline slots (#9), bookmark resume (#10), value binding (#11), all the way up through the execution vertical slice (#17) and request-affine execution (#71).

The architectural spine is the **checkpoint commit envelope** ([spec 008 "Checkpoint Commit Envelope And Post-Commit Intent Boundary"](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/008-checkpoint-commit-envelope/spec.md)). It draws a hard line between what happens *inside* a committed checkpoint and what happens *after* it — a post-commit intent boundary. Side effects don't fire mid-execution and hope for the best; they're recorded as intents and processed after the state is durably committed, through an outbox ([spec 046 post-commit outbox store](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/046-runtime-post-commit-outbox-store/spec.md), [spec 048 outbox processor](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/048-runtime-post-commit-outbox-processor/spec.md)).

This is the executable-always-runs and artifact-only invariants from the kickoff post becoming machinery ([constitution §E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)). What the design *rules out* is the classic workflow-engine failure: a side effect that escaped before the state that justified it was saved. By making the commit envelope the unit of progress and routing everything else through a post-commit outbox, recovery becomes a scan-and-replay rather than a guess ([spec 049 recovery scanner](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/049-runtime-recovery-scanner/spec.md)).

## Supporting thread: state is projected from checkpoints, not mutated in place

A striking sub-series builds runtime read state as **projections from checkpoint writes** — activity state, bookmark state, durable values, incidents, operational and scheduler state, each its own slice ([spec 040](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/040-runtime-activity-state-projection/spec.md) through [spec 045](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/045-runtime-scheduler-state-projection/spec.md); PRs #42–#47). The execution state store itself is a projection ([spec 039](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/039-runtime-workflow-state-store/spec.md), [PR #41](https://github.com/elsa-workflows/elsa-foundation/pull/41)).

The throughline: the checkpoint stream is the source of truth, and queryable state is derived from it. That's the same "separate authored state from read projections" instinct §E2.9 applied to design state in week 3, now applied to runtime state. It also explains the aggressive *removals* this week — the legacy execution pool, the direct executor seam, and legacy storage drivers all get torn out ([PR #67](https://github.com/elsa-workflows/elsa-foundation/pull/67), [PR #69](https://github.com/elsa-workflows/elsa-foundation/pull/69), [PR #68](https://github.com/elsa-workflows/elsa-foundation/pull/68)). You can't have two sources of truth; the old direct-execution path had to go.

## Supporting thread: Groundwork — persistence as a provider-neutral foundation

Underneath the runtime, the **Groundwork persistence foundation** lands ([PR #18](https://github.com/elsa-workflows/elsa-foundation/pull/18), [spec 012](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/012-groundwork-persistence-foundation/spec.md)), followed quickly by a manifest-and-planner kernel and a SQLite document store ([spec 013](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/013-groundwork-core-manifest-planner/spec.md), [spec 014](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/014-groundwork-sqlite-document-store/spec.md)). Specs for SQL Server, PostgreSQL, and MongoDB providers are carved out in the same window ([spec 016](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/016-groundwork-relational-providers/spec.md), [spec 017](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/017-groundwork-mongodb-provider/spec.md)).

Groundwork is the answer to one of elsa-core's seven anti-patterns — infrastructure locked into the lowest layer ([worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). Here persistence is a provider behind a contract, with the store technology chosen at the edge, not baked into the domain. The runtime depends on a persistence *capability*, not on EF Core or any single database.

## What this unlocks next

A committed, checkpoint-based runtime with provider-neutral storage is the floor that everything observable stands on. It's why week 6 can immediately add structured-log and OpenTelemetry diagnostics that stream real execution events — there's finally a real execution to observe ([spec 073 structured logs](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/073-diagnostics-structured-logs/spec.md), [spec 074 OpenTelemetry](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/074-diagnostics-opentelemetry/spec.md)).

## This week by the numbers

162 non-merge commits and 67 merged PRs in `elsa-foundation` — the contributor list jumps to three: Sipke Schoorstra (105 commits), Joey Barten (50), and `j03y-nxxbz` (7) ([commit history for the window](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-06-05&until=2026-06-12)). No `elsa-foundation-studio` activity this week. If you read only two specs, read the [checkpoint commit envelope (008)](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/008-checkpoint-commit-envelope/spec.md) and the [Groundwork persistence foundation (012)](https://github.com/elsa-workflows/elsa-foundation/blob/main/specs/012-groundwork-persistence-foundation/spec.md) — they are the spine and the floor of everything that follows.

## Follow along

Runtime and persistence specs live under [`specs/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/specs); the program-level view is in [`docs/program-goals/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/program-goals), including the [Runtime Execution Seam](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/program-goals/runtime-execution-seam.md) goal this week delivers against. Next week: making it observable.
