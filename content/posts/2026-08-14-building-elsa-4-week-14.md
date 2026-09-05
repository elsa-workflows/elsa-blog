---
title: "Building Elsa 4 · Week 14: One Workflow, More Than One Store"
slug: "building-elsa-4-week-14"
description: "Week 14 gives Groundwork persistence lanes named targets and makes split-store activity publication converge through ordered writes, with recovery limits visible."
publishedAt: "2026-08-14"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
featuredImage: "../assets/2026-07-10-building-elsa-4-week-9/featured.png"
featuredImageAlt: "Three connected translucent compartments depict workflow definitions, execution infrastructure, and inspection interfaces."
seoTitle: "Building Elsa 4 Week 14: More Than One Store"
seoDescription: "Named Groundwork targets separate persistence lanes. Follow split-store publication, ordered writes, recovery boundaries, and the remaining cleanup limits."
excerpt: "Separating Design and Runtime in code is only part of the job. Separate databases force publication to reveal its real consistency boundary."
---

# Building Elsa 4 · Week 14: One Workflow, More Than One Store

## The physical boundary catches up

Design and Runtime can be separate domains without yet being independently placeable databases. [ADR 0065](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0065-groundwork-persistence-targets-are-named-and-lanes-bind-to-them.md) documents that mismatch: Elsa's host composition admitted one physical Groundwork store even though its architecture called for distinct deployment shapes.

Week 14 covers **August 7 through August 13, 2026**, the window `[2026-08-07, 2026-08-14)`. Named persistence targets make the physical boundary explicit. They also expose an awkward follow-up: what happens when reusable-activity publication needs to write across those stores?

> **Key Takeaways**
> - Named targets connect persistence lanes to explicit physical stores.
> - An undeclared named target fails rather than falling back to another database.
> - Split publication uses ordered writes; co-located lanes keep one atomic commit.
> - Receipt redrive exists, but default scheduling and stranded-reference cleanup remain limits at this snapshot.

## What does a named target own?

A target identifies a physical store and the schema composed from its bound persistence lanes. [ADR 0065](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0065-groundwork-persistence-targets-are-named-and-lanes-bind-to-them.md) keeps provider configuration, domain lane selection, and schema composition separate. They meet through a target name rather than teaching every provider which Elsa domains exist.

The [registry implementation](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/src/Elsa/Persistence/Groundwork/Composition/Targets/GroundworkTargetRegistry.cs) accepts an identical declaration twice, but rejects different stores claiming the same name. Requiring an absent target also throws. This replaces the documented earlier behavior where a second connection configuration could be silently discarded.

An explicitly named lane must not silently use the default store. The [split-target tests](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/tests/Elsa/Persistence/Groundwork/UnifiedHost/Tests/SplitActivityPublicationOrderingTests.cs) include that refusal. The default lane retains its separate compatibility path for hosts supplying an ambient store; that doesn't authorize fallback for a misspelled named target.

<!-- [UNIQUE INSIGHT] -->

Failing composition is better than successfully writing to the wrong database. That is the operational meaning of the [Groundwork persistence boundary](/blog/groundwork-and-the-persistence-boundary-in-elsa) here: domain ownership needs an equally explicit storage destination. ADR 0065 still says `proposed` at this snapshot, while the registry and lane tests show implemented work.

## How can publication cross stores?

Split reusable-activity publication uses ordered forward convergence, not a cross-store transaction. [ADR 0066](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0066-reusable-activity-publication-orders-writes-instead-of-one-transaction.md), accepted and implemented, defines runtime material first, the Design commit second, and the Publishing receipt last. It explicitly identifies this as a weaker consistency guarantee than the co-located case.

First, the runtime target atomically receives the executable activity template and source reference. On their own, they are not yet resolvable through a completed activity publication. Then the Design target commits the authoring and management-projection changes. **That Design commit is the point at which publication becomes done.**

The receipt comes last. It is a recoverable idempotency artifact, not the authority that decides whether publication happened. A retry after Design committed must resume the receipt write rather than reject its own successful publication as a duplicate.

The [publication command](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/src/Elsa/Workflows/Publishing/Persistence/Groundwork/Services/GroundworkActivityPublicationCommand.cs) contains both the split sequence and the receipt-resume path. When all lanes resolve to one target, it deliberately uses the existing single atomic commit. Separation is supported without weakening the common one-store topology unnecessarily.

## Does a redrive make recovery automatic?

Not by itself. [ADR 0066's updated status](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0066-reusable-activity-publication-orders-writes-instead-of-one-transaction.md) says a callable receipt-redrive mechanism exists, but nothing schedules its sweep in the default host at this point. Having a recovery service and composing a host that actually drives it are separate deliverables.

The Design commit records a post-commit intent so the obligation to write the receipt becomes durable at the same moment publication becomes authoritative. The [command's split path](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/src/Elsa/Workflows/Publishing/Persistence/Groundwork/Services/GroundworkActivityPublicationCommand.cs) stages that work and removes the intent only after the receipt is durable.

That closes an important mechanism gap: recovery needn't depend solely on the original caller returning. But it doesn't establish automatic progress in every deployment. The ADR also distinguishes receipt recovery from cleaning up runtime material stranded before the Design phase. The redrive doesn't perform that cleanup.

## Is unreachable material ready for collection?

No. An unreachable template can still have a live retention reference. [ADR 0066's corrected retention account](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0066-reusable-activity-publication-orders-writes-instead-of-one-transaction.md) explains that the first phase writes both the template and its Published source reference. If publication stops there, that reference can keep the otherwise inert material rooted.

<!-- [UNIQUE INSIGHT] -->

"Nobody can resolve this as a published activity" and "the collector can remove this" are different predicates. The partial state is safe for publication ordering because it is inert. It is not automatically self-cleaning. At this snapshot, the documented missing step is a driver that retires the stranded reference when publication never finishes.

The week also improved the evidence behind the ordering claim. [elsa-workflows/elsa-foundation#1251](https://github.com/elsa-workflows/elsa-foundation/pull/1251) reaches the split-publication crash windows by injection. The ADR records why this matters: seeding an interrupted state can show that recovery accepts it without proving that the real write sequence leaves that state when interrupted.

The public correction is valuable in its own right. It replaces a plausible garbage-collection argument with a more precise account of what the tests establish and which lifecycle obligation remains open.

## Publish the limits alongside the implementation

The resulting topology has an explicit cost. A co-located host keeps its atomic publication path. A split host gains independent storage placement, but must reason about ordered phases, durable receipt work, and retained partial material. The implementation and [ADR 0066](https://github.com/elsa-workflows/elsa-foundation/blob/7ebfe3f8ddd6af5f666e2b067ec147e716b6645d/docs/adr/0066-reusable-activity-publication-orders-writes-instead-of-one-transaction.md) expose that trade rather than hiding it behind "supports multiple databases."

For contributors, the review target is now concrete: trace the destination and failure boundary of each write. That's what building Elsa 4 in the open contributes beyond a feature announcement. The sources show the working mechanism, the preserved one-store behavior, and the gaps a real host still needs to close.
