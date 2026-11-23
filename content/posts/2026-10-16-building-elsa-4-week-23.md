---
title: "Building Elsa 4 · Week 23: One Repo and Three Persistence Modes"
slug: "building-elsa-4-week-23"
description: "Foundation and Studio move into one repository as Elsa 4 simplifies its execution engine around Durable, Balanced, and Ephemeral persistence."
publishedAt: "2026-10-16"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","workflow-runtime","studio"]
series: "Building Elsa 4"
related: ["elsa-progress-update-october-2026"]
featuredImage: "../assets/2026-10-16-building-elsa-4-week-23/featured.jpg"
featuredImageAlt: "A runtime module and a blue workflow panel share a base with three lanes of differently spaced stops."
---

# Building Elsa 4 · Week 23: One Repo and Three Persistence Modes

*October 9–15, 2026*

Last week we wrote separate source guides for Foundation and Studio. This week we brought the two source trees together. We also changed the default persistence behavior for a workflow run. Both changes came out of a review of the complexity we were asking contributors and Elsa hosts to carry. [Simplification decisions](https://github.com/elsa-workflows/elsa-foundation/pull/2594), [Repository consolidation](https://github.com/elsa-workflows/elsa-foundation/pull/2644)

## One change can now span the server and the editor

Foundation and Studio came together in the Foundation repository under `Essentials/`, `Extensions/`, and `Studio/`. Optional backend capabilities can now live alongside the Studio modules that expose them. The merge preserved Studio's commit history and kept the two products' independent builds and package identities. A change to an activity contract and its editor can now be reviewed from one checkout. [Consolidation design and validation](https://github.com/elsa-workflows/elsa-foundation/pull/2644)

The simplification work also started making internal types private to their implementation by default. The first guard infrastructure made exported APIs an explicit choice, with the rollout proceeding domain by domain. This matters to anyone writing an extension. The package should make it possible to see which interfaces we intend you to build on. [Simplification decisions](https://github.com/elsa-workflows/elsa-foundation/pull/2594), [Public API and domain guards](https://github.com/elsa-workflows/elsa-foundation/pull/2711)

## Pick how often a workflow commits

There are three modes on one drain path. **Durable** caps a commit at one activity. **Balanced**, the default, can group activities and commits at the configured cap or a lifecycle boundary. **Ephemeral** removes the activity cap. If a run reaches the end without needing a prior commit, the host can omit its completion record when `RecordCompletion` is off. Suspension and the attempt claim before an activity outside the replay-safe profile still require durable boundaries. [Persistence modes](https://github.com/elsa-workflows/elsa-foundation/pull/2673)

We found an edge case almost immediately. When a host died before the first commit, the recovery command could start without enough information to find the workflow's chosen mode. It would then use the host default. The follow-up made the redrive preserve the run's original mode. That's the case worth testing when a setting affects how the evidence of the setting itself is persisted. [Redrive fix](https://github.com/elsa-workflows/elsa-foundation/pull/2675)

## Familiar controls in Studio

Classic became the default theme. The designer also gained in-workflow copy, paste, and duplicate. Copying a group preserves its inputs and the connections within the selection. The copies get fresh node IDs, including remapped IDs inside nested containers, and one undo removes the whole paste. The [October progress update](/blog/elsa-progress-update-october-2026) has screenshots and the wider Elsa 3 context. [Classic theme](https://github.com/elsa-workflows/elsa-foundation/pull/2713), [Designer duplication](https://github.com/elsa-workflows/elsa-foundation/pull/2749)
