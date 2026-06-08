---
title: "The Elsa Studio Dashboard Is Split on Purpose"
slug: "the-elsa-studio-dashboard-is-split-on-purpose"
description: "Why Elsa's new operational dashboard is split into a shell and companion modules, and why that matters for extension authors."
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
featuredImageAlt: "Editorial illustration of a central operational dashboard assembled from modular workflow and diagnostics components"
seoTitle: "The Elsa Studio Dashboard Is Split on Purpose"
seoDescription: "A practical look at Elsa's composable dashboard model: dashboard shell, companion modules, backend contributors, and remote-gated widgets."
redirectFrom: []
---

# The Elsa Studio Dashboard Is Split on Purpose

There is a small design choice in the new Elsa dashboard that is easy to miss.

The dashboard is not one feature. It is a shell.

That sounds like an implementation detail, but it changes the extension story quite a bit once you stop treating Studio as one fixed application and start treating it as a modular host.

Most dashboards start life as a page with some charts on it. Then a workflow panel appears. Then a diagnostics panel. Then one module wants to add a health card, another wants a recent-activity table, and pretty soon the dashboard module knows too much about the rest of the system.

Elsa 3.8 is taking a different route.

The relevant work landed across both repositories over the last week:

- [`elsa-core` PR #7681](https://github.com/elsa-workflows/elsa-core/pull/7681) added the operational Dashboard API.
- [`elsa-core` PR #7690](https://github.com/elsa-workflows/elsa-core/pull/7690) refactored the API around contributors.
- [`elsa-core` PR #7692](https://github.com/elsa-workflows/elsa-core/pull/7692) extracted dashboard contributors into companion modules.
- [`elsa-studio` PR #871](https://github.com/elsa-workflows/elsa-studio/pull/871) replaced the old Studio home with the operational dashboard.
- [`elsa-studio` PR #879](https://github.com/elsa-workflows/elsa-studio/pull/879) refactored dashboard widgets.
- [`elsa-studio` PR #887](https://github.com/elsa-workflows/elsa-studio/pull/887) added feature-gated dashboard widget composition.

The important bit is not the page itself. It is the dependency direction behind it.

## The dashboard host does not own workflow and diagnostics data

The [Studio dashboard README](https://github.com/elsa-workflows/elsa-studio/blob/release/3.8.0/src/modules/Elsa.Studio.Dashboard/README.md) says it plainly: `Elsa.Studio.Dashboard` provides the shell and shared widget contracts, but it does not own workflow, console log, or structured log data loading.

That work belongs to companion modules.

In practice, the dashboard shell owns things like:

- the route,
- refresh and range state,
- widget zones,
- the shared widget context,
- and the rendering surface.

The workflow module contributes workflow widgets. The console logs module contributes console widgets. The structured logs module contributes structured log widgets.

That keeps the dashboard package from turning into an orchestration point for every other package in Studio.

You can see the model directly in the widget registrations:

```csharp
widgetRegistry.Add(new("dashboard.workflow.metrics", DashboardWidgetZones.Metrics, 100, typeof(DashboardWorkflowMetricsWidget), "Workflow metrics", PayloadKind: "WorkflowInstances"));
widgetRegistry.Add(new("diagnostics.structured-logs", DashboardWidgetZones.DiagnosticsStatus, 100, typeof(StructuredLogsDashboardWidget), "Structured logs", RequiredBackendCapability: "StructuredLogs", PayloadKind: "Diagnostics.StructuredLogs"));
widgetRegistry.Add(new("diagnostics.console-logs", DashboardWidgetZones.DiagnosticsStatus, 200, typeof(ConsoleLogsDashboardWidget), "Console logs", RequiredBackendCapability: "ConsoleLogs", PayloadKind: "Diagnostics.ConsoleLogs"));
```

That sounds simple, but it means the dashboard host only needs to understand zones and descriptors. It does not need compile-time knowledge of every widget it might ever render.

## Remote feature gating is part of the design, not an afterthought

The other useful part is that companion features are remote-gated.

For example, the workflow dashboard companion feature in Studio is marked with:

```csharp
[RemoteFeature("Elsa.Workflows.Runtime.Dashboard.ShellFeatures.WorkflowRuntimeDashboard")]
```

The console and structured log dashboard companions do the same thing with their own remote feature names.

That gives Studio a clean answer to a common modular-host problem: what should happen when the UI package is installed, but the backend feature is not?

The answer is not "render a broken card and explain it later".

The companion feature only initializes when the backend advertises the matching capability. So the dashboard shell can stay installed and coherent while individual slices appear only when they are actually supported.

If you are building your own Elsa-based module, that is a much better boundary than hard-coding one big dashboard page with a growing list of conditional branches.

## Core follows the same dependency direction

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

That is the sort of behavior you usually want in an operational surface. Diagnostics and status pages should degrade better than the rest of the app, not worse.

## Why this matters

If you only use the stock Studio packages, this can feel like internal refactoring.

It is more than that.

It means Elsa now has a clearer pattern for feature-owned operational UI:

- backend feature modules contribute dashboard data instead of pushing it all into one aggregator,
- Studio feature modules contribute widgets instead of forcing the dashboard shell to know every panel,
- feature availability can follow backend capability advertising,
- and adding one new dashboard slice does not require turning the dashboard package into the place where all dependencies meet.

That last point tends to matter more over time than it does on day one.

A modular system usually gets into trouble when the "host" module quietly becomes the only place allowed to compose useful things. Elsa's new dashboard split pushes back against that.

## It is a good pattern beyond dashboards

I think this is the more interesting lesson.

The dashboard is just where the pattern became visible.

Once a product has shell features, remote feature gating, package-provided capabilities, and multiple optional operational surfaces, the real question is not "can we add one more page?"

It is "where should that page's ownership live?"

For Elsa, the answer here is: keep the shell small, let feature packages describe themselves, and let companion modules plug in only when the backend actually supports them.

That is not flashy work.

But it is the kind of design choice that makes modular systems much easier to live with a few months later.
