---
title: "Building Elsa 4 · Week 26: Keeping Your Place in Studio"
slug: "building-elsa-4-week-26"
description: "Workspace tabs retain authoring context, durable User Tasks return form decisions to workflows, and Weaver gains scoped editing and run inspection."
publishedAt: "2026-11-06"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","studio","ai"]
series: "Building Elsa 4"
---

# Building Elsa 4 · Week 26: Keeping Your Place in Studio

*October 30–November 5, 2026*

Last week we made it easier to put Studio inside a custom host. This week we worked on what happens during a long session in that host. You might have a workflow draft open, a Test Run to investigate, and a task form to check. Going to the second screen should feel like putting the first one aside. [Workspace tab implementation](https://github.com/elsa-workflows/elsa-foundation/pull/3639)

## Switch tabs without starting over

Studio's workspace tabs preserve the state of a background screen, including the draft, undo history, selection, and list filters. Effects such as polling and subscriptions stop while the tab is in the background. Unsaved work keeps a tab from being released, and closing a guarded tab still goes through the editor's navigation check. Routes can identify a resource so a link to a draft you've already opened can focus its existing editor. [Tab lifecycle and navigation](https://github.com/elsa-workflows/elsa-foundation/pull/3639)

The workflow library also moved its search, filters, views, and tag controls into a more coherent toolbar. Folder management became a labelled action, and the list gained recoverable bulk deletion for workflows you explicitly select. When you open a published executable, the inspector now reuses the familiar Sequence and compensation designers and the BPMN canvas. It reads pinned, authorized values from the executable instead of using the current draft as its source of evidence. [Library controls](https://github.com/elsa-workflows/elsa-foundation/pull/3653), [Executable Inspector](https://github.com/elsa-workflows/elsa-foundation/pull/3846)

## Wait for a person's decision

Durable User Tasks landed with reusable forms and a Studio inbox. A workflow can assign work to a user or group. A participant can claim group work, fill out the form, and choose one of the authored actions. The runtime records the accepted action and data and can deliver the outcome after an interruption. That lets the author model a step like “review this purchase and choose Approve or Return” with a durable link back to the run. [User Tasks implementation and recovery evidence](https://github.com/elsa-workflows/elsa-foundation/pull/3691)

## Give Weaver the context of the current screen

Weaver can propose changes to the active workflow draft as one reviewed batch. The batch is checked against the authorized catalog and the current draft revision, then applied as one operation in designer history. You can undo it in one step, and saving remains an explicit user action. Keeping the review tied to a revision matters if you change the canvas while a proposal is being prepared. [Reviewed operation batches](https://github.com/elsa-workflows/elsa-foundation/pull/3715)

The same work gave Weaver context for the library and reusable templates, and a way to explain a specific run or activity execution. In run inspection, Weaver checks runtime read permission and withholds sensitive values. The selected run gives the explanation an actual execution to refer to, even when the workflow draft now looks different. [Library and templates](https://github.com/elsa-workflows/elsa-foundation/pull/3727), [Exact-run inspection](https://github.com/elsa-workflows/elsa-foundation/pull/3736)
