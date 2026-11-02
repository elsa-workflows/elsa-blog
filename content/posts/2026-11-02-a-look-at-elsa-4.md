---
title: "A look at Elsa 4"
slug: "a-look-at-elsa-4"
description: "A look at Elsa 4, why we are rebuilding it, what is taking shape, and an illustrated guide to its capabilities and architecture."
publishedAt: "2026-11-02"
updatedAt: "2026-11-02"
status: "published"
authors:
  - "sipke"
category: "Product"
tags:
  - "architecture"
  - "workflow-authoring"
featuredImage: "../assets/2026-11-02-a-look-at-elsa-4/featured.png"
featuredImageAlt: "The hand-drawn Elsa logo beside pencil sketches of a workflow, decision table, and data pipeline, with soft watercolor washes and the title A look at Elsa 4."
excerpt: "Why Elsa 4 is a rewrite, what is taking shape, and a new illustrated brochure to explore its capabilities."
seoTitle: "A look at Elsa 4"
seoDescription: "Explore the Elsa 4 preview, its rewrite rationale, execution models, architecture, and Elsa 3 migration work through an illustrated brochure."
related:
  - "why-elsa-4-rebuilding-a-dotnet-workflow-engine"
  - "elsa-progress-update-october-2026"
---

# A look at Elsa 4

There’s quite a bit happening with Elsa 4, and I wanted to share a clearer picture of where things stand, why we’re rebuilding it, and where it’s heading.

So I’ve put together an [illustrated Elsa 4 brochure](https://elsa-four-field-guide.sfmskywalker.chatgpt.site/). It walks through the capabilities one page at a time, with short explanations, practical examples, and hand-drawn illustrations.

Elsa 4 is still preview software. The brochure covers both working capabilities and things we’re developing, with their status indicated along the way.

## Why a rewrite?

A fair question is why Elsa 4 needs to be a rewrite. Couldn’t we keep improving Elsa 3?

Elsa 3 taught us a lot. It also accumulated architectural decisions that make some improvements harder than they should be. Packages take on too many responsibilities. Infrastructure dependencies reach into contracts. Authoring and execution concerns become entangled. Extension behavior can depend on registration details that aren’t obvious to the person configuring the application.

These are the “broken windows” we’re addressing: individually manageable problems that become increasingly expensive when they reinforce each other.

The rewrite gives us room to deal with those problems together. Smaller, more focused modules. Clearer ownership. Explicit extension points. A stronger separation between the workflow you author and the executable that runs.

The [Elsa Foundation architecture briefing](https://elsafoundation.dev/) explains that reasoning in more detail. Some sections describe work still taking shape, but the motivation is straightforward: make Elsa easier to understand, extend, and operate as it grows.

## What Elsa 4 is becoming

Visual workflows remain central to Elsa. You compose activities, connect systems, make decisions, and wait for something to happen before continuing.

But different kinds of work benefit from different representations.

A business process might be best expressed in BPMN. A decision may fit naturally into a rules table. Moving and transforming data calls for a pipeline. A familiar activity-based workflow may be the clearest way to coordinate the whole process.

Elsa 4 brings these execution models into the same platform while preserving their own behavior. BPMN keeps its events, gateways, and process semantics. ETL keeps its partitions, checkpoints, and data-processing concerns. Native workflows keep their activity composition.

Within native workflows, Flowchart and Sequence provide different ways to structure a process. State machine support is a future direction.

For example, an order process could use a workflow to coordinate the steps, a reusable rules decision to determine whether approval is required, and a data pipeline to prepare information for another system. That’s the kind of composition we’re building toward.

There’s also ongoing work around AI specialists and agent collaboration. I’m particularly interested in how these fit into processes with explicit inputs, outputs, tools, and human approval. Current collaboration builds on native workflows; a dedicated agent execution model is a proposed direction that still needs to be fleshed out.

## Some important changes underneath

A lot of the work is below the surface.

One important boundary separates designing a workflow from running it. Authoring owns drafts, versions, validation, and layout. Publishing produces an executable artifact that the runtime consumes. An execution stays associated with its published artifact, so editing a workflow doesn’t silently change the definition an existing execution resumes against.

Another key choice is the actor model.

Each workflow execution has an identity and a mailbox. Commands for that execution are processed one at a time, while separate executions can progress independently. With durable hosting configured, saved state and queued work support continuation after a wait or host restart.

This gives us an explicit way to reason about ownership, concurrency, and recovery. It also separates execution coordination from the work being dispatched to workers.

Persistence follows a similar principle: domain contracts describe what needs to be stored, while infrastructure implementations handle the storage technology. Workflow code shouldn’t need to know the details of a database provider.

If you’d like a visual explanation of how these pieces fit together, I’ve also shared an [interactive Elsa 4 architecture overview](https://witty-thicket-5ma3.here.now/). You can select layers and execution models to explore their responsibilities. It shows the target architecture, including future and possible capabilities, so it should be read as a direction rather than a release checklist.

## What about existing Elsa 3 applications?

Migration matters, of course.

We’re developing importer functionality to help bring Elsa 3 workflow definitions into Elsa 4. The converter already handles supported definitions and reports conversion problems, including cases where runtime behavior differs.

There will still be things to review. Custom activities, integrations, expressions, and application-specific assumptions may need changes. Converting a definition also doesn’t mean migrating an already-running workflow instance.

My advice is to start with a representative process: inventory its dependencies, import it, review the diagnostics, and test its behavior with real data. Include the waits, failures, and recovery paths, too.

The broader migration and feature-parity work is continuing alongside Elsa 4 itself.

## Why the brochure?

A repository and its issue tracker are useful if you’re following the implementation closely. They’re less useful when you simply want to understand what Elsa can do and whether it might fit your application.

That’s what I wanted the brochure to help with.

It covers visual design, long-running execution, BPMN, rules, data processing, integrations, inspection, and several areas still under development. There are also a few pages for developers who want more architectural context.

I’m very pleased with how the illustrations turned out. They give each capability a visual explanation, and make the whole thing a little more pleasant to explore.

I also want to thank [@nexxbiz](https://www.linkedin.com/company/nexxbiz/), and especially [Joey](https://www.linkedin.com/in/joey-barten-6b7082a4/) and [Frans](https://www.linkedin.com/in/frans-van-ek/). They’ve been instrumental in shaping the vision for Elsa 4. I’m grateful for their input, their perspective, and the opportunity to think through that direction together.

[Have a look at the Elsa 4 brochure](https://elsa-four-field-guide.sfmskywalker.chatgpt.site/), and let me know what you think. I’d be interested to hear which parts are relevant to your own applications, and what you’d like to see explained in more detail.

I’m also planning a weekly series that takes one chapter of the brochure at a time and explores it in more detail. Each post will focus on what the capability does, where it’s useful, and how it works, with practical examples along the way.
