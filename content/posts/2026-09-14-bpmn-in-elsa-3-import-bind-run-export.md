---
title: "BPMN in Elsa 3: Import, Bind, Run, and Export"
slug: "bpmn-in-elsa-3-import-bind-run-export"
description: "Elsa 3 now has an end-to-end BPMN path on its main branch: analyze and import BPMN 2.0, bind tasks to Elsa activities, run the process, inspect diagnostics, and export it again."
publishedAt: "2026-09-14"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "bpmn"
  - "elsa-workflows"
  - "dotnet"
  - "workflow-engine"
  - "elsa-studio"
featuredImage: "../assets/2026-09-14-bpmn-in-elsa-3-import-bind-run-export/featured.png"
featuredImageAlt: "A pale technical illustration of a BPMN process document passing through an Elsa-blue binding layer into a running workflow and back again"
seoTitle: "BPMN in Elsa 3: Import, Bind, Run, and Export"
seoDescription: "See how Elsa 3 imports BPMN, binds tasks to Elsa activities, runs the process, projects diagnostics, and preserves the source for export."
redirectFrom: []
related:
  - "bpmn-for-dotnet-shared-core-for-elsa-4-and-elsa-3"
  - "elsa-3-8-stable-upgrade-guide"
  - "why-elsa-payloads-change-shape-after-persistence"
---

# BPMN in Elsa 3: Import, Bind, Run, and Export

Elsa 3's BPMN work has crossed an important boundary. It is no longer only a shared-library design or a proposed adapter. The current `main` branches of Elsa Core and Elsa Studio contain an end-to-end path for analyzing a BPMN 2.0 file, importing it, binding its work to Elsa activities, running it, inspecting what happened, and exporting the document again.

That does not make BPMN part of the current stable package line. The work is tracked under the [Elsa 3.9 milestone](https://github.com/elsa-workflows/elsa-core/issues/7909) and is not present in the 3.8.1 tags. There is no package date to announce yet. This article describes what is implemented on `main` so teams can evaluate the model without mistaking it for a stable release.

> **Key Takeaways**
> - The BPMN document remains the source of truth; Elsa derives an executable activity graph from it.
> - Studio can import a `.bpmn` file, show analysis findings, bind a task to an Elsa activity, display runtime diagnostics, and export the retained document.
> - BPMN-aware authoring is deliberately narrow today. The diagram is read-only, and nested process bodies are not directly editable through the document API.
> - Document saves use an `ETag` and `If-Match`, but each persistence provider must implement the compare-and-swap contract for that protection to be complete.

## One document, three views

The cleanest way to understand the implementation is as three views of one process.

| View | Owns | Why it exists |
| --- | --- | --- |
| BPMN document | Standard elements, sequence flows, diagram layout, foreign extensions, Elsa bindings | Portable source of truth |
| Elsa activity graph | Bound work such as delays, events, messages, child workflows, and custom activities | Executable projection for the Elsa runtime |
| Execution diagnostics | Element and flow identifiers attached to runtime events | Operational feedback on the BPMN diagram |

This separation prevents a common round-trip failure. If export reconstructed BPMN from the Elsa activity graph, it would lose information Elsa does not execute directly, including diagram coordinates and vendor extension elements. Elsa therefore stores the imported source and updates it through BPMN-aware operations. The activity graph is derived from that source, not promoted into a replacement for it.

The design builds on the host-neutral model described in [BPMN for .NET: The Shared Core for Elsa 4 and Elsa 3](/blog/bpmn-for-dotnet-shared-core-for-elsa-4-and-elsa-3). What changed this week is the Elsa 3 product integration around that core.

## Import starts with analysis, not optimism

In Studio, **Import BPMN** accepts a `.bpmn` file and shows the reader's findings before the definition is created. Findings are grouped as `Info`, `Degraded`, or `Dropped`, which matters because syntactically valid BPMN is not the same as a fully executable Elsa workflow.

The backend exposes separate analyze and import endpoints. Analyze reads the document without persisting it. Import also checks whether the host supports every capability the process needs, including nested scopes, and refuses unsupported shapes with a structured error instead of creating a definition that fails only when someone runs it.

Enable the complete path with the interchange feature:

```csharp
services.AddElsa(elsa =>
{
    elsa.UseBpmnInterchange();
});
```

`UseBpmnInterchange()` includes the execution feature. Use `UseBpmn()` by itself only when code constructs `BpmnProcess` activities and no XML interchange is needed.

## Binding turns BPMN work into Elsa work

BPMN describes the intent of a task, but it cannot know which activity type and inputs a particular Elsa host should use. The binder provides that bridge.

Some elements map directly. Timer waits become `Delay`, message and signal catches become `Event`, message throws become `PublishEvent`, call activities become `DispatchWorkflow`, and embedded subprocesses become nested `BpmnProcess` activities. Service, send, user, and script tasks remain unbound until an author chooses their implementation.

Studio exposes that choice in the task's **Performed by** panel. The author selects a registered Elsa activity and configures its inputs. Elsa records the binding inside the BPMN document as an `elsa:activityBinding` extension, so the configuration travels with the exported file instead of living in a separate, easy-to-lose sidecar.

This is a useful compatibility boundary. The BPMN element keeps its portable identity, while the extension states how this Elsa installation performs the work. Import rejects an unknown activity type, an unknown input, or a duplicate input name rather than silently ignoring the mismatch.

## Runtime events return to the diagram

Gateways, events, and sequence flows are decisions inside the BPMN interpreter. They do not all become child Elsa activities. Without an explicit projection, an operator looking only at ordinary activity execution records would miss much of the process path.

The runtime now projects BPMN diagnostics into Elsa's execution log with the relevant `elementId` and, where applicable, `flowId`. Studio uses those identifiers to overlay execution state on the read-only diagram. Token emission, scheduling, joining, consumption, and faults can therefore be related to the BPMN model even when no standalone activity represents the element.

Projection also survives [suspension and resume](/blog/suspended-workflows-and-elsa-upgrades) without duplicating earlier entries. The scope tracks the last diagnostic it published before the interpreter prunes its bounded in-memory diagnostic list. That makes the overlay an operational view, not merely a design-time preview.

## Export protects the original model

Export returns the retained BPMN document rather than reverse-engineering one from the workflow definition. That preserves BPMN DI layout, foreign attributes, unrecognized children, and vendor extensions.

There is a deliberate refusal rule: if an ordinary workflow-designer edit changes the derived activity graph without updating the BPMN source, export returns `422` instead of handing back a plausible but stale document. A BPMN-aware document update takes the other path. It writes the JSON document back to XML, analyzes and binds it again, creates a new draft, and refreshes both the source and graph together.

The document API uses a strong `ETag`. A client reads the document, edits it, and sends that exact value in `If-Match`. A missing precondition returns `428`; a stale one returns `412`. This keeps two editors from quietly overwriting each other.

There is one provider caveat. The compare-and-swap operation is implemented by the in-memory and Entity Framework Core definition stores. MongoDB, Dapper, and Event Sourcing stores still need to implement `TryUpdateLatestAsync` before the same guarantee is complete there. Treat that as a deployment constraint, not a minor implementation detail.

## What is intentionally not editable yet

Studio's BPMN diagram is currently a read-only topology view. Authors can import, inspect, bind tasks, view diagnostics, and export, but cannot yet move shapes or draw new BPMN elements on the canvas. Visual editing remains open work.

Nested subprocess bodies also require care. The document JSON exposes the subprocess element but not the elements inside its body. On update, Elsa restores that body from the stored BPMN source when the subprocess identity still matches. This preserves nested content during an unrelated top-level binding edit, but it does not provide direct nested-process authoring through the document endpoint.

Those limits are preferable to pretending the editor is lossless before it is. The current slice makes supported edits safe and rejects states that would produce a misleading export.

## What teams can do now

If you want to evaluate the feature before 3.9 packages exist, use a development build from the matching Core and Studio `main` branches. Keep the experiment isolated from a 3.8.x production deployment; the [Elsa 3.8 stable upgrade guide](/blog/elsa-3-8-stable-upgrade-guide) describes the current packaged line.

1. Enable `UseBpmnInterchange()` in a test host.
2. Import a representative `.bpmn` file and review every `Degraded` or `Dropped` finding.
3. Bind unbound tasks in Studio, then export the file and inspect the retained `elsa:` extensions.
4. Run the workflow through suspension and resume, and verify the diagram diagnostics against the execution log.
5. If you test concurrent document edits, use the in-memory or EF Core store until your provider implements the compare-and-swap contract.

Do not infer a NuGet availability date from merged pull requests. The useful signal today is that the architecture has been exercised across import, execution, diagnostics, Studio binding, guarded updates, and export. Packaging is a separate release decision.

## Frequently asked questions

### Is BPMN support available in Elsa 3.8.1?

No. The implementation described here is on the Elsa Core and Studio `main` branches and is tracked for Elsa 3.9. The 3.8.1 release tags do not contain these BPMN commits.

### Can Studio visually edit an imported BPMN diagram?

Not yet. The current diagram shows topology and runtime diagnostics. Studio can bind tasks through the **Performed by** panel, but moving shapes and drawing BPMN elements remain open work.

### Will an exported file retain non-Elsa extensions?

Yes, for a document that remains in sync. Elsa stores and returns the imported source so BPMN DI and foreign extensions survive. If an ordinary designer edit makes the source stale, export refuses rather than returning an outdated file.

## A complete vertical slice, with honest edges

The significant change is not that Elsa can parse XML or render a diagram. It is that one BPMN document now connects portable process notation to executable Elsa activities and back to operator-visible runtime evidence without making the derived graph the source of truth.

That is the right foundation for broader authoring. It also leaves clear edges: no 3.8.1 package, no promised release date, no visual canvas editing yet, and a compare-and-swap requirement that persistence providers must implement explicitly. Those constraints make the current behavior easier to trust because the product refuses to claim fidelity it cannot provide.

## Primary sources

- [BPMN implementation issue #7909](https://github.com/elsa-workflows/elsa-core/issues/7909), Elsa Workflows, closed 2026-09-12.
- [Elsa 3 BPMN workflow documentation](https://github.com/elsa-workflows/elsa-core/blob/0be3d5fb993df681b7f53b07e93fc37f096a4627/doc/wiki/bpmn-workflows.md), Elsa Workflows, retrieved 2026-09-14.
- [BPMN document API and guarded round-trip, PR #8060](https://github.com/elsa-workflows/elsa-core/pull/8060), Elsa Workflows, merged 2026-09-12.
- [Runtime diagnostics projection, PR #8058](https://github.com/elsa-workflows/elsa-core/pull/8058), Elsa Workflows, merged 2026-09-12.
- [Studio import and export, PR #1012](https://github.com/elsa-workflows/elsa-studio/pull/1012), Elsa Workflows, merged 2026-09-08.
- [Studio task binding, PR #1031](https://github.com/elsa-workflows/elsa-studio/pull/1031), Elsa Workflows, merged 2026-09-12.
- [Studio diagnostics overlay, PR #1033](https://github.com/elsa-workflows/elsa-studio/pull/1033), Elsa Workflows, merged 2026-09-12.
