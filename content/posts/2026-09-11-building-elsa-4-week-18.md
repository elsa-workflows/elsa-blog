---
title: "Building Elsa 4 · Week 18: What the Diagnostics Drain Taught Us"
slug: "building-elsa-4-week-18"
description: "Groundwork becomes Elsa 4's first-party persistence path, and diagnostics expose why one transaction shape behaves differently across database engines."
publishedAt: "2026-09-11"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","persistence","operations"]
series: "Building Elsa 4"
related: ["groundwork-and-the-persistence-boundary-in-elsa"]
featuredImage: "../assets/2026-09-11-building-elsa-4-week-18/featured.jpg"
featuredImageAlt: "Blue workflow tokens on a steel rail beside a separate teal channel and a chamber of diagnostic beads."
---

# Building Elsa 4 · Week 18: What the Diagnostics Drain Taught Us

*September 4–10, 2026*

Week 17 put explicit checks around Elsa's integration with Groundwork. This week that integration became the first-party persistence path on main. The HTTP workflow benchmark showed us how much it matters which connection owns the diagnostics drain. [Groundwork promotion](https://github.com/elsa-workflows/elsa-foundation/pull/1574), [SQLite diagnostics change](https://github.com/elsa-workflows/elsa-foundation/pull/1589)

## A separate diagnostics connection

The promotion removed Elsa's own EF Core persistence projects, migrations, and test oracles. The Workbench still needed the vendor-owned OpenIddict EF integration for identity. The promotion deliberately made a clean break for the preview and included no database conversion. [Promotion and architecture guard](https://github.com/elsa-workflows/elsa-foundation/pull/1574)

The first HTTP workflow runs on main went from roughly 235–295 ms to 577–659 ms warm p95 in the gate. The trace showed a broad shift across requests. SQLite serialized unit-of-work lifetimes at the provider connection, and the Workbench shared that connection between workflow persistence and diagnostics. Opening a workflow session could wait for the diagnostics drain to finish its transaction. We moved the diagnostics stores to a separate SQLite file and connection so those two workloads had separate gates. [Bisection and fix](https://github.com/elsa-workflows/elsa-foundation/pull/1589)

A different test exposed a lifetime problem. Reopening diagnostic compositions on PostgreSQL and SQL Server consumed pooled connections because the stores held non-owning sessions that only the provider connection could release. The stores switched to owned sessions and dispose those sessions with the composition that opened them. The repeated-open test made a problem visible that a single successful startup would have missed. [Owned diagnostics sessions](https://github.com/elsa-workflows/elsa-foundation/pull/1602)

## How large should a write be?

MongoDB gave us the opposite pressure. A drain could spend hundreds of round trips on individual trace-summary reads and writes, then pay for a commit every capture batch. The store moved to a keyed batch read for existing summaries and grouped several queued batches into one transaction. It kept a ledger row and fingerprint for each original batch, so replay after a lost acknowledgement still has an identity even when the new drain groups batches differently. [Summary batching](https://github.com/elsa-workflows/elsa-foundation/pull/1605), [Transaction grouping](https://github.com/elsa-workflows/elsa-foundation/pull/1609)

Bigger transactions helped the MongoDB drain and extended SQLite's writer hold. Groundwork's serialized-writer capability let Elsa commit one queued batch at a time on SQLite and group batches on providers without that constraint. The caller asks the provider about its writer behavior, so we can explain the transaction policy without tracing a database-name switch through diagnostics code. [Capability-based drain sizing](https://github.com/elsa-workflows/elsa-foundation/pull/1610)

The SQL Server lane also taught us to ask what the optimizer actually did. The harness learned to recognize a parallel exchange in a real keyset-page plan and to report why a provider withheld a plan. That gave the next investigation a reason to start from. The persistence decision itself would change the following week. [Query-plan evidence](https://github.com/elsa-workflows/elsa-foundation/pull/1621), [The later persistence decision](https://github.com/elsa-workflows/elsa-foundation/pull/1685)
