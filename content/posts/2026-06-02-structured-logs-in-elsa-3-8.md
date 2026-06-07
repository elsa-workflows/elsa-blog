---
title: "Structured Logs in Elsa 3.8"
slug: "structured-logs-in-elsa-3-8"
description: "A closer look at Elsa 3.8 structured logs: semantic ILogger capture, workflow correlation, source metadata, redaction, live streaming, and SQLite persistence."
publishedAt: "2026-06-02"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Product"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "observability"
  - "logging"
featuredImage: "../assets/2026-06-02-structured-logs-in-elsa-3-8/featured.png"
featuredImageAlt: "Generated technical illustration of semantic log events flowing from a workflow service into a diagnostics workspace"
seoTitle: "Structured Logs in Elsa 3.8"
seoDescription: "Elsa 3.8 adds structured log diagnostics for semantic ILogger events, workflow correlation, source metadata, redaction, live streaming, and SQLite persistence."
redirectFrom: []
---

# Structured Logs in Elsa 3.8

One of the easiest ways to make a workflow system hard to operate is to treat all runtime output as text.

Text is useful. Sometimes it is the fastest way to understand what just happened. But an `ILogger` event is not just a line of text. It has a level, category, message template, rendered message, properties, scopes, exception details, and often trace or workflow context around it.

That structure is the useful part.

Elsa 3.8 preview 1 adds `Elsa.Diagnostics.StructuredLogs`, an opt-in diagnostics module for capturing semantic `ILogger` records from an Elsa host and surfacing them in Studio.

This is separate from console log streaming. Console logs answer "what did this process write to stdout or stderr?" Structured logs answer "what did the application report as a typed diagnostic event, and what context came with it?"

Those are related questions, but they are not the same question.

## The shape of a structured log

The structured logs module registers an `ILoggerProvider` that captures application log events and passes them through a small pipeline:

```text
ILogger event
  -> structured log provider
  -> redaction
  -> queryable store
  -> live feed
  -> REST and SignalR
  -> Elsa Studio
```

The records include the things operators usually need when they are trying to narrow a problem down:

- level and category
- message template and rendered message
- properties and scopes
- exception details
- trace ID and span ID
- tenant and correlation values
- workflow definition and workflow instance context where available
- source metadata such as machine, process, pod, namespace, container, and node

That last part is easy to underestimate.

In local development, "the server" often means one process in one terminal. In production, it might mean several containers across nodes. If a log viewer flattens that into one anonymous stream, it removes information that is often needed during an incident.

Elsa tracks source metadata so Studio can show where an event came from.

## Reading logs from Studio

Studio adds the viewer at:

```text
/diagnostics/structured-logs
```

![Elsa Studio structured logs viewer with filters, live connection state, and recent log rows](../assets/2026-06-01-elsa-3-8-preview-1/structured-log-viewer.png)

The page loads a recent backfill and then subscribes to live events over SignalR. From there, you can filter by level, category, message, tenant, workflow instance, source, trace ID, and span ID.

Workflow instance screens can deep-link into the structured logs page with the workflow instance filter already applied:

```text
/diagnostics/structured-logs?workflowInstanceId={workflowInstanceId}
```

Trace-focused links can do the same with trace and span values:

```text
/diagnostics/structured-logs?traceId={traceId}&spanId={spanId}
```

The page is not trying to be a full logging platform. It is trying to make the recent operational state of an Elsa host visible from the same UI where you inspect workflows.

That is a narrower goal, and I think it is the right one for this feature.

## Bounded by default

The default store is in memory. It keeps a bounded recent buffer and exposes recent records through REST:

```text
POST /elsa/api/diagnostics/structured-logs/recent
GET  /elsa/api/diagnostics/structured-logs/sources
GET  /elsa/api/diagnostics/structured-logs/storage
```

Live updates are exposed through the hub:

```text
/elsa/hubs/diagnostics/structured-logs
```

That makes the feature easy to turn on for development, support sessions, and focused troubleshooting. It also means the default history is process-local. If the process restarts, the in-memory history is gone. If you run several nodes, each node has its own source and buffer.

That is a tradeoff, not an accident.

For many environments, recent in-process diagnostics are enough. For durable storage, Elsa 3.8 also includes SQLite structured log persistence through `Elsa.Diagnostics.StructuredLogs.Persistence.Sqlite`.

```csharp
services.AddElsa(elsa =>
{
    elsa.UseStructuredLogs(structuredLogs =>
    {
        structuredLogs.UseSqliteStorage("Data Source=elsa-structured-logs.db", sqlite =>
        {
            sqlite.RunMigrationsOnStartup = true;
            sqlite.Relational.WriteQueue.Capacity = 10_000;
            sqlite.Relational.WriteQueue.BatchSize = 100;
        });
    });
});
```

The persistence boundary is deliberately split. The core structured logs package knows about capture, redaction, stores, live feeds, and contracts. The relational package supplies shared relational behavior. The SQLite package supplies the provider-specific connection factory, dialect, and migrations.

That keeps the door open for other storage providers without making the core diagnostics package depend on one database.

## Redaction belongs before delivery

Structured logs can carry sensitive values if application code puts sensitive values into properties, scopes, exception messages, or rendered text.

The module passes events through `IStructuredLogRedactor` before buffering or streaming. `StructuredLogsOptions` lets hosts extend the sensitive property names and text patterns that should be masked.

This does not make careless logging safe.

It does give the diagnostics module a clear safety boundary: values should be redacted before they enter recent storage, live delivery, or endpoint responses. That is the right place for this feature to do its part.

## Enabling the module

At the host level, the shape is intentionally small:

```csharp
services.AddElsa(elsa =>
{
    elsa.UseStructuredLogs(options =>
    {
        options.RecentLogCapacity = 5_000;
        options.MaxRecentLogQuerySize = 1_000;
        options.SourceHeartbeatTimeout = TimeSpan.FromSeconds(30);
    });
});

app.UseStructuredLogs();
```

The endpoints require the structured log diagnostics read permission:

```text
read:diagnostics:structured-logs
```

Studio hides the navigation item when the remote feature or permission is unavailable, and the direct route has unavailable and unauthorized states. That matters for diagnostics features, because "the page exists" should not be the same thing as "everyone can read runtime logs".

## Why not just use console logs?

Because the two surfaces lose value when they are forced into one model.

Console logs are raw process output. They are useful when an external tool writes to stdout, when a developer uses `Console.WriteLine`, or when ANSI output already carries the shape you want to inspect.

Structured logs are application events. They are useful when you need fields, categories, scopes, exception data, source metadata, workflow context, and correlation.

The UI should let each surface be itself.

Structured logs in Elsa 3.8 are a step toward making workflow hosts easier to operate without pretending Elsa Studio is your whole observability stack. You will still want proper centralized logging in serious production environments.

But when you are inside Studio, looking at a workflow instance, and need to answer "what did the backend say about this?", having the semantic log stream one click away is a very practical improvement.
