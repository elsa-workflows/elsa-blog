---
title: "Building Elsa 4 · Week 1: Laying the Foundation Stone"
slug: "building-elsa-4-week-1"
description: "Week 1 of Elsa 4: the repository is born, a two-layer constitution lands as the project's law, and Elsa.Common is renamed to Elsa.Primitives to kill the oldest leak."
publishedAt: "2026-05-15"
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
featuredImage: "../assets/2026-05-15-building-elsa-4-week-1/featured.png"
featuredImageAlt: "Building Elsa 4 DevJournal cover — Week 1, “Laying the Foundation Stone” — on a dark slate background with an abstract workflow-node graph motif."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 · Week 1: Laying the Foundation Stone"
seoDescription: "The first week of Elsa 4: an empty repo, a two-layer constitution, and the Elsa.Common to Elsa.Primitives rename that sets the tone for everything after."
---

> **Key Takeaways**
> - Week 1 (2026-05-08 → 2026-05-15) is genesis: the `elsa-foundation` repository is created and its **two-layer constitution** lands as the project's enforceable law ([constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md)).
> - The single most concrete decision is renaming **`Elsa.Common` to `Elsa.Primitives`** — the direct antidote to elsa-core's worst leak ([commit d1ec8f06](https://github.com/elsa-workflows/elsa-foundation/commit/d1ec8f06)).
> - Six non-merge commits, zero PRs, one author (Joey Barten): this week is about writing down the rules before writing the engine.

## Where we are on the road

The kickoff post argued that Elsa 4 is a re-founding, organized around a "thin protocol, not a fat one" ([elsa-foundation README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md)). Week 1 is where that argument stops being a manifesto and starts being a repository. There is almost no engine yet. What there *is* — and what makes this week worth a post — is the law the engine will be held to.

This is the rarest kind of commit history: a project deciding its constraints before it has anything to constrain.

## The headline decision: write the constitution before the code

The week opens with the literal first commit and the project's startup ([376da2a0 "Initial commit"](https://github.com/elsa-workflows/elsa-foundation/commit/376da2a0); [21e2d05f "Initial startup of the project"](https://github.com/elsa-workflows/elsa-foundation/commit/21e2d05f)), both authored 8 May 2026. But the load-bearing artifact isn't code — it's a pair of governance documents that land and then get audited for coherence ([2e2d57ab "Final auditing of constitutions coherence: framework & Elsa-specific & plan/spec/tasks templates"](https://github.com/elsa-workflows/elsa-foundation/commit/2e2d57ab)).

Elsa 4 ships **two** constitutions on purpose. A framework-neutral layer (`constitution-framework.md`) states architectural rules that any modular .NET system should follow; an Elsa-specific layer (`constitution.md`) applies them to this domain ([both files in `.specify/memory/`](https://github.com/elsa-workflows/elsa-foundation/tree/main/.specify/memory)). The split is itself an architectural statement: the universal rules shouldn't be tangled with Elsa's particulars, just as Elsa's domain code shouldn't be tangled with infrastructure.

What does this *rule out*? It rules out the most common failure mode of a rewrite — relitigating the same boundary decision in every pull request. When "domain code must not reference infrastructure" is a written quality gate rather than a reviewer's opinion, it survives contributor turnover, deadline pressure, and the next clever shortcut. The constitution is the thing that makes the rest of this series narratable: every later week can point at a rule and show the code obeying it.

## Supporting thread: killing the oldest leak, by name

If you want one commit that captures the whole spirit of Elsa 4, it's this one: [d1ec8f06 "Changing Elsa.Common to Elsa.Primitives"](https://github.com/elsa-workflows/elsa-foundation/commit/d1ec8f06).

In elsa-core, `Elsa.Common` was the silent leakage vector — the package through which heavy dependencies and infrastructure types bled into every consumer, documented later as one of the seven baseline anti-patterns ([elsa-core worked examples](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md)). Naming the replacement `Elsa.Primitives` is not cosmetic. "Common" is an invitation — anything vaguely shared drifts into it. "Primitives" is a charter: only truly domainless building blocks belong, and nothing with external dependencies. The rename encodes the rule in the package name so the leak can't quietly reopen.

This is "thin protocol" applied to the lowest layer of the stack on day one.

## Supporting thread: persistence starts separating early

The week also does early structural cleanup, wrapping up an initial separation of persistence concerns ([a711745b "code cleanup plus persistence initial separation wrap-up"](https://github.com/elsa-workflows/elsa-foundation/commit/a711745b)) and refreshing the README to describe the new repository's purpose ([38d035f2 "Update README to reflect new repo description"](https://github.com/elsa-workflows/elsa-foundation/commit/38d035f2)).

Pulling persistence apart this early matters because in elsa-core, persistence base contexts were baked into the lowest layer — infrastructure locked where domain code could reach it. Starting the separation in week one, before there are dozens of consumers to migrate, is the cheap moment to get it right.

## What this unlocks next

A written constitution plus a clean primitives floor is the launchpad for everything that follows in this series: the Design ↔ Runtime split, the executable-always-runs invariant, and the spec-driven slices that arrive once the rules are settled. You can't enforce a boundary you never wrote down. Week 1 wrote them down.

## This week by the numbers

Six non-merge commits in `elsa-foundation`, zero merged PRs, and a single contributor — Joey Barten, committing as `j03y-nxxbz` ([commit history for the window](https://github.com/elsa-workflows/elsa-foundation/commits/main/?since=2026-05-08&until=2026-05-15)). The `elsa-foundation-studio` repository has no activity yet; it arrives later in the journey. If you read only two things this week, read the [constitution](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md) and the [elsa-core baseline case study](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reference/elsa-worked-examples.md) it's written to answer.

## Follow along

Follow the engine in [`elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation). The rules live in the constitution ([Elsa](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution.md), [framework](https://github.com/elsa-workflows/elsa-foundation/blob/main/.specify/memory/constitution-framework.md)); the philosophy lives in the [README](https://github.com/elsa-workflows/elsa-foundation/blob/main/README.md). Next week: the engine starts to take shape behind those rules.
