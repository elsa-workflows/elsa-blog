---
title: "Groundwork: Provider-Neutral Persistence for Elsa"
slug: "groundwork-and-the-persistence-boundary-in-elsa"
description: "Groundwork came from an Elsa maintenance problem: module-friendly persistence without per-module EF Core migrations or relational-only assumptions."
publishedAt: "2026-06-12"
updatedAt: "2026-06-30"
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
seoTitle: "Groundwork: Provider-Neutral Persistence for Elsa"
seoDescription: "Groundwork came from an Elsa maintenance problem: module-friendly persistence without per-module EF Core migrations or relational-only assumptions."
redirectFrom: []
---

# Groundwork: Provider-Neutral Persistence for Elsa

I started Groundwork because Elsa's persistence boundary was getting too expensive to maintain. Elsa is modular, modules need durable state, and every new provider or module can multiply the work if persistence is expressed as provider-specific migrations everywhere.

EF Core is still a good answer for many .NET applications. The problem is different when you are building a framework with many modules and several persistence providers. Elsa's public persistence guide already has to explain EF Core, MongoDB, and Dapper-style provider choices ([Elsa persistence guide](https://github.com/elsa-workflows/elsa-gitbook/blob/main/guides/persistence/README.md), retrieved 2026-06-30). The next step is reducing how much of that provider complexity each module has to own.

> **Key Takeaways**
> - Groundwork lets a module describe storage intent once through a `StorageManifest`.
> - Providers can materialize that intent differently for SQLite, SQL Server, PostgreSQL, or MongoDB.
> - Elsa still needs specialized persistence contracts for runtime workloads such as claiming, leases, mailboxes, retention, and ordered consumption.

In our experience, the hard part is not saving JSON. The hard part is drawing the boundary so modules stay modular and providers still get to be real providers.

## What problem did Groundwork solve?

**Groundwork** is a provider-neutral persistence foundation for .NET modules. A module declares storage units, schema version, capabilities, indexes, queries, tenancy, concurrency, serialization, and physicalization policy before any provider decides how to create tables, collections, indexes, or projection structures.

The model came from a concrete Elsa problem. If each module owns its own EF Core migrations, a small schema change can become a SQLite migration, a SQL Server migration, a PostgreSQL migration, a test matrix update, and a compatibility question for every module.

That maintenance cost is only half the issue. I also did not want Elsa's modular persistence story to become relational-only. YesSQL shows a useful document-on-relational pattern ([YesSQL](https://github.com/sebastienros/yessql), retrieved 2026-06-30), but Elsa should not make MongoDB a second-class deployment option just because a module needs durable state.

Groundwork is the missing layer between module intent and provider mechanics.

## What does a storage manifest describe?

A `StorageManifest` describes what a module needs. In the support-ticket sample, the manifest declares one storage unit with string IDs, JSON serialization, optimistic concurrency, a unique ticket-number index, customer/status/assignee/priority indexes, and query declarations.

The trimmed shape looks like this:

```csharp
const string DocumentKind = "supportTicket";
const string SchemaVersion = "1.0.0";

var manifest = new StorageManifest(
    new StorageManifestIdentity("support-tickets"),
    new StorageManifestOwner("sample.support"),
    new StorageManifestVersion(SchemaVersion),
    [
        new StorageUnit(
            new StorageUnitIdentity(DocumentKind),
            "Support ticket",
            StorageIntent.PortableDocument(),
            LifecyclePolicy.Mutable,
            IdentityPolicy.StringId(),
            TenancyPolicy.None,
            ConcurrencyPolicy.Optimistic(),
            SerializationPolicy.Json(),
            [
                Keyword("by-ticket-number", "ticketNumber", isUnique: true),
                Keyword("by-status", "status", physicalization: IndexPhysicalizationPolicy.Optimized)
            ],
            [
                Query("find-by-ticket-number", "by-ticket-number"),
                Query("list-by-status", "by-status", QuerySortSupport.Both, QueryPagingSupport.Offset)
            ],
            PhysicalizationPolicy.Portable)
    ],
    new HashSet<string> { "schema-history", "optimistic-concurrency" },
    []);
```

The module is not creating a SQL table. It is not creating a MongoDB collection. It is declaring the durable shape it needs.

That distinction is the point. It gives Elsa modules a way to declare intent without tying every module to every provider's physical model.

## Why are indexes part of the contract?

Groundwork keeps portable querying deliberately narrow. A module declares indexes and declares which query operations are supported against those indexes. The current portable query contract supports closed server-side queries over declared indexes, including comparisons such as equality, `In`, and `Contains`, with constrained ordering and paging.

That modesty is intentional. A provider-neutral abstraction that accepts arbitrary queries usually starts lying. One provider may index the query well, another may scan too much data, and a third may require a provider-specific escape hatch.

Groundwork takes the opposite approach. Declare what you need. If a query depends on an undeclared index or unsupported operation, fail clearly.

The provider tests enforce those boundaries. Unique indexes are enforced by providers. Stale optimistic-concurrency updates do not update the document or its indexes. MongoDB tests cover the same save, load, update, query, delete, and index-maintenance behavior as relational providers.

## How do providers materialize the same intent?

Providers own the mechanics. A SQLite provider can use relational document envelopes, index rows, schema history, and physicalized indexes. A MongoDB provider can use native collections and native indexes.

The module-facing manifest stays the same.

Current SQLite setup goes through a materialization plan:

```csharp
var connection = new SqliteConnection("Data Source=support-tickets.db");
var plan = new MaterializationPlanner(new StorageManifestValidator(), new ProviderCapabilityValidator())
    .Plan(
        manifest,
        SqliteGroundworkCapabilities.Runtime(),
        SqliteGroundworkCapabilities.Materialization());

await new SqliteGroundworkMaterializer(connection).MaterializeAsync(plan);

IDocumentStore store = new SqliteDocumentStore(connection, manifest);
```

MongoDB uses the same manifest but different provider capabilities and materializer:

```csharp
var client = new MongoClient("mongodb://localhost:27017");
var database = client.GetDatabase("support");
var plan = new MaterializationPlanner(new StorageManifestValidator(), new ProviderCapabilityValidator())
    .Plan(
        manifest,
        MongoDbGroundworkCapabilities.Runtime(),
        MongoDbGroundworkCapabilities.Materialization());

await new MongoDbGroundworkMaterializer(database).MaterializeAsync(plan);

IDocumentStore store = new MongoDbDocumentStore(database, manifest);
```

Same intent. Different physicalization.

That is the provider boundary I wanted for Elsa.

## What does module code look like?

The document-store API is intentionally boring. Save a document, query through a declared index, and use optimistic concurrency when updating:

```csharp
var created = await store.SaveAsync(new SaveDocumentRequest(
    DocumentKind,
    "TCK-1001",
    SchemaVersion,
    JsonSerializer.Serialize(new
    {
        ticketNumber = "TCK-1001",
        customerId = "acme",
        status = "open",
        priority = "high"
    })));

var openTickets = await store.QueryAsync(
    new DocumentStoreQuery(DocumentKind, "by-status", "open", skip: 0, take: 25));

var updated = await store.SaveAsync(new SaveDocumentRequest(
    DocumentKind,
    "TCK-1001",
    SchemaVersion,
    JsonSerializer.Serialize(new
    {
        ticketNumber = "TCK-1001",
        customerId = "acme",
        status = "assigned",
        priority = "high"
    }),
    ExpectedVersion: created.Document!.Version));
```

Nothing here should feel magical. That is deliberate. Module code should not need to know whether the selected provider created a relational envelope plus index table or a MongoDB collection plus native indexes.

## Where is the Elsa boundary?

Groundwork should reduce persistence maintenance for Elsa modules, but it should not flatten every runtime workload into ordinary document storage.

Workflow instances, bookmarks, scheduler state, execution mailboxes, outbox records, logs, locks, leases, and retention queues have different requirements. Some need atomic claiming. Some need ordered consumption. Some need compare-and-set semantics, retry recovery, expiry, or operational diagnostics.

Those workloads still need specialized contracts. Groundwork can sit underneath those contracts, but the contract should describe the real behavior rather than pretending everything is a generic document query.

This fits the broader Elsa direction: [NuPlane](/blog/introducing-nuplane-nuget-packages-as-a-runtime-primitive) gives packages a runtime boundary, and [shell features](/blog/configuring-elsa-with-shell-features) give modules a composition boundary. Groundwork is the persistence boundary.

## What should teams take from this?

Groundwork is not an ORM replacement for every application. It is a foundation for modular systems where storage intent needs to outlive one provider's physical model.

For Elsa, the goal is practical: fewer per-module migrations, less provider-specific duplication, and a real path for both relational and document databases.

The useful thing is not hiding every database difference. Groundwork should not pretend SQLite, SQL Server, PostgreSQL, and MongoDB are the same. The useful thing is giving Elsa modules one way to describe durable intent, then letting the selected provider make that intent real.

That is the layer I wanted.
