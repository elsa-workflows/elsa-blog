---
title: "Groundwork: Modular Persistence Without Relational Lock-In"
slug: "groundwork-and-the-persistence-boundary-in-elsa"
description: "Groundwork came from a concrete Elsa maintenance problem: avoiding per-module EF Core migrations across providers, without giving up document databases such as MongoDB."
publishedAt: "2026-06-12"
updatedAt: "2026-06-12"
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
seoTitle: "Groundwork: Modular Persistence Without Relational Lock-In"
seoDescription: "Groundwork gives Elsa module-friendly persistence without maintaining EF Core migrations for every module and provider, while keeping relational and document databases in scope."
redirectFrom: []
---

# Groundwork: Modular Persistence Without Relational Lock-In

I started Groundwork because Elsa's persistence story was becoming too expensive to maintain.

Elsa is modular. Modules need durable state. In a typical .NET application, the obvious answer is EF Core, and for many applications that is exactly the right answer. You define entities, configure mappings, generate migrations, and move on.

That model gets less pleasant when you are building a framework.

If every Elsa module that needs persistence owns EF Core migrations, every storage change starts multiplying. A module needs a new table or index. That change needs to work for SQLite, SQL Server, PostgreSQL, and any other relational provider we support. The next module has its own migrations. The next provider has its own differences. Over time, a lot of the work is not really domain work anymore. It is migration maintenance.

And that is only the first half of the problem.

The second half is that I did not want Elsa's modular persistence story to become relational-only.

Something like YesSQL is very close to what I wanted in one sense. It gives you document-like persistence on top of relational databases and avoids the "every module brings its own EF model and migration set" problem. That is a useful model.

But Elsa should not force the host application into a relational database just because a module needs durable state. If an application is using MongoDB, that should not become a second-class deployment option.

So the thing I wanted was roughly this:

Module-friendly persistence, without per-module EF Core migrations, and without assuming every provider is relational.

That is where Groundwork came from.

## The missing layer

Groundwork is not an ORM in the usual sense. It is a small persistence foundation that lets a module describe its storage needs before a provider decides how to materialize them.

The key object is a `StorageManifest`.

A manifest says: this module owns these storage units, this is their schema version, these capabilities are required, these fields are indexed, these queries are expected, and this is how physicalized the provider is allowed to make the storage.

The support-ticket sample in the Groundwork repository is intentionally ordinary. It has tickets and comments. Tickets have a string identity, JSON content, optimistic concurrency, a unique ticket number, and queryable fields such as customer, status, assignee, and priority.

The top-level manifest is small:

```csharp
public static StorageManifest Create(PhysicalizationPolicy physicalization) =>
    new(
        new StorageManifestIdentity("support-tickets"),
        new StorageManifestOwner("groundwork.sample.support"),
        new StorageManifestVersion(SchemaVersion),
        [
            TicketUnit(physicalization),
            CommentUnit(physicalization)
        ],
        new HashSet<string> { "schema-history", "optimistic-concurrency" },
        []);
```

The module is not creating an EF Core migration here. It is not creating a MongoDB collection either. It is declaring intent.

One storage unit looks like this:

```csharp
new StorageUnit(
    new StorageUnitIdentity(DocumentKind),
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
    physicalization);
```

That is the level of abstraction I wanted for Elsa modules. Not "here is a SQL table", and not "here is a Mongo collection", but "here is the durable shape this module needs".

## Indexes are part of the contract

The part that makes this work is that Groundwork is deliberately modest about queries.

For portable document storage, a module declares indexes up front:

```csharp
private static IReadOnlyList<IndexDeclaration> TicketIndexes() =>
[
    Keyword(ByTicketNumber, "ticketNumber", isUnique: true),
    Keyword(ByCustomer, "customerId"),
    Keyword(ByStatus, "status"),
    Keyword(ByAssignee, "assigneeId"),
    Keyword(ByPriority, "priority")
];
```

Each index is a contract with the provider. In the sample, `Keyword` creates a one-field keyword index that supports equality:

```csharp
new IndexDeclaration(
    identity,
    [new IndexField(field)],
    IndexValueKind.Keyword,
    isUnique,
    true,
    MissingValueBehavior.Excluded,
    new HashSet<PortableQueryOperation> { PortableQueryOperation.Equal });
```

That narrowness is intentional.

If a provider-neutral layer accepts arbitrary queries, it usually ends up lying. Either one provider supports a query well, another provider scans too much data, or the abstraction grows provider-specific escape hatches until the shared contract stops meaning anything.

Groundwork starts smaller. Equality queries over declared indexes are portable. Undeclared indexes fail clearly. Provider-specific optimization can still happen, but it happens behind the provider boundary.

For Elsa, that is important. A module should not accidentally work on PostgreSQL and then become unusable on MongoDB because it smuggled in a relational assumption.

## Providers materialize the same intent differently

Once a manifest exists, the provider owns the mechanics.

In the support-ticket sample, startup creates the manifest and then chooses a provider:

```csharp
var manifest = SupportTicketManifest.Create(options.EffectivePhysicalization);

await new SqliteGroundworkMaterializer(connection)
    .MaterializeAsync(manifest, Provider("groundwork-sqlite"), cancellationToken);

IDocumentStore store = new SqliteDocumentStore(connection, manifest);
```

The same sample can swap the provider:

```csharp
await new MongoDbGroundworkMaterializer(database)
    .MaterializeAsync(manifest, Provider("groundwork-mongodb"), cancellationToken);

IDocumentStore store = new MongoDbDocumentStore(database, manifest);
```

That is the distinction Groundwork is trying to preserve.

The module declares one manifest. SQLite, SQL Server, PostgreSQL, and MongoDB do not have to use the same physical structure. Relational providers can use document envelopes, declared index rows, schema history, and projection tables where appropriate. MongoDB can use native collections and native indexes.

Same intent. Different mechanics.

This is why the YesSQL comparison is useful but not quite enough. YesSQL-style persistence solves a real modularity problem, but it assumes the relational world. Groundwork keeps the module-facing model similar in spirit while letting a document database be a real provider, not an afterthought.

## The application code stays boring

The document-store API is intentionally small.

Saving a support ticket looks like this in the sample repository:

```csharp
await store.SaveAsync(
    new SaveDocumentRequest(
        SupportTicketManifest.DocumentKind,
        ticket.TicketNumber,
        SupportTicketManifest.SchemaVersion,
        Serialize(ticket)),
    cancellationToken);
```

Querying uses a declared index:

```csharp
var envelopes = await store.QueryAsync(
    new DocumentStoreQuery(
        SupportTicketManifest.DocumentKind,
        SupportTicketManifest.ByStatus,
        "open"),
    cancellationToken);
```

Updating can use optimistic concurrency:

```csharp
await store.SaveAsync(
    new SaveDocumentRequest(
        SupportTicketManifest.DocumentKind,
        ticket.TicketNumber,
        SupportTicketManifest.SchemaVersion,
        Serialize(ticket),
        expectedVersion),
    cancellationToken);
```

There is nothing especially glamorous here, which is part of the point.

Module code should be able to save, load, update, and query its own durable documents without taking a dependency on EF Core migrations or MongoDB-specific setup. The provider package can still do serious provider work. It just does not leak that work into every module.

## What this could mean for Elsa

For Elsa, the aim is mostly about reducing persistence maintenance while keeping provider choice real.

It gives modules a way to declare storage without bringing migration files for every relational provider. It gives provider packages a common contract to materialize. It gives document databases a place in the architecture instead of treating them as a special case after the relational model has already won.

That does not mean every Elsa store should be forced through the same generic document-store shape.

This is an important distinction. Groundwork can be the provider-neutral foundation underneath Elsa persistence while still exposing more specialized contracts for runtime workloads.

Bookmarks, workflow instances, scheduler state, execution mailboxes, outbox records, logs, locks, and leases all have different requirements. Some need resume-oriented indexes. Some need append and retention behavior. Some need claiming, ordering, retry, expiry, or compare-and-set semantics.

Those workloads should not sit outside Groundwork just because they are more specialized. They probably need Groundwork-backed contracts that describe their real behavior instead of flattening everything into ordinary document storage.

That boundary matters.

The useful thing is not that Groundwork hides all database differences. It does not, and it should not pretend to.

The useful thing is that an Elsa module can describe durable intent once, and the selected provider can decide how to make that intent real.

That is the layer I wanted.
