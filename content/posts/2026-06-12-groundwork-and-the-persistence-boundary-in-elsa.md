---
title: "Groundwork and the Persistence Boundary in Elsa"
slug: "groundwork-and-the-persistence-boundary-in-elsa"
description: "A look at why Elsa needs Groundwork: not as a generic document store, but as a clearer boundary between persistence intent, provider mechanics, extension data, and runtime state."
publishedAt: "2026-06-12"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "groundwork"
  - "dotnet"
  - "persistence"
  - "databases"
  - "elsa-workflows"
featuredImage: "../assets/2026-06-12-groundwork-and-the-persistence-boundary-in-elsa/featured.png"
featuredImageAlt: "Generated technical illustration of an Elsa workflow engine separating runtime state from provider-neutral storage manifests and database providers"
seoTitle: "Groundwork and the Persistence Boundary in Elsa"
seoDescription: "Groundwork helps Elsa separate storage intent from provider mechanics, giving extensions and runtime data a clearer persistence contract without flattening every workload into one generic store."
redirectFrom: []
---

# Groundwork and the Persistence Boundary in Elsa

Elsa's persistence problem is not simply that it supports multiple databases.

That is the visible part. SQLite, SQL Server, PostgreSQL, MongoDB, and whatever comes next all have different opinions about schema, indexes, concurrency, queries, JSON, transactions, and migration history. Supporting those differences already takes work.

But the harder problem is that Elsa stores different kinds of things for different reasons.

A workflow runtime stores instance state, bookmarks, scheduler state, incidents, execution logs, outbox-like records, locks, leases, definitions, versions, and extension-owned data. Some of that data is part of the runtime hot path. Some of it is framework metadata. Some of it is business data that only exists because an application or module introduced it.

Treating all of that as "persistence" is too vague.

Groundwork is useful to Elsa because it gives us a better question to ask before we choose a database provider:

What kind of storage contract does this workload need?

That is a smaller claim than "write once, run anywhere", and I think it is a more honest one.

## Elsa needs vocabulary before provider code

When a feature needs durable state, it is tempting to start at the provider layer.

For an EF Core provider, that means entities, mappings, migrations, indexes, and query shapes. For MongoDB, it means collections, BSON shape, indexes, filters, and update operations. For a SQL provider that does not use EF, it means DDL, parameterized commands, transactions, and schema history.

That work is necessary, but it is not the first decision.

The first decision is what the feature is asking persistence to guarantee.

Is the data mutable or append-only? Is the identity application-defined? Does it need optimistic concurrency? Which fields are queryable? Are those queries portable? Can the provider optimize the storage shape, or should the unit stay in a more generic document envelope? Is this runtime-defined business data, or is it part of the workflow engine's execution machinery?

Groundwork puts those answers into a manifest.

A `StorageManifest` declares storage units, workload classification, identity policy, tenancy policy, concurrency policy, serialization, indexes, portable queries, and physicalization preference. It does not say "create this exact SQL table with these exact provider types". It says, in effect: this is the durable shape the application needs, and these are the operations providers must respect.

The support-ticket sample in the Groundwork repository is intentionally ordinary, which makes it useful. It declares tickets and comments. Tickets have a string identity, JSON content, optimistic concurrency, a unique ticket number, and queryable fields such as customer, status, assignee, and priority.

The manifest shape looks roughly like this:

```csharp
new StorageUnit(
    new StorageUnitIdentity("supportTicket"),
    "Support ticket",
    new WorkloadClassification(
        WorkloadFamily.RuntimeDefinedBusinessData,
        WorkloadCandidateCategory.GroundworkDefault),
    LifecyclePolicy.Mutable,
    IdentityPolicy.StringId(),
    TenancyPolicy.None,
    ConcurrencyPolicy.Optimistic(),
    SerializationPolicy.Json(),
    TicketIndexes(),
    TicketQueries(),
    PhysicalizationPolicy.Portable);
```

The important line here is not the storage-unit name.

It is the workload classification.

Elsa needs that kind of vocabulary. A workflow runtime has storage paths with very different operational expectations, and a modular workflow platform has extension data that should not require every extension author to become a provider author.

## Extension data is the obvious fit

The cleanest place for Groundwork in Elsa is not the most sensitive runtime path.

It is extension-owned, application-shaped data.

Elsa is deliberately extensible. Real systems add custom activities, modules, integrations, screens, metadata, records, and operational helpers around the workflow runtime. Some of that state belongs in the application's own database model. Some of it is small enough to keep inside the extension. Some of it needs to follow Elsa's provider choices because the extension is part of a reusable package.

Without a shared storage contract, extension persistence tends to drift toward one of two awkward choices.

The extension can couple itself to a provider implementation, which makes it harder to reuse across installations. Or Elsa can keep adding one-off provider plumbing for every new durable shape, which spreads provider mechanics through the product.

Groundwork gives a third option.

An extension can declare storage intent once: these units exist, these fields are indexed, these queries are portable, this concurrency model is required, and this workload is a Groundwork-default candidate. Then the SQLite, SQL Server, PostgreSQL, or MongoDB provider can materialize the appropriate storage shape.

That does not make all databases the same.

It gives the extension a contract that can be validated before runtime and implemented consistently by providers.

For Elsa, that is a big deal. Provider choice is part of the product surface. Every time a module adds durable state, it should not silently narrow the set of providers that can run the application.

## Declared indexes keep provider behavior honest

Most persistence abstractions get into trouble when they pretend all providers can query the same way.

Groundwork takes a narrower path. The current portable document-store contract supports equality queries over declared one-field indexes. That is intentionally modest.

For relational providers, documents are stored as envelopes with declared index rows maintained transactionally alongside writes. SQLite, SQL Server, and PostgreSQL all materialize the same broad shape: document table, declared-index table, and schema-history table.

For MongoDB, the provider creates one native collection per storage unit and native indexes for declared one-field indexes. Content is stored as BSON under a `content` field, while the document envelope keeps the provider-neutral shape.

Same manifest. Different storage mechanics.

There are limits, and the repository is honest about them:

- equality queries only
- one-field portable indexes
- JSON stored as text in the relational providers
- no Entity Framework dependency
- no Elsa dependency
- SQL Server indexed values constrained by key/index limits

Those constraints are not a failure of abstraction. They are the abstraction.

If Elsa exposes a provider-neutral persistence layer that accepts any query shape a provider happens to support, the shared contract stops meaning much. It becomes a polite wrapper around provider-specific behavior.

Declared indexes force the contract into the open. If application code queries an undeclared index, providers are expected to fail clearly. That is exactly the sort of failure mode a framework should prefer. Better to reject the query than to let one provider handle it, another provider scan everything, and a third provider behave differently under load.

## Physicalization is a provider decision, not an application leak

The physicalization work is one of the more interesting parts of Groundwork.

With `PhysicalizationPolicy.Portable`, relational providers query through the declared index table. With `PhysicalizationPolicy.Optimized`, eligible indexes can be projected into provider-native storage.

In SQLite, that can mean projection tables for optimized units. In MongoDB, it can mean storing physicalized fields on the document and indexing those fields natively. The eligibility rule is deliberately narrow: a single field, missing values excluded, equality supported.

That sounds conservative, but it preserves an important property for Elsa:

The module declares intent once.

The provider decides the concrete shape.

The module does not need to know whether SQLite uses projection tables, MongoDB uses native fields, or SQL Server has key-length constraints that affect indexed values. Those details belong in provider packages.

This is where Groundwork starts to feel less like a document-store wrapper and more like a planning layer. It can validate a manifest, check provider capabilities, plan document or relational shapes, materialize storage, record schema history, and then give application code an `IDocumentStore` with save, load, query, and delete operations.

That is not a replacement for every store in Elsa.

It is a way to stop provider mechanics from leaking into places where the application only needed to declare durable intent.

## The runtime lesson is knowing where not to use it

The most useful part of the Groundwork evaluation work may be that it does not try to move everything at once.

Runtime-defined business data is marked as a good fit.

Workflow checkpoint state, bookmark state, and durable scheduler continuation state are benchmark-gated. They need evidence around p95 and p99 latency, concurrent resume behavior, retry behavior, idempotency, diagnostics, and recovery behavior before they should move onto this foundation.

Other workloads are treated as specialized by default:

- execution mailboxes and agent ownership
- post-commit intents and outbox records
- execution logs and audit streams
- distributed locks and leases

That distinction matters in Elsa.

A workflow runtime is not just a place where documents are saved. Some persistence paths carry ordering guarantees, lease ownership, retry semantics, retention behavior, stream-like reads, and operational expectations that are easy to flatten if you only look at the shape of the data.

Groundwork is useful partly because it gives us a vocabulary for not flattening those things.

Some data can be provider-neutral document storage. Some data can be provider-neutral with optimized physicalization. Some data needs a specialized provider contract. And some data should not move until benchmarks prove the runtime behavior is acceptable.

That is a healthier conversation than "can we store it in the generic persistence layer?"

The better question is: what guarantees does this workload need?

## What Elsa code gets from the boundary

The support-ticket sample shows the programming model in a small form.

Application code creates a manifest, materializes it for the selected provider, and then uses the document-store contract:

```csharp
var manifest = SupportTicketManifest.Create(options.EffectivePhysicalization);

await new SqliteGroundworkMaterializer(connection)
    .MaterializeAsync(manifest, Provider("groundwork-sqlite"), cancellationToken);

IDocumentStore store = new SqliteDocumentStore(connection, manifest);
```

The same sample can use PostgreSQL, SQL Server, or MongoDB by swapping the materializer and store implementation. The repository tests the support-ticket API contract against provider-neutral behavior, including optimistic concurrency, duplicate ticket handling, declared index queries, comments, and optimized physicalization.

The write API stays small:

```csharp
var saved = await store.SaveAsync(new SaveDocumentRequest(
    "supportTicket",
    ticket.TicketNumber,
    "1.0.0",
    JsonSerializer.Serialize(ticket, json)));

var openTickets = await store.QueryAsync(
    new DocumentStoreQuery("supportTicket", "by-status", "open", skip: 0, take: 25));

var updated = await store.SaveAsync(new SaveDocumentRequest(
    "supportTicket",
    ticket.TicketNumber,
    "1.0.0",
    JsonSerializer.Serialize(ticket, json),
    ExpectedVersion: saved.Document!.Version));
```

The expected version is not decorative. Providers use it for optimistic concurrency, and stale writes return a concurrency conflict instead of silently overwriting the current document.

For Elsa, primitives like that are useful because they are boring in the right way. They let extension and module code express normal durable data needs without taking a dependency on the provider's internal model.

## The boundary is the point

Groundwork is a standalone Valence Works library, and that independence matters.

It started from persistence foundation work around Elsa, but the `Groundwork.*` packages do not reference Elsa packages. The repository has tests that enforce that boundary. Generic storage concepts are not named after Elsa domains.

That is not just tidiness.

If Groundwork is going to help Elsa, it cannot become "Elsa persistence internals with a different package name". It needs to stay generic enough for other .NET applications, while still being shaped by the real pressure of a workflow engine that has to run across providers.

The payoff for Elsa is a clearer persistence architecture:

- extension-owned business data can have a provider-neutral manifest
- provider packages can own materialization mechanics
- runtime hot paths can stay specialized when their guarantees require it
- benchmark-gated workloads can be evaluated with the right evidence
- unsupported portable queries can fail clearly instead of drifting by provider

That last point is easy to underestimate. A framework does not only need abstractions that make things possible. It needs boundaries that make the wrong thing harder to do accidentally.

Groundwork gives Elsa one of those boundaries.

Not for every persistence problem.

But for the growing class of module, extension, and application-defined storage that needs to follow Elsa across providers, it gives us a better starting point than another pile of provider-specific code.
