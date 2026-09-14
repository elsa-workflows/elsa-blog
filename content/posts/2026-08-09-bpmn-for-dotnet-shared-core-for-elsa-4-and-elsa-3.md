---
title: "BPMN for .NET: The Shared Core for Elsa 4 and Elsa 3"
slug: "bpmn-for-dotnet-shared-core-for-elsa-4-and-elsa-3"
description: "BPMN for .NET separates BPMN 2.0 semantics and XML interchange from workflow hosting. Elsa 4 uses its interchange packages, and Elsa 3 now has a main-branch integration."
publishedAt: "2026-08-09"
updatedAt: "2026-09-14"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "bpmn"
  - "dotnet"
  - "elsa-workflows"
  - "workflow-engine"
  - "open-source"
featuredImage: "../assets/2026-08-09-bpmn-for-dotnet-shared-core-for-elsa-4-and-elsa-3/featured.png"
featuredImageAlt: "A technical workbench with one BPMN process core connected to two different workflow runtime structures."
seoTitle: "BPMN for .NET: One Core for Elsa 4 and Elsa 3"
seoDescription: "BPMN for .NET provides host-neutral BPMN 2.0 interchange and semantics. Elsa 4 uses it, and Elsa 3 now has an end-to-end integration on main."
redirectFrom: []
related:
  - "why-elsa-4-rebuilding-a-dotnet-workflow-engine"
  - "elsa-3-8-preview-1"
---

# BPMN for .NET: The Shared Core for Elsa 4 and Elsa 3

Elsa 4 has a BPMN implementation. When this article was first published, Elsa 3 did not. That created a slightly uncomfortable engineering question: should we port the implementation back, keep two copies, or make Elsa 3 depend on an Elsa 4 package and its release train?

None of those is a good long-term answer.

The better boundary turned out to be one we had already discovered while building BPMN support in Elsa 4: the code that knows what BPMN means is mostly independent from the code that knows how Elsa runs work. That observation led to [BPMN for .NET](https://bpmnfor.net/), a new MIT-licensed library for BPMN 2.0 interchange and semantics. Elsa 4 consumes the extracted interchange packages. Since this article was published, Elsa 3 has gained an end-to-end integration on its `main` branches. Read [BPMN in Elsa 3: Import, Bind, Run, and Export](/blog/bpmn-in-elsa-3-import-bind-run-export) for the current product slice and its limitations.

> **Key Takeaways**
> - BPMN for .NET owns BPMN 2.0 XML, the object model, and process semantics—not persistence, scheduling, retries, or I/O.
> - The project's survey covered 88 C# repositories and 50 NuGet packages, but found no maintained, license-clean library with this exact boundary.
> - Elsa 4 already consumes the shared interchange packages. Elsa 3 now has a main-branch integration tracked for 3.9, but it is not part of the 3.8.1 package line.

The project site is [bpmnfor.net](https://bpmnfor.net/), and the source is available at [github.com/valence-works/bpmn](https://github.com/valence-works/bpmn).

## The awkward gap in .NET BPMN tooling

There are plenty of projects with “BPMN” in the name. The [survey behind BPMN for .NET](https://github.com/valence-works/bpmn#the-gap-this-fills) examined 88 C# repositories matching that term and 50 NuGet packages. So the problem wasn't a lack of search results. It was a lack of a particular kind of dependency.

Some results are full workflow engines. Some are clients for a BPMN server. Some render diagrams. Some use a BPMN-inspired format without reading standard BPMN 2.0 XML. A few small projects interpret a subset of the notation. These can all be useful, but they solve different problems.

What we needed was more boring, and in practice harder to find:

- a typed BPMN 2.0 object model;
- an XML reader and writer that don't discard diagram data or vendor extensions;
- process semantics that can be hosted inside an existing engine;
- a permissive license and no dependency on a particular runtime.

That last part matters. A workflow engine usually already has persistence, scheduling, retries, correlation, expressions, messaging, multitenancy, and operational tooling. Taking a dependency on another engine to gain BPMN semantics would give it two competing answers for all of those concerns.

## It is an interpreter, not a workflow engine

The entire design can be reduced to one function:

```text
(process definition, current token state, one event)
    -> (next state, commands for the host)
```

The library decides how tokens move, when gateways join, which event wins a race, what an interrupting boundary event cancels, and the order in which compensation runs. It then returns commands describing what the host should do. The [host-port documentation](https://github.com/valence-works/bpmn/blob/main/docs/concepts/host-port.md) defines three: start work, cancel a work subtree, and signal an enclosing scope.

It does not start a timer, call an API, persist state, evaluate a FEEL expression, or retry a failed activity. Those are host responsibilities. In Elsa, they remain Elsa responsibilities.

That separation is easy to describe after the fact. The useful evidence came from the implementation. [ADR 0001](https://github.com/valence-works/bpmn/blob/main/docs/adr/0001-bpmn-semantics-ship-as-a-host-agnostic-library.md) records that roughly 2,550 lines of token coordination, gateway and event behavior, graph validation, and state mutation referenced no Elsa runtime types. Host coupling was concentrated in a 64-line scheduling adapter and an 89-line persistence adapter.

The semantics were already a library. They just lived inside a workflow engine.

## How is it different from the .NET BPMN options?

The honest answer isn't “more features.” It is a different boundary.

The project's [comparison of the most relevant alternatives](https://github.com/valence-works/bpmn#how-this-compares) groups the .NET options into a few recognizable categories. BPMNEngine is an actual BPMN engine, but its GPL-3.0 license is a constraint for many commercial products. BPMN.Sharp is the nearest interchange-oriented comparison, but its library source isn't public and it depends on `System.Drawing.Common`. Zeebe clients deploy BPMN files to a broker as opaque payloads. WorkflowCore is a mature .NET workflow engine, but it doesn't import BPMN.

This isn't a criticism of those projects. If you run Camunda or Zeebe, the official client is probably the correct dependency. If you want a ready-made engine and GPL works for you, BPMNEngine may fit. If you want a general .NET workflow engine rather than BPMN semantics, use Elsa or WorkflowCore.

BPMN for .NET is for the layer underneath those product decisions. It is split into four packages:

| Package | Responsibility |
| --- | --- |
| `Bpmn.Model` | Immutable BPMN model, execution-state records, diagram layout, and retained extensions |
| `Bpmn.Interchange` | BPMN 2.0 XML reading, writing, and import diagnostics |
| `Bpmn.Semantics` | Deterministic token-semantics interpreter |
| `Bpmn.Runtime.InMemory` | Non-durable reference host for simulation and testing |

That split means a linter, converter, migration tool, or documentation generator can use the interchange half without pulling in an interpreter. Every shipped package has zero external NuGet dependencies, and architecture checks enforce that the neutral assemblies don't acquire a host dependency later.

There is another detail I care about: round-tripping is content-lossless, not byte-identical. Formatting may change, but BPMN DI layout and foreign `extensionElements` such as `camunda:*`, `zeebe:*`, and `flowable:*` survive. The reader also reports element-scoped `Info`, `Degraded`, and `Dropped` findings instead of quietly pretending every construct mapped cleanly.

## The small port between BPMN and Elsa

The host port is what makes one semantics implementation usable by two generations of Elsa.

When the interpreter returns `StartWork`, an Elsa adapter resolves the binding to an actual activity. That might be a delay, an event subscription, a message publish, another workflow, or a custom activity. Elsa schedules it, assigns its own handle, persists the resulting state, and later calls the interpreter again when the work completes, faults, or sends a signal.

Cancellation is where the design earns its keep. Elsa 4 can stage subtree teardown and flush it as part of its continuation model. Elsa 3 can cancel eagerly by walking its activity-execution context tree. Both behaviors can satisfy the same BPMN command without forcing either engine to adopt the other's runtime mechanics.

A callback-based abstraction would have hidden one engine's timing assumptions inside the library. Returning commands as data leaves those choices with the host, where they belong.

## How it powers Elsa 4

Elsa 4 is the first consumer because that is where the implementation came from. Before extraction, the BPMN work had reached sixteen implemented specs with 247 semantics tests and 107 interchange tests passing in the [recorded baseline](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reports/evidence/bpmn-extraction-baseline/README.md). It is part of the same deliberate re-founding described in [Why Elsa 4?](/blog/why-elsa-4-rebuilding-a-dotnet-workflow-engine).

The extraction doesn't remove BPMN from Elsa. It narrows what Elsa owns.

Under the extraction design, Elsa 4 keeps its `BpmnProcess` activity, feature registration, API endpoints, triggers, recurring schedules, expression integration, activity bindings, and persistence adapter. The shared library owns the BPMN model, XML interchange, token decisions, and the state pruning that requires BPMN knowledge.

This transition is visible in the code. [`Elsa.Activities.Bpmn.Interchange.csproj`](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Bpmn/Interchange/Elsa.Activities.Bpmn.Interchange.csproj) references `Bpmn.Model` and `Bpmn.Interchange` packages. The engine remains the host while the shared packages own the host-neutral pieces.

The package rollout preserved that boundary. The project first released only `Bpmn.Model` and `Bpmn.Interchange`, holding `Bpmn.Semantics` and `Bpmn.Runtime.InMemory` until a second host had tested the interpreter port. Elsa 3 supplied that evidence, and the [0.2.0 release](https://github.com/valence-works/bpmn/releases/tag/v0.2.0) made all four packages stable on August 20, 2026.

## How Elsa 3 now uses the same core

Elsa 3 has a different runtime from Elsa 4. That is exactly why copying the feature or referencing an Elsa 4 package would be the wrong design.

The shared library has no concept of an Elsa activity execution context, bookmark store, background worker, or persistence provider. The Elsa 3 adapter translates the same commands into Elsa 3 scheduling, bookmarks, child activities, and recursive cancellation. Its release can follow Elsa 3's cadence rather than Elsa 4's. That matters because [Elsa 3 continues to evolve on its own line](/blog/elsa-3-8-preview-1).

The current status needs to be stated plainly: [Elsa Foundation ADR 0063](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0063-bpmn-moves-to-a-host-agnostic-library.md) named Elsa 3 as the intended second consumer. That integration now exists on the Elsa Core and Studio `main` branches under the 3.9 milestone, but it is not part of Elsa 3.8.1.

The important change is that BPMN in Elsa 3 no longer means reimplementing BPMN, backporting Elsa 4 internals, or coupling two major versions. The product now imports and binds BPMN documents against the same model and semantics, runs them through an Elsa 3 host adapter, projects runtime diagnostics, and preserves the source for export.

That is a much smaller—and much more maintainable—job.

## What is available now?

The project is new and pre-1.0. Version 0.2.0 of `Bpmn.Model`, `Bpmn.Interchange`, `Bpmn.Semantics`, and `Bpmn.Runtime.InMemory` is available on NuGet. The first two packages can stand alone for tools that only need to read and write BPMN; the latter two add deterministic interpretation and a reference host.

To read and write a BPMN file:

```bash
dotnet add package Bpmn.Interchange
```

```csharp
using Bpmn.Interchange;

var result = new BpmnXmlReader().Read(File.ReadAllText("order.bpmn"));

foreach (var issue in result.Analysis.Issues)
    Console.WriteLine($"{issue.Severity} {issue.ElementId}: {issue.Message}");

File.WriteAllText("order.out.bpmn", new BpmnXmlWriter().Write(result));
```

Nothing in that sample runs a workflow. That is not a missing feature. It is the point of having an interchange package that can stand on its own.

## A few practical questions

### Can I use BPMN for .NET as a production workflow engine?

No. It provides BPMN interchange and semantics, not durable execution infrastructure. Use Elsa, WorkflowCore, a BPMN platform, or your own host for persistence, timers, messaging, retries, and distributed coordination.

### Does Elsa 3 support BPMN now?

On its `main` branches, yes. The Core and Studio integration can import, bind, run, diagnose, and export BPMN documents. It is tracked for Elsa 3.9 and is not part of the 3.8.1 stable package line. See the [current Elsa 3 BPMN guide](/blog/bpmn-in-elsa-3-import-bind-run-export) for the implemented slice and its limitations.

### Does it support every BPMN-adjacent standard?

No. BPMN for .NET doesn't implement DMN, CMMN, FEEL evaluation, modeling UI, rendering, or XSD validation. Its scope is deliberately narrower: BPMN 2.0 model, interchange, and token semantics.

## One core, two hosts

This library exists because BPMN support should not belong to one version of one workflow engine.

Elsa 4 gave the implementation somewhere real to grow up. Extracting the model and semantics now lets Elsa 4 keep moving without making Elsa 3 a fork, a copy, or a downstream consumer of Elsa 4 internals. It also gives the wider .NET ecosystem a useful set of packages that don't require adopting Elsa at all.

That is the balance we wanted: one implementation of what BPMN means, and room for each host to decide how work actually gets done.

Explore [BPMN for .NET at bpmnfor.net](https://bpmnfor.net/), browse the [source on GitHub](https://github.com/valence-works/bpmn), or follow the [Elsa 4 integration decision](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0063-bpmn-moves-to-a-host-agnostic-library.md).

## Primary sources

- [BPMN for .NET README](https://github.com/valence-works/bpmn/blob/main/README.md), Valence Works, retrieved 2026-08-09.
- [ADR 0001: BPMN semantics ship as a host-agnostic library](https://github.com/valence-works/bpmn/blob/main/docs/adr/0001-bpmn-semantics-ship-as-a-host-agnostic-library.md), Valence Works, 2026-08-09.
- [The host port](https://github.com/valence-works/bpmn/blob/main/docs/concepts/host-port.md), Valence Works, retrieved 2026-08-09.
- [ADR 0063: BPMN moves to a host-agnostic library](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/adr/0063-bpmn-moves-to-a-host-agnostic-library.md), Elsa Workflows, 2026-08-09.
- [BPMN extraction baseline](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/reports/evidence/bpmn-extraction-baseline/README.md), Elsa Workflows, retrieved 2026-08-09.
