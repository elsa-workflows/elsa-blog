---
title: "Building Elsa 4 · Week 28: Putting the New Execution Kernel on Trial"
slug: "building-elsa-4-week-28"
description: "The clean-slate kernel prototype lands, its design gains conditional approval, and partition ownership gets its first implementation milestone."
publishedAt: "2026-11-20"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","architecture","workflow-runtime"]
series: "Building Elsa 4"
related: ["inside-the-elsa-4-kernel"]
---

# Building Elsa 4 · Week 28: Putting the New Execution Kernel on Trial

*November 13–19, 2026*

The last few weeks have been about making the current Elsa 4 preview easier to use. In parallel, we kept running into the cost of moving even a small workflow through the runtime's durable scheduler. This week the repository gained a standalone prototype for a new execution kernel. The [kernel article](/blog/inside-the-elsa-4-kernel) walks through a crash that can lose the obligation to deliver an approval. Here I want to follow what the prototype changed in the design. [Prototype findings](https://github.com/elsa-workflows/elsa-foundation/pull/4260), [ADR 0099 proposal](https://github.com/elsa-workflows/elsa-foundation/pull/4718)

## Give the database one turn to commit

The design gives the execution model a turn over its state and inbox. During that turn the model can advance its own state and decide which messages, timers, subscriptions, and jobs it needs. The durable layer commits those changes together at the end of the turn. A projector can build Studio's read models from the journal after the commit. That puts the responsibility for durable delivery in one place and leaves the model to decide what the messages mean. [ADR 0099](https://github.com/elsa-workflows/elsa-foundation/blob/febd33fe03/docs/adr/0099-clean-slate-execution-kernel.md)

On one reference workload, ten Write Lines in Balanced mode, the ADR records 48 PostgreSQL round trips for the existing preview runtime and two for the prototype. These are counts for that workload and those configurations. We also ran simulations and model tests. Porting the native Flowchart to the graph engine reproduced an All join that could hang after a decision, then demonstrated the corrected behavior. This is the kind of case a cheap sequence benchmark cannot tell us about. [Reference measurements in ADR 0099](https://github.com/elsa-workflows/elsa-foundation/pull/4718), [Flowchart model evidence](https://github.com/elsa-workflows/elsa-foundation/pull/4344)

## Who can commit after a takeover?

The design was accepted with conditions on November 18. The first implementation milestone then had a specific job: make the worker own a set of virtual partitions and prove the fence when another owner takes some of them. A fence is the storage check that rejects a commit from an owner whose partition epoch is stale. The November 19 acceptance records the ownership simulation, broken-fence controls, and store and runtime checks run on the merged prototype. The existing runtime was still the product default. [Design approval](https://github.com/elsa-workflows/elsa-foundation/pull/4804), [Partition ownership acceptance](https://github.com/elsa-workflows/elsa-foundation/pull/4822)

The work also changed where a future actor foundation would plug in. The Orleans reference adapter tested replacing the actor runtime while retaining Elsa's durable layer. We retired that adapter and approved, with conditions, a contract for actor types to consume both layers as a foundation. The built-in implementation can serve that contract first. A future adapter can provide its own actor and durability machinery at the same boundary. [Adapter retirement](https://github.com/elsa-workflows/elsa-foundation/pull/4835), [Foundation contract approval](https://github.com/elsa-workflows/elsa-foundation/pull/4854)

## Studio tells you what to fix before publishing

The existing workflow editor got a practical improvement this week. When a publication candidate has a validation problem, the review shows the diagnostic count, the reason, and the target you can correct. Studio also added a **Manage views** page where you can apply, rename, share, or delete saved views according to your permissions. If you work from a filtered list of published workflows, the saved view can now be managed in one place and applied back to the library. [Publication feedback](https://github.com/elsa-workflows/elsa-foundation/pull/4626), [Saved-view management](https://github.com/elsa-workflows/elsa-foundation/pull/4843)
