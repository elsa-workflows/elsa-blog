---
title: "Why Elsa 4? Rebuilding a .NET Workflow Engine from the Foundation Up"
slug: "why-elsa-4-rebuilding-a-dotnet-workflow-engine"
description: "Elsa 4 (codename Foundation) is a ground-up rebuild of the Elsa .NET workflow engine. Here's why elsa-core hit its limits, and the thin, modular, spec-driven foundation replacing it."
publishedAt: "2026-05-08"
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
seoTitle: "Why Elsa 4? Rebuilding a .NET Workflow Engine"
seoDescription: "Why elsa-core's architecture hit its limits and the thin, modular, spec-driven foundation replacing it. The kickoff post of the Building Elsa 4 series."
---

> **Key Takeaways**
> - Elsa 4 ("Elsa Foundation") is a foundational rebuild, not a feature release — its repository was created **2026-05-08**.
> - It answers seven concrete structural problems in `elsa-core`, captured as an honest case study rather than blamed on anyone.
> - The guiding principle is a **thin protocol, not a fat one** — capabilities are opt-in modules and coupling is made visible.
> - Development is **spec-driven (Speckit)** and governed by a **two-layer constitution** — every decision is an artifact you can read.
> - This series follows the build week by week, from the commit history up.

Elsa 3 — the `elsa-core` workflow engine — is a successful, widely used .NET library. So why rebuild the foundation? Because success exposed structural limits that couldn't be patched away, only re-founded. This post is the map for a new series: we're building **Elsa 4** in the open, and every week after this is a step on the road this post lays out. We start at the beginning — the foundation repository was created on **8 May 2026** ([elsa-foundation README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md); [constitution §E2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).

## What is Elsa 4, and what does "Foundation" mean?

Elsa 4 is the next major version of Elsa; `elsa-foundation` is the transitional workspace where its domain core, default implementations, and architecture are being forged. The repository's own README states the premise plainly: "`elsa-foundation` is the transitional Elsa 4 foundation workspace," and the thesis of the whole project is one sentence:

> "Elsa Foundation should be a thin protocol, not a fat one." — [elsa-foundation README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md)

A *thin protocol* means the foundation is a narrow shared surface — the domain language, core contracts, extension points, invariants, and quality gates — **not** a platform that every feature inherits by default. Capabilities like persistence, HTTP, scripting, and scheduling are opt-in modules, not ambient dependencies.

You'll meet two repositories in this series. [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation) is the engine and domain. [`elsa-foundation-studio`](https://github.com/elsa-workflows/elsa-foundation-studio) is, in its own words, "a modular React studio shell hosted by ASP.NET Core" that "owns the Studio module protocol, Vite React shell, TypeScript SDK, and sample class-library modules" ([studio README](https://github.com/elsa-workflows/elsa-foundation-studio/blob/main/README.md)).

## The elsa-core baseline: seven problems that motivated a rebuild

The honest answer to "why rebuild?" is that `elsa-core` exhibited a set of structural anti-patterns *at once*, and they compound. This isn't hindsight blame — the project keeps elsa-core as a documented case study of exactly what the new framework is designed to prevent. From the [elsa-core baseline case study](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md), which states that "elsa-core exhibited every anti-pattern in framework §1 at once":

1. **God packages.** `Elsa.Workflows.Core` accumulated contracts and implementations across runtime, design, persistence, and serialization concerns.
2. **Framework leakage into domain code.** ASP.NET Core types, expression engines, and HTTP-specific abstractions surfaced inside packages that should have been transport-agnostic.
3. **Forced heavy dependencies.** Distributed locking (Medallion), expression engines (Jint, Fluid), EF Core providers, and message-broker SDKs were all transitively reachable from the contract layer — every consumer pulled the whole tree whether they needed it or not.
4. **Infrastructure locked into the lowest layer.** Persistence base contexts, specific lock implementations, and HTTP framework choices were baked into the contracts.
5. **Inverted dependency direction.** Domain code referencing infrastructure; consumer code reaching into provider internals.
6. **Silent DI resolution.** `Elsa.Common` was the vector through which `IronCompress`, `DistributedLock.Core`, and configuration types bled into every consumer; multiple registrations against the same contract overwrote each other without diagnostic.
7. **No naming convention.** `Elsa.Features.*`, `Elsa.Modules.*`, `Elsa.Core.Common` — layer-marker buckets that communicated nothing the domain hierarchy didn't already say.

That last detail — overwrites "without diagnostic" — is the kind of failure mode that erodes trust in a framework slowly. None of these is fatal alone. Together they make a codebase where adding a feature means reasoning about the whole tree. Preserving them as a written case study, rather than quietly deleting the history, is the project's own credibility check: these are the seven failure modes Elsa 4 has to answer.

## The Elsa 4 answer: modular domains behind thin contracts

Elsa 4's structural reply is consistent: each domain exposes its contracts through a `.Core` library, keeps implementations behind those contracts, and composes through sanctioned patterns instead of direct coupling. The [architecture tour](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/architecture-tour.md) and [constitution §E2](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md) make this concrete.

The flagship decision is the **Workflows.Design ↔ Workflows.Runtime bounded-context split** (§E2.2). Design "owns the *designed contract* of a workflow: input/output definitions, activity tree, expression bindings, plus the persistence layer that stores them." Runtime "owns the *runtime representation* of workflow execution and its own dedicated persistence layer, separate from Design." The load-bearing rule is one directional sentence: "Runtime does **not** reference `Elsa.Workflows.Design.Core`." That split exists so Elsa can support Design-only, Runtime-only, and combined deployment shapes (§E2.2.3). An honest note worth carrying forward: the Runtime packages are "currently stubs," with the execution seam deliberately deferred — a recurring thread for future posts.

The cleanup is made literal in the rename of `Elsa.Common` to **`Elsa.Primitives`** (§E2.3) — "the narrow domainless-primitives package that replaced the historical `Elsa.Common` leakage," carrying "only truly domainless building blocks: `Result<T>`, `Page<T>`, base entity abstractions, guard helpers." That is the direct antidote to problem #6 above.

And the worked example that makes the pattern tangible: `Elsa.Locking.Core` defines a distributed-lock contract with no external dependencies, while a provider module hides Medallion entirely behind it. Swapping the lock implementation becomes shipping a new module, not editing the core ([worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)).

## How the engine promises to run: two runtime invariants

Two coupled contracts make the runtime predictable: **executable-always-runs** and **artifact-only runtime** ([constitution §E2.6](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).

Executable-always-runs (§E2.6.1): "If an artifact is published as a runnable representation of a workflow, the runtime MUST be able to load and execute it. No condition internal to the runtime system — missing activity types, missing module installation, in-memory registry drift, version misconfiguration — may break this contract." Crucially, *whether* an artifact is allowed to run in a given tenant, environment, or role is a domain/business gate; the *ability* to run is a system contract. "Domain gates may deny execution; they may not destroy executability."

Artifact-only (§E2.6.2): the Runtime sub-domain depends on only the runnable artifact and the features that interpret it. Source definitions, draft revisions, and designer layout live in Design and are reachable by foreign key, "but the runtime does not require them to execute." The hard rule: "A runtime that needs to load design-side data to execute is a §E2.2 hard-rule violation. The seam between Design and Runtime is the runnable artifact; nothing else crosses it at execution time."

## Building it in the open: spec-driven and constitution-governed

Elsa 4 isn't just coded — it's specified and governed, which is exactly why this series can exist. Every significant decision lands as a readable artifact:

- **Speckit specs.** The `specs/` directory holds 90+ numbered slices (for example `073-flowchart-scoped-execution`, `080-runtime-checkpoint-commit`), each with spec, plan, tasks, and contracts. Development *is* the spec flow.
- **ADRs.** Architecture decisions are captured in [`docs/adr/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/adr) — already 30+ — covering things like the runtime checkpoint-commit decision and scoped-variable rules.
- **A two-layer constitution.** A framework-neutral layer (`constitution-framework.md`) plus an Elsa-specific layer (`constitution.md`), treated as quality gates rather than prose.
- **Program goals.** A roadmap of mid-term coordination buckets in [`docs/program-goals/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/docs/program-goals) — the Runtime Execution Seam, persistence readiness, and more.

The payoff for readers is direct: the decision trail is public and legible, so we can narrate the build because the build documents itself.

## What this series will cover

Each week, this DevJournal mines the real commit history of both repos and tells one grounded story: the headline decision, two or three supporting threads, what it unlocks next, and a by-the-numbers recap. Every claim links to a primary source — an ADR, a spec slice, a PR, or a commit.

Threads you can already anticipate: the Runtime execution seam (the deferred big one), the Extension Builder initiative (which landed nearly twenty ADRs in a single week), provider-neutral persistence under the Groundwork effort, and the modular Studio shell. If you want to follow a workflow engine being re-founded in real time, this is the place to start — at commit one.

## FAQ

**Is Elsa 4 released?** No. It's in active development in the open in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation), whose repository was created 2026-05-08. This series follows the build.

**Will Elsa 3 workflows still work?** Compatibility is **import-only** by design ([constitution §E2.7](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)): a dedicated adapter maps Elsa 3 definitions into the Elsa 4 model, after which they run natively. Dual-run and round-trip translation back to Elsa 3 are explicitly out of scope.

**What does "thin foundation" actually mean?** A narrow shared contract surface. Capabilities like persistence, HTTP, scripting, and scheduling are opt-in modules behind `.Core` contracts, not ambient dependencies.

**Why two repos?** [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation) is the engine and domain; [`elsa-foundation-studio`](https://github.com/elsa-workflows/elsa-foundation-studio) is the modular React studio shell hosted by ASP.NET Core.

**What is Speckit?** The spec-driven workflow under `.specify/` that turns each unit of work into spec → plan → tasks → implementation, leaving a readable trail behind every change.

## Conclusion

Elsa 4 is a re-founding, not a relaunch. It's driven by an honest reading of where `elsa-core` hit its structural limits, organized around a thin protocol with visible coupling, and made legible by spec-driven development and a constitution you can actually read. We start at the beginning — the foundation repo's first commit, 8 May 2026 — and walk forward together, one week at a time.

Follow along: [elsa-foundation](https://github.com/elsa-workflows/elsa-foundation) · [elsa-foundation-studio](https://github.com/elsa-workflows/elsa-foundation-studio) · [the constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md) · [the architecture tour](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/architecture-tour.md).
