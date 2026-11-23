---
title: "Building Elsa 4 · Week 20: Migrating the Host You Actually Deploy"
slug: "building-elsa-4-week-20"
description: "The Elsa CLI discovers and runs EF Core migrations from the deployed host's packages, with explicit validation before production features activate."
publishedAt: "2026-09-25"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","persistence","operations"]
series: "Building Elsa 4"
---

# Building Elsa 4 · Week 20: Migrating the Host You Actually Deploy

*September 18–24, 2026*

Last week we switched the reference hosts to EF Core. This week we worked on something that matters once you deploy a host assembled from packages. The migrations you review and apply need to come from the same feature versions and provider assemblies that the host will use when it starts. [EF host switch](https://github.com/elsa-workflows/elsa-foundation/pull/1763), [ADR 0076](https://github.com/elsa-workflows/elsa-foundation/blob/0df6778fbf/docs/adr/0076-persistence-tooling-runs-inside-the-host-closure.md)

## One set of compiled migrations

In the repo, a script can point `dotnet ef` at a design-time factory. A packaged `Elsa.Foundation.Host` can discover its features and their providers through Nuplane. The tool therefore launches a worker using the target host's build output and resolves migration tooling in that host's dependency set. That makes the packaged path and the in-process path produce the same migration artifact for the same inputs. [CLI and worker](https://github.com/elsa-workflows/elsa-foundation/pull/1907)

`dotnet elsa persistence` can list modules, plan and generate reviewable SQL where supported, and check generated scripts. `apply` and `validate` operate on the compiled migrations for the selected modules. An operator can pass the connection through an environment variable or stdin, keeping the connection string out of the process arguments. [Plan and script commands](https://github.com/elsa-workflows/elsa-foundation/pull/1907), [Apply and validation](https://github.com/elsa-workflows/elsa-foundation/pull/1908)

We also changed when migration checks run. The Production reference configuration validates at startup, leaving schema changes to an explicit deployment step. Under that policy, enabling a feature with a pending migration is refused before the enabled feature set is saved. That second check matters when features can be turned on after the host has started. [Production validation policy](https://github.com/elsa-workflows/elsa-foundation/pull/1898), [Feature activation guard](https://github.com/elsa-workflows/elsa-foundation/pull/1912)

## Two places where the layout matters

EF's default schema setting affects the model. The migration SQL generator reads the schema from each migration operation. Elsa now passes the configured schema through to those operations, including nested ones, so a module can query and migrate the same tables using one set of compiled migrations. [Schema-aware migration operations](https://github.com/elsa-workflows/elsa-foundation/pull/1838)

We also divided the source trees into Essentials, Extensions, and Apps. The separation gave the engine and Studio clearer homes for the code needed by a base installation, optional capabilities, and runnable hosts. On the backend, the move followed a separate build gate for the core. [Foundation layout](https://github.com/elsa-workflows/elsa-foundation/pull/1929), [Studio layout](https://github.com/elsa-workflows/elsa-foundation-studio/pull/519)

The ten required tooling slices landed and ADR 0076 was accepted. That gave us a way to answer whether one deployed host had the schema it needed. The next problem was coordinating what hosts could read and write when a fleet was halfway through an upgrade. [Tooling closeout](https://github.com/elsa-workflows/elsa-foundation/pull/1925), [Rolling schema design](https://github.com/elsa-workflows/elsa-foundation/pull/1949)
