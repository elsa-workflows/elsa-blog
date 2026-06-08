---
title: "Elsa Studio Has a Real Dashboard Now"
slug: "the-elsa-studio-dashboard-is-split-on-purpose"
description: "Elsa 3.8 turns Studio's sparse home page into a real operational dashboard with workflow and diagnostics widgets, backed by a modular composition model."
publishedAt: "2026-06-08"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "studio"
  - "extensibility"
featuredImage: "../assets/2026-06-08-the-elsa-studio-dashboard-is-split-on-purpose/featured.png"
featuredImageAlt: "Editorial illustration of a modular operational dashboard assembled from workflow and diagnostics panels around a central workflow view"
seoTitle: "Elsa Studio Has a Real Dashboard Now"
seoDescription: "Elsa 3.8 replaces Studio's mostly empty dashboard with a real operational surface: metrics, trends, recent activity, hotspots, and diagnostics widgets."
redirectFrom: []
---

# Elsa Studio Has a Real Dashboard Now

Until recently, the Elsa Studio dashboard was basically a heading, a docs link, and a lot of empty space.

That is not a complaint so much as a phase.

Dashboards are easy to postpone when the harder work is elsewhere: workflow execution, designer UX, persistence, diagnostics, secrets, alterations, and the rest of the runtime story. You can always come back and build a proper operational surface later.

Elsa 3.8 is that "later".

Studio now has a real dashboard.

Not a placeholder page. Not a mostly empty landing screen with room for future ideas. An actual operational dashboard with workflow metrics, attention items, trends, recent activity, hotspots, and diagnostics widgets.

The work landed across both repositories over the last week:

- [`elsa-core` PR #7681](https://github.com/elsa-workflows/elsa-core/pull/7681) added the operational Dashboard API.
- [`elsa-core` PR #7690](https://github.com/elsa-workflows/elsa-core/pull/7690) refactored the API around contributors.
- [`elsa-core` PR #7692](https://github.com/elsa-workflows/elsa-core/pull/7692) extracted dashboard contributors into companion modules.
- [`elsa-studio` PR #871](https://github.com/elsa-workflows/elsa-studio/pull/871) replaced the old Studio home with the operational dashboard.
- [`elsa-studio` PR #879](https://github.com/elsa-workflows/elsa-studio/pull/879) refactored dashboard widgets.
- [`elsa-studio` PR #887](https://github.com/elsa-workflows/elsa-studio/pull/887) added feature-gated dashboard widget composition.

The old page is easy to summarize because it really was that small. Before PR #871, `src/modules/Elsa.Studio.Dashboard/Pages/Index.razor` rendered a page heading, the text "Manage all the things", and a docs link alert. The dashboard feature itself was an empty `FeatureBase` subclass.

In Elsa 3.8, that module has been completely reworked.

## What you get now

The new dashboard is built as an operational surface rather than a welcome page.

The dashboard shell renders:

- a backend label,
- runtime status,
- a last-refreshed indicator,
- time-range toggles,
- a refresh action,
- and widget zones for metrics, findings, primary panels, diagnostics status, and secondary panels.

That layout matters because it gives the page a job. It is there to help you understand what the selected backend is doing right now.

The out-of-box widgets are the part most people will notice first.

The current Studio dashboard tests register seven built-in widgets when the dashboard shell and companion modules are installed:

- workflow metrics
- needs attention
- workflow trends
- recent activity
- workflow hotspots
- structured logs
- console logs

That is a big change from "dashboard as empty real estate".

Here is the new dashboard in the modular server sample, with the workflow and diagnostics widgets visible together:

![Elsa Studio 3.8 dashboard showing workflow metrics, needs-attention findings, execution trend, recent activity, structured logs, console logs, and workflow hotspots](../assets/2026-06-08-the-elsa-studio-dashboard-is-split-on-purpose/dashboard.png)

The bundle wiring reflects that shift too. The default Studio hosts register `AddDashboardModule`, `AddWorkflowsDashboardModule`, `AddConsoleLogsDashboardModule`, and `AddStructuredLogsDashboardModule`. In other words, this is not just an abstract extension point sitting around waiting for someone else to use it. Elsa itself now ships a richer dashboard story.

There is one important nuance: the diagnostics and workflow dashboard companions are remote-gated. If the selected backend does not advertise the matching dashboard shell features, Studio does not pretend the widget is available.

That is the right tradeoff. A dashboard should feel honest about what the backend can actually provide.

## Why the rebuild matters

The visible change is the new dashboard itself.

The architectural change is what stops it from turning into a dead end.

Most dashboards get awkward once every useful module wants to add one more panel. Workflow wants metrics. Diagnostics wants log status. Another package wants health information. Another wants queue pressure. Soon the dashboard module becomes the one place that has to know too much about everything else.

Elsa is deliberately avoiding that.

The [Studio dashboard README](https://github.com/elsa-workflows/elsa-studio/blob/release/3.8.0/src/modules/Elsa.Studio.Dashboard/README.md) says it plainly: `Elsa.Studio.Dashboard` provides the shell and shared widget contracts, but it does not own workflow, console log, or structured log data loading.

That work belongs to companion modules.

In practice, the dashboard shell owns things like:

- the route,
- refresh and range state,
- widget zones,
- the shared widget context,
- and the rendering surface.

The workflow module contributes workflow widgets. The console logs module contributes console widgets. The structured logs module contributes structured log widgets.

That keeps the dashboard package from turning into an orchestration point for every other package in Studio while still letting the default Elsa bundle feel complete.

You can see the model directly in the widget registrations:

```csharp
widgetRegistry.Add(new("dashboard.workflow.metrics", DashboardWidgetZones.Metrics, 100, typeof(DashboardWorkflowMetricsWidget), "Workflow metrics", PayloadKind: "WorkflowInstances"));
widgetRegistry.Add(new("diagnostics.structured-logs", DashboardWidgetZones.DiagnosticsStatus, 100, typeof(StructuredLogsDashboardWidget), "Structured logs", RequiredBackendCapability: "StructuredLogs", PayloadKind: "Diagnostics.StructuredLogs"));
widgetRegistry.Add(new("diagnostics.console-logs", DashboardWidgetZones.DiagnosticsStatus, 200, typeof(ConsoleLogsDashboardWidget), "Console logs", RequiredBackendCapability: "ConsoleLogs", PayloadKind: "Diagnostics.ConsoleLogs"));
```

That sounds simple, but it means the dashboard host only needs to understand zones and descriptors. It does not need compile-time knowledge of every widget it might ever render.

## The backend follows the same pattern

The backend side mirrors the same idea.

The [Dashboard API README](https://github.com/elsa-workflows/elsa-core/blob/release/3.8.0/src/modules/Elsa.Dashboard.Api/README.md) describes `Elsa.Dashboard.Api` as the owner of public `/dashboard/*` routes, permissions, range resolution, and contributor orchestration. Feature modules own the data they contribute.

That is what `IDashboardContributor` is for.

Instead of teaching the dashboard API module how workflows, console logs, and structured logs all work internally, those modules contribute the slices they own:

- overview data,
- findings,
- trends,
- recent activity,
- and hotspots.

The nice part is that contributor failures are isolated. One diagnostics contributor can fail without taking down the whole dashboard response.

That is exactly the kind of behavior you want from an operational page.

## Why the shell split is still worth knowing about

If you are just using Studio, the headline is simple: Elsa 3.8 gives you a real dashboard instead of a mostly empty one.

If you are extending Studio, the more interesting detail is how Elsa got there.

For example, the workflow dashboard companion feature in Studio is marked with:

```csharp
[RemoteFeature("Elsa.Workflows.Runtime.Dashboard.ShellFeatures.WorkflowRuntimeDashboard")]
```

The console and structured log dashboard companions do the same thing with their own remote feature names.

That gives Studio a clean answer to a common modular-host problem: what should happen when the UI package is installed, but the backend feature is not?

The answer is not "render a broken card and explain it later".

The companion feature only initializes when the backend advertises the matching capability. So the dashboard shell can stay installed and coherent while individual slices appear only when they are actually supported.

If you are building your own Elsa-based module, that is a much better boundary than hard-coding one big dashboard page with a growing list of conditional branches.

For most readers, though, the main point is more concrete than that.

Elsa Studio now has a dashboard that deserves to be called a dashboard. And it got there without painting itself into a corner for the next round of widgets.
