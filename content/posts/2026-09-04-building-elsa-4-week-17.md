---
title: "Building Elsa 4 · Week 17: Closing the Loop"
slug: "building-elsa-4-week-17"
description: "Week 17 closes implementation records, adopts Groundwork 0.4.0-preview.1, and strengthens Elsa 4's runtime and Studio boundaries."
publishedAt: "2026-09-04"
status: "draft"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
  - "groundwork"
  - "workflow-runtime"
series: "Building Elsa 4"
featuredImage: "../assets/2026-09-04-building-elsa-4-week-17/featured.png"
featuredImageAlt: "A circular maintenance bench aligns blank implementation records, clears terminal residue, closes a mailbox, and focuses an inspection lens."
seoTitle: "Building Elsa 4 Week 17: Closing the Loop"
seoDescription: "Week 17 adopts Groundwork 0.4.0-preview.1 and closes the record on terminal runtime cleanup and focused Studio Inspector tabs."
excerpt: "A consolidation week makes Elsa 4's persistence boundaries, terminal cleanup, and public implementation record easier to trust."
---

# Building Elsa 4 · Week 17: Closing the Loop

Week 17 is about consolidation. Elsa adopted Groundwork `0.4.0-preview.1` with explicit release-boundary checks, while Foundation and Studio corrected three specs that still looked unfinished after their implementations had shipped ([Foundation PR #1464](https://github.com/elsa-workflows/elsa-foundation/pull/1464), [Foundation PR #1469](https://github.com/elsa-workflows/elsa-foundation/pull/1469), [Studio PR #497](https://github.com/elsa-workflows/elsa-foundation-studio/pull/497)).

That may sound quieter than a new runtime capability or designer surface. It is still part of building Elsa 4 in the open. The code, executable evidence, and public lifecycle record should tell the same story.

> **Key Takeaways**
> - Groundwork `0.4.0-preview.1` adoption added explicit session and catalog boundary checks.
> - Terminal workflow cleanup is now recorded as implemented across both scheduler residue and actor lifetime.
> - Studio's focused activity Inspector tabs are now recorded as shipped behavior.
> - This week's common theme is convergence: completed state should stop looking or behaving as if it were still active.

## Why is Groundwork 0.4.0-preview.1 more than a package bump?

The Groundwork adoption changed Elsa at the persistence boundary, not only in `Directory.Packages.props`. The merge adapted the storage-session gate, connection wrappers, audit path, and shared test doubles to Groundwork's `0.4` async and owned-session surface ([PR #1464](https://github.com/elsa-workflows/elsa-foundation/pull/1464)).

The session gate makes that boundary concrete. Its asynchronous read, query, aggregate, insert, update, upsert, delete, and append methods delegate to the admitted provider session. A release-boundary test invokes all eight operations against an async-only session and verifies that no synchronous member was used ([session gate](https://github.com/elsa-workflows/elsa-foundation/blob/3e694377ff6a73dc6b80e34991222b1f8cd47509/src/Elsa/Persistence/Groundwork/V2/GroundworkStorageSessionGate.cs), [release-boundary tests](https://github.com/elsa-workflows/elsa-foundation/blob/3e694377ff6a73dc6b80e34991222b1f8cd47509/tests/Elsa/Persistence/Groundwork/V2/Tests/GroundworkReleaseBoundaryTests.cs)).

Why test this through an async-only double? A compatibility layer can appear correct while quietly routing asynchronous calls through synchronous work. The test makes native asynchronous delegation part of the release boundary rather than an implementation assumption.

The same suite checks what happens when storage state is no longer compatible. A retained session is refused after the same connection publishes an evolved declaration. The refusal happens before another provider round trip. Opening a new session against the evolved declaration can then read the carried value under its new column name ([release-boundary tests](https://github.com/elsa-workflows/elsa-foundation/blob/3e694377ff6a73dc6b80e34991222b1f8cd47509/tests/Elsa/Persistence/Groundwork/V2/Tests/GroundworkReleaseBoundaryTests.cs)).

Prior-preview catalogs have an equally explicit boundary. The test corrupts the recorded target fingerprint, verifies that initialization says to discard the catalog because no in-place migration exists, then verifies that a fresh catalog admits the same storage unit without schema drift ([release-boundary tests](https://github.com/elsa-workflows/elsa-foundation/blob/3e694377ff6a73dc6b80e34991222b1f8cd47509/tests/Elsa/Persistence/Groundwork/V2/Tests/GroundworkReleaseBoundaryTests.cs)).

<!-- [UNIQUE INSIGHT] -->

That fail-closed behavior matters more than making every preview interchangeable. A persistence abstraction becomes trustworthy when it names the point where compatibility ends. For the broader design behind this work, see [Groundwork and the persistence boundary in Elsa](/blog/groundwork-and-the-persistence-boundary-in-elsa).

### What does the black-box lifecycle cover?

The committed acceptance path uses the real Workbench HTTP surface with the default SQLite Groundwork composition. It authors and saves a workflow version, reloads it through the design API, publishes it, executes until an Event bookmark is durably suspended, resumes the bookmark, and checks the persisted output ([Groundwork release adoption](https://github.com/elsa-workflows/elsa-foundation/blob/3e694377ff6a73dc6b80e34991222b1f8cd47509/e2e-tests/groundwork/README.md)).

That path tests the boundary as an Elsa user encounters it. Package resolution and storage APIs matter, but the final proof crosses design, publishing, runtime suspension, resumption, and persisted output.

## What should “terminal” mean to a workflow runtime?

A terminal workflow should stop generating durable scheduler work and stop retaining an in-process mailbox. Elsa reached those outcomes in two separate implementations. This week, the specs for both were formally moved to `Implemented`, pointing to the pull requests where the behavior landed ([spec 113](https://github.com/elsa-workflows/elsa-foundation/blob/3474aa2dcb04c5d604e7efe39760050fdcd47f7b/specs/113-terminal-resumption-purge/spec.md), [spec 128](https://github.com/elsa-workflows/elsa-foundation/blob/3474aa2dcb04c5d604e7efe39760050fdcd47f7b/specs/128-runtime-actor-terminal-eviction/spec.md)).

Spec 113 began with a misleading symptom: a drain appeared about every 10 seconds after completion. The spec traced that cadence to the default resumption sweep, not to a slow passivation timer. Residual scheduler work made backlog discovery surface the terminal execution again, and each re-drive added another item that the terminal guard would refuse to dispatch ([spec 113](https://github.com/elsa-workflows/elsa-foundation/blob/3474aa2dcb04c5d604e7efe39760050fdcd47f7b/specs/113-terminal-resumption-purge/spec.md)).

The implemented fix makes the sweep terminal-aware. It purges residual work for an execution already confirmed terminal instead of re-driving it. Non-terminal executions with real backlog still follow the existing recovery path ([PR #894](https://github.com/elsa-workflows/elsa-foundation/pull/894)).

That solved durable queue convergence, but not the original in-process mailbox lifetime. Spec 128 records why these are distinct problems. The actor provider's live mailbox and lifecycle-lock registries were pruned only by `PassivateAsync`, yet no production path called it. Stopping repeated reactivation did not remove the mailbox created by the original run ([spec 128](https://github.com/elsa-workflows/elsa-foundation/blob/3474aa2dcb04c5d604e7efe39760050fdcd47f7b/specs/128-runtime-actor-terminal-eviction/spec.md)).

The second implementation carries the terminal result through command processing and dispatch metadata. A cached actor handle then passivates after the mailbox critical section has been released. The policy is enabled by default, the resumption sweep can reap stragglers, and the runtime exposes the `elsa.runtime.actor.live_mailboxes` gauge ([PR #983](https://github.com/elsa-workflows/elsa-foundation/pull/983), [spec 128](https://github.com/elsa-workflows/elsa-foundation/blob/3474aa2dcb04c5d604e7efe39760050fdcd47f7b/specs/128-runtime-actor-terminal-eviction/spec.md)).

<!-- [UNIQUE INSIGHT] -->

The architectural lesson is not simply “clean up after completion.” Durable queue residue and in-memory actor lifetime have different owners and different race conditions. Treating them as separate boundaries made each fix narrow enough to state, test, and inspect.

## Why change a spec after the code has shipped?

Foundation PR #1469 changed lifecycle metadata, not runtime behavior. It replaced stale status lines in specs 113 and 128 with `Implemented` references to merged PRs #894 and #983, then refreshed the generated spec-status map ([PR #1469](https://github.com/elsa-workflows/elsa-foundation/pull/1469), [restatement commit](https://github.com/elsa-workflows/elsa-foundation/commit/3474aa2dcb04c5d604e7efe39760050fdcd47f7b)).

A stale status is more than untidy documentation. The `specs/` tree is a working map for contributors. If shipped work still says `Draft`, readers can't tell whether they should design, implement, review, or merely verify it.

<!-- [PERSONAL EXPERIENCE] -->

That distinction matters even more in a fast-moving, agent-assisted repository. We want a future contributor to follow a short evidence chain: the spec states the contract, the implementation PR shows what landed, and the status says whether the unit is still active. This week's restatement repaired that chain without pretending to deliver the behavior again.

## What changed in Studio’s public record?

Studio made the same kind of correction. PR #497 changed no product behavior. It marked spec 093 as implemented by PR #474 and marked the delivery task complete, while leaving the unverified post-merge audit task open ([PR #497](https://github.com/elsa-workflows/elsa-foundation-studio/pull/497)).

The shipped feature reorganizes the activity Inspector into focused inner tabs. Inputs and Outputs are always present. Variables and Slots appear only when the selected activity supports them. Details and Version preserve identity and version information, while the outer Inspector, Runtime, and Artifacts navigation stays unchanged ([spec 093](https://github.com/elsa-workflows/elsa-foundation-studio/blob/24306ca46ddd57393cc832685f7ced305ceb3876/specs/093-activity-inspector-tabs/spec.md)).

The implementation also keeps the activity name and applicable notices fixed above the tabs. Tab bodies scroll independently, tab selection survives an outer-panel round trip, and switching to an activity without the current conditional tab falls back to Inputs ([PR #474](https://github.com/elsa-workflows/elsa-foundation-studio/pull/474), [spec 093](https://github.com/elsa-workflows/elsa-foundation-studio/blob/24306ca46ddd57393cc832685f7ced305ceb3876/specs/093-activity-inspector-tabs/spec.md)).

Again, the story this week is not that those tabs suddenly appeared. It is that the repository now reports their state accurately.

## What does building Elsa 4 in the open mean this week?

Building in the open means preserving the line between new behavior and better evidence. PR #1464 changed the persistence integration and its tests. PRs #1469 and #497 changed lifecycle records for behavior that had already merged ([PR #1464](https://github.com/elsa-workflows/elsa-foundation/pull/1464), [PR #1469](https://github.com/elsa-workflows/elsa-foundation/pull/1469), [PR #497](https://github.com/elsa-workflows/elsa-foundation-studio/pull/497)).

That separation keeps the journal honest. We can point to the exact merge that adopted Groundwork `0.4.0-preview.1`, the exact tests that define its release boundary, the implementation PRs for terminal cleanup, and the commit that corrected each spec status. Readers do not have to infer intent from a polished retrospective.

There is also a useful connection across the week's work. An incompatible storage session should fail before it performs more work. A terminal execution should stop accumulating durable items and retaining a live mailbox. A shipped spec should stop presenting itself as unfinished. Each system reaches a boundary and makes that state explicit.

[Week 9 focused on boundaries that contributors can inspect](/blog/building-elsa-4-week-9). Week 17 applies the same principle to maintenance: the map must remain inspectable after the code moves.

## What does this unlock next?

Week 17 leaves clearer baselines rather than a new roadmap promise. Groundwork updates now have committed checks for asynchronous delegation, stale sessions, prior-preview catalogs, and the Workbench lifecycle. Terminal runtime cleanup is discoverable as implemented behavior, and Studio contributors can treat focused Inspector tabs as shipped baseline ([PR #1464](https://github.com/elsa-workflows/elsa-foundation/pull/1464), [PR #1469](https://github.com/elsa-workflows/elsa-foundation/pull/1469), [PR #497](https://github.com/elsa-workflows/elsa-foundation-studio/pull/497)).

That is part of [why Elsa 4 is being rebuilt in the open](/blog/why-elsa-4-rebuilding-a-dotnet-workflow-engine). New architecture matters. So does the less visible work of proving its boundaries and keeping its public record true.

---

### Sources

- Elsa Foundation PR #1464 — Adopt Groundwork 0.4.0-preview.1: https://github.com/elsa-workflows/elsa-foundation/pull/1464
- Elsa Foundation commit `3e694377` — Groundwork release adoption: https://github.com/elsa-workflows/elsa-foundation/commit/3e694377ff6a73dc6b80e34991222b1f8cd47509
- Elsa Foundation PR #1469 — Restate specs 113 and 128 as Implemented: https://github.com/elsa-workflows/elsa-foundation/pull/1469
- Elsa Foundation commit `3474aa2d` — Spec lifecycle restatement: https://github.com/elsa-workflows/elsa-foundation/commit/3474aa2dcb04c5d604e7efe39760050fdcd47f7b
- Elsa Foundation PR #894 — Terminal resumption purge: https://github.com/elsa-workflows/elsa-foundation/pull/894
- Elsa Foundation PR #983 — Runtime actor terminal eviction: https://github.com/elsa-workflows/elsa-foundation/pull/983
- Elsa Foundation Studio PR #497 — Restate spec 093 as Implemented: https://github.com/elsa-workflows/elsa-foundation-studio/pull/497
- Elsa Foundation Studio commit `24306ca` — Inspector spec lifecycle restatement: https://github.com/elsa-workflows/elsa-foundation-studio/commit/24306ca46ddd57393cc832685f7ced305ceb3876
- Elsa Foundation Studio PR #474 — Activity Inspector tabs: https://github.com/elsa-workflows/elsa-foundation-studio/pull/474
