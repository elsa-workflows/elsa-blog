---
title: "Building Elsa 4 · Week 19: Why We Went Back to EF Core"
slug: "building-elsa-4-week-19"
description: "A Secrets pilot puts EF Core back on the table, and Elsa 4 switches its first-party stores and default hosts to the EF Core persistence family."
publishedAt: "2026-09-18"
status: "published"
authors: ["sipke"]
category: "Engineering"
tags: ["devjournal","persistence","architecture"]
series: "Building Elsa 4"
---

# Building Elsa 4 · Week 19: Why We Went Back to EF Core

*September 11–17, 2026*

We had just moved Elsa 4's first-party persistence to Groundwork. A week later, we were back on EF Core. That turn deserves some explanation. A focused Secrets pilot let us examine what we would own with EF, what operators could do with it, and how it would behave when a feature was loaded into a running host. [Groundwork promotion](https://github.com/elsa-workflows/elsa-foundation/pull/1574), [Secrets pilot verdict](https://github.com/elsa-workflows/elsa-foundation/pull/1655), [ADR 0073 decision](https://github.com/elsa-workflows/elsa-foundation/pull/1685)

## What did the pilot prove?

The pilot kept the Secrets repository contract stable and put an EF implementation behind it. Provider-derived contexts let one module carry provider-specific migrations while keeping provider engines out of the module's package references. The same compiled migrations could be applied at runtime, validated at startup, or applied in a separate operator process. Getting that last part right mattered because the host can load and reload features at shell scope. [Pilot and cost record in ADR 0072](https://github.com/elsa-workflows/elsa-foundation/blob/7d88020084/docs/adr/0072-ef-first-relational-persistence-with-provider-derived-contexts.md)

The numbers complicated the decision. The pilot's EF Secrets module had about 2.5 times the handwritten source of its Groundwork counterpart under the report's counting rules. It also carried the provider migration sets. The case for EF had to rest on its tooling, familiar operating model, and migration ownership. We first recorded a bounded approach for selected relational modules. ADR 0073 then picked one EF Core family for first-party persistence and kept the pilot's results on the record. [ADR 0072 and measured costs](https://github.com/elsa-workflows/elsa-foundation/blob/7d88020084/docs/adr/0072-ef-first-relational-persistence-with-provider-derived-contexts.md), [ADR 0073](https://github.com/elsa-workflows/elsa-foundation/blob/7d88020084/docs/adr/0073-ef-core-is-the-only-first-party-persistence-family.md)

## What actually switched?

Modules received independent migration histories for SQLite, SQL Server, PostgreSQL, and MySQL. The Workbench and Production compositions then moved to EF Core by default, and the reference Docker stack selected PostgreSQL. Workbench kept a separate diagnostics database by default, carrying forward the lesson from last week's contention. [Migration lifecycle](https://github.com/elsa-workflows/elsa-foundation/pull/1755), [Default composition change](https://github.com/elsa-workflows/elsa-foundation/pull/1763)

The host switch and removal were two steps. Once the supported compositions selected EF, the subsequent change removed first-party Groundwork and MongoDB persistence along with their packaging and test lanes. This was a development-preview cutover. Readers following an older preview should treat it as a change of persistence baseline. [Provider cleanup](https://github.com/elsa-workflows/elsa-foundation/pull/1764)

Studio also gave workflow authors two direct controls this week. You could export the executable artifact from the editor and choose a Flowchart's start node. The start node is an authored choice about where an ordinary run begins. We'll return to what happens when a particular trigger starts the workflow in Week 24. [Executable export](https://github.com/elsa-workflows/elsa-foundation-studio/pull/494), [Flowchart start-node selection](https://github.com/elsa-workflows/elsa-foundation-studio/pull/514)
