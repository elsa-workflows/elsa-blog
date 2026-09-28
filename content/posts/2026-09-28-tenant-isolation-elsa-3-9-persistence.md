---
title: "Tenant Isolation in Elsa 3.9 Persistence"
slug: "tenant-isolation-elsa-3-9-persistence"
description: "Elsa 3.9 hardens tenant isolation across EF Core, MongoDB, background workers, and runtime state. See the boundaries custom persistence must protect."
publishedAt: "2026-09-28"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "multitenancy"
  - "persistence"
  - "security"
featuredImage: "../assets/2026-09-28-tenant-isolation-elsa-3-9-persistence/featured.png"
featuredImageAlt: "Soft 3D illustration of tenant-scoped reads, owned writes, and background workers around shared Elsa persistence"
seoTitle: "Tenant Isolation in Elsa 3.9 Persistence"
seoDescription: "Elsa 3.9 hardens 4 tenant boundaries across EF Core, MongoDB, background workers, and runtime state. Learn what custom persistence must protect in practice."
redirectFrom: []
related:
  - "elsa-3-8-stable-upgrade-guide"
  - "building-multitenant-web-apps-in-dotnet-with-cshells"
  - "suspended-workflows-and-elsa-upgrades"
  - "why-elsa-payloads-change-shape-after-persistence"
---

# Tenant Isolation in Elsa 3.9 Persistence

A tenant query filter is useful, but it is not a complete isolation boundary. Recent Elsa 3.9 work found tenant-sensitive paths outside ordinary repository queries: bulk upserts, direct MongoDB collection access, background worker state, distributed lock names, and lifecycle transitions.

The result is a practical model for anyone building a multitenant Elsa host or a custom persistence provider. It complements the application-level patterns in [Building Multitenant Web Apps in .NET with CShells](/blog/building-multitenant-web-apps-in-dotnet-with-cshells) by looking below the tenant-aware application shell. Tenant isolation must hold when data is read, counted, paged, written, claimed, and processed in the background.

> **Key Takeaways**
> - Tenant isolation needs four boundaries: scoped reads, ownership-preserving writes, tenant-aware background work, and valid lifecycle transitions.
> - EF Core query filters do not automatically protect raw SQL or key-only bulk upserts. MongoDB filters do not help code that uses the underlying collection directly.
> - Shared host state belongs to the tenant-agnostic `*` scope. Tenant-owned records must not be reassigned by a save or upsert.
> - The fixes discussed here are merged into `release/3.9.0`. Most are also on `main`, but one MongoDB forward port is still pending there.

> **Availability:** The current public package line is Elsa 3.8.4. This article describes merged 3.9 branch work, not released 3.9 behavior. Several related gaps also remain open, so treat this as an implementation guide and review checklist rather than a claim that every provider is complete.

## What changed in the Elsa 3.9 hardening pass?

The hardening pass closes specific tenant leaks across Core and Extensions. Together, the changes show that isolation is a chain of checks, not one framework feature.

| Boundary | Failure mode | Hardened behavior | Evidence |
| --- | --- | --- | --- |
| Reads | Direct collection queries, counts, or pages omitted tenant scope | MongoDB workflow definitions, triggers, bookmark queues, labels, and summary projections apply tenant visibility | Extensions PR #247 |
| Writes | A key-only bulk upsert could update a row owned by another tenant | EF Core and MongoDB refuse cross-tenant replacement or reassignment | Core PR #8492, Extensions PR #249 |
| Background work | A bookmark worker could use the wrong tenant context, signal, or lock | Work is processed with tenant context and tenant-qualified coordination | Core PR #8390 |
| Runtime state | Interruption logic could move terminal rows back into a resumable state | Only eligible running instances become interrupted | Core PR #8426, Extensions PR #231 |

The common theme is ownership. A tenant-scoped record is not merely a row that happened to be returned by a filtered query. Its tenant identifier controls who may observe it, update it, coordinate work around it, and move it through runtime state.

## Why are query filters only the first boundary?

Query filters protect the queries that actually use them. They do not automatically wrap raw SQL, direct collection access, aggregation pipelines, or provider-specific count and page operations.

That distinction mattered in the MongoDB provider. Several paths operated on the underlying collection rather than the tenant-aware queryable abstraction. A normal list might appear isolated while a paged summary, count, trigger lookup, bookmark queue query, or label query could see a different set. Extensions PR #247 applies tenant visibility across those direct read paths. An earlier fix in Extensions PR #230 covered ordered summaries and interruption updates.

Provider authors should therefore review each operation shape separately:

1. Single-record reads.
2. Lists, counts, and paged queries.
3. Projections and summaries.
4. Bulk reads and bulk writes.
5. Direct driver or raw SQL paths.

The test case also needs at least two tenant identifiers plus the shared `*` scope. Testing only the current tenant proves the happy path, not the isolation boundary.

## Why must a write prove tenant ownership?

A save operation must prove that an existing record belongs to the current tenant before it updates that record. Matching only on the business key is not enough.

The EF Core `SaveManyAsync` path used a bulk upsert outside the normal change tracker and query-filter path. A tenant could provide the key of another tenant's entity and cause the upsert to replace it. Core PR #8492 adds an ownership check and refuses the cross-tenant write. The pull request also documents an important remaining edge: the check and the write are separate operations, so a concurrent ownership change can still create a race. Transactional hardening is follow-up work, not something this fix claims to solve.

MongoDB had the same underlying ownership problem in a different form. Extensions PR #249 adds tenant ownership to the upsert filter so an existing document cannot be taken over by another tenant. A mixed ordered bulk batch can still write earlier valid items before a later invalid item fails. Callers that require all-or-nothing behavior must use a transaction where the deployment supports it.

This boundary is separate from serialization. [Why Elsa Payloads Change Shape After Persistence](/blog/why-elsa-payloads-change-shape-after-persistence) explains how a value can change representation without changing ownership. Tenant ownership must remain stable regardless of the stored payload shape.

The rule is simple: a tenant identifier supplied by the caller is not permission to reassign an existing record. The write predicate must include both identity and ownership, and shared `*` records need an explicit policy rather than accidental visibility.

## How should background workers carry tenant context?

Background work needs the same tenant context as the request or scheduler action that created it. That context must reach storage access, signals, and distributed coordination.

The bookmark queue worker exposed all three failure modes. Core PR #8390 processes work under the item's tenant context, uses tenant-aware signals, and qualifies distributed lock names by tenant. Without those changes, two tenants with similar work could share a coordination channel even when their stored records were isolated.

Host-wide state is the inverse case. A persisted quiescence flag applies to the host, not to whichever tenant happened to be active when the flag was written. Core PR #8487 moves that state to the tenant-agnostic `*` scope and adopts legacy rows. A newer multi-node adoption issue, Core #8529, shows why this area still needs care: concurrent adoption can recreate a pause after a resume.

Use two questions when reviewing a worker:

- Is this state owned by one tenant? Carry that tenant through every read, write, signal, and lock.
- Is this state intentionally host-wide? Store and coordinate it in an explicit shared scope.

## Why do lifecycle transitions belong in the isolation review?

Tenant-safe storage can still produce incorrect work if a background transition ignores the current lifecycle state. Recovery code must only claim records that remain eligible to resume.

Core and provider implementations previously allowed interruption logic to move terminal workflow instances into an interrupted state. That could make a finished or cancelled instance visible to recovery as resumable work. Core PR #8426 and Extensions PR #231 align the transition so only running instances can become interrupted.

This is related to tenant isolation because background recovery combines three predicates: tenant visibility, record identity, and lifecycle eligibility. Dropping any one can claim the wrong work. A safe compare-and-update should express all three as part of the same atomic operation where the provider permits it.

For long-running systems, test these paths with persisted instances across shutdown and restart. The guidance in [Suspended Workflows and Elsa Upgrades](/blog/suspended-workflows-and-elsa-upgrades) applies here: serialized runtime state and provider behavior are part of the compatibility surface.

## What should provider authors test?

Use a boundary matrix instead of one end-to-end tenant test. Seed tenant A, tenant B, and a deliberately shared `*` record, then exercise every operation type your provider exposes.

| Operation | Tenant A should see or change | Tenant B should see or change | Shared `*` behavior |
| --- | --- | --- | --- |
| Read, count, page | A records | B records | Only when the contract allows shared visibility |
| Single save | A-owned target | B-owned target | Explicit update policy |
| Bulk upsert | Only A-owned or new A records | Only B-owned or new B records | No implicit reassignment |
| Delete | A-owned target | B-owned target | Explicit delete policy |
| Background claim | A work under A context | B work under B context | Host-wide work only by design |
| Lifecycle transition | Eligible A state | Eligible B state | Same state predicate, explicit scope |

Run the matrix against normal repositories and every optimized path. That includes direct driver queries, raw SQL, projections, counts, bulk operations, and background services. Add a concurrency case for any check-then-write implementation.

Open issues show where this review is still active. Extensions issue #245 tracks Dapper tenant ownership and visibility gaps. Extensions issue #229 tracks missing Elasticsearch multitenancy support. Core issue #8420 tracks tenant-blind graceful shutdown drain behavior, and Core issue #8439 covers memory activity-execution and workflow-log stores. These are reasons to test the exact provider and runtime path you deploy.

## What should Elsa operators do now?

Stay on aligned 3.8.4 packages for the supported public line unless you are deliberately evaluating a source build. The [Elsa 3.8 stable upgrade guide](/blog/elsa-3-8-stable-upgrade-guide) covers that package train. Merged 3.9 pull requests are evidence of implemented branch behavior, not a package release.

For a 3.9 evaluation:

1. Use matching Core and Extensions revisions from `release/3.9.0`, or verify that your chosen `main` revisions contain the equivalent forward ports.
2. Seed two tenants and a shared `*` record in a disposable database.
3. Exercise lists, counts, pages, direct lookups, single saves, bulk saves, and deletes.
4. Run background bookmark, drain, interruption, and recovery scenarios under both tenants.
5. Add concurrency tests around ownership checks and host-wide state adoption.
6. Track the open issues for your provider before treating the result as production-ready.

Custom persistence deserves the same scrutiny. If an implementation bypasses Elsa's repository abstractions for performance, it also bypasses any tenant behavior those abstractions provide. Reapply the ownership and visibility contract at that lower layer, then prove it with cross-tenant tests.

## Frequently asked questions

### Are these fixes available in Elsa 3.8.4?

No. The changes described here merged into the Elsa 3.9 release branches, and most were forward-ported to `main`. Elsa 3.8.4 remains the latest public package line as of September 28, 2026. Do not infer NuGet availability from a merged pull request.

### Does an EF Core or MongoDB tenant filter protect bulk writes?

Not by itself. A bulk operation can use raw SQL, a provider API, or a direct collection filter that does not pass through the normal tenant-aware query path. Its update predicate must include tenant ownership explicitly, and any separate ownership check introduces a concurrency question.

### Is multitenancy complete across every Elsa 3.9 provider?

No. The merged fixes close specific Core and MongoDB paths, but open issues remain for Dapper, Elasticsearch, shutdown drain, memory stores, and concurrency edges. Validate the provider and operations you use instead of treating the version label as proof of complete isolation.

## The practical takeaway

Tenant isolation is a property of the whole persistence and execution path. Reads must apply visibility consistently. Writes must preserve ownership. Background workers must carry tenant context through storage and coordination. Lifecycle transitions must include state eligibility.

That model is more useful than a checklist item called “tenant filter enabled.” It gives provider authors and Elsa operators concrete places to look, concrete cross-tenant tests to run, and clear reasons to be cautious when an optimized path bypasses the abstraction that normally supplies tenant scope.

## Primary sources

- [Bookmark queue tenant context, Core PR #8390](https://github.com/elsa-workflows/elsa-core/pull/8390), Elsa Workflows, merged 2026-09-25 and retrieved 2026-09-28.
- [Runtime interruption state guard, Core PR #8426](https://github.com/elsa-workflows/elsa-core/pull/8426), Elsa Workflows, merged 2026-09-25 and retrieved 2026-09-28.
- [Host-wide quiescence state, Core PR #8487](https://github.com/elsa-workflows/elsa-core/pull/8487), Elsa Workflows, merged 2026-09-28 and retrieved 2026-09-28.
- [EF Core bulk upsert tenant ownership, Core PR #8492](https://github.com/elsa-workflows/elsa-core/pull/8492), Elsa Workflows, merged 2026-09-26 and retrieved 2026-09-28.
- [MongoDB scoped reads, Extensions PR #247](https://github.com/elsa-workflows/elsa-extensions/pull/247), Elsa Workflows, merged 2026-09-28 and retrieved 2026-09-28.
- [MongoDB tenant-owned upserts, Extensions PR #249](https://github.com/elsa-workflows/elsa-extensions/pull/249), Elsa Workflows, merged 2026-09-28 and retrieved 2026-09-28.
- [MongoDB scoped summaries and interruption updates, Extensions PR #230](https://github.com/elsa-workflows/elsa-extensions/pull/230), Elsa Workflows, merged to `release/3.9.0` on 2026-09-26; `main` forward port pending when retrieved 2026-09-28.
- [Cross-provider interruption behavior, Extensions PR #231](https://github.com/elsa-workflows/elsa-extensions/pull/231), Elsa Workflows, merged 2026-09-25 and retrieved 2026-09-28.
- [Multi-node quiescence adoption race, Core issue #8529](https://github.com/elsa-workflows/elsa-core/issues/8529), Elsa Workflows, open and retrieved 2026-09-28.
- [Dapper tenant ownership and visibility gaps, Extensions issue #245](https://github.com/elsa-workflows/elsa-extensions/issues/245), Elsa Workflows, open and retrieved 2026-09-28.
- [Elasticsearch multitenancy gap, Extensions issue #229](https://github.com/elsa-workflows/elsa-extensions/issues/229), Elsa Workflows, open and retrieved 2026-09-28.
- [Tenant-blind graceful shutdown drain, Core issue #8420](https://github.com/elsa-workflows/elsa-core/issues/8420), Elsa Workflows, open and retrieved 2026-09-28.
- [Memory execution stores without tenant isolation, Core issue #8439](https://github.com/elsa-workflows/elsa-core/issues/8439), Elsa Workflows, open and retrieved 2026-09-28.
- [Elsa Core 3.8.4 release](https://github.com/elsa-workflows/elsa-core/releases/tag/3.8.4), Elsa Workflows, published 2026-09-20 and retrieved 2026-09-28.
- [Elsa Extensions 3.8.4 release](https://github.com/elsa-workflows/elsa-extensions/releases/tag/3.8.4), Elsa Workflows, published 2026-09-20 and retrieved 2026-09-28.
