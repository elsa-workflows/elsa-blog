---
title: "OpenTelemetry Diagnostics in Elsa 3.8"
slug: "opentelemetry-diagnostics-in-elsa-3-8"
description: "A deeper look at Elsa 3.8 OpenTelemetry diagnostics, including workflow instrumentation, OTLP ingestion, local diagnostics storage, and the Studio viewer."
publishedAt: "2026-06-04"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Product"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "opentelemetry"
  - "observability"
featuredImage: "../assets/2026-06-04-opentelemetry-diagnostics-in-elsa-3-8/featured.png"
featuredImageAlt: "Generated technical illustration of workflow telemetry signals flowing into a local collector and trace diagnostics workspace"
seoTitle: "OpenTelemetry Diagnostics in Elsa 3.8"
seoDescription: "Elsa 3.8 adds OpenTelemetry workflow instrumentation, OTLP diagnostics ingestion, bounded local telemetry storage, and a Studio diagnostics viewer."
redirectFrom: []
---

# OpenTelemetry Diagnostics in Elsa 3.8

There are two different OpenTelemetry stories in Elsa 3.8, and it is worth keeping them separate.

The first is telemetry production. Elsa emits workflow and activity instrumentation through `System.Diagnostics`, using the `Elsa.Workflows` activity source and meter.

The second is diagnostics viewing. The new `Elsa.Diagnostics.OpenTelemetry` module can receive recent OTLP telemetry, keep it in a bounded diagnostics store, and expose normalized views to Elsa Studio.

If those two ideas get collapsed into one sentence, the feature sounds like "Elsa added an OpenTelemetry dashboard". That is not quite right.

The more useful framing is this: Elsa now has first-party workflow telemetry, and Studio can inspect recent telemetry through a local diagnostics collector when you want that operational view close to the workflow runtime.

## Workflow instrumentation

Elsa emits spans around workflow execution cycles and activity execution. The spans include workflow and activity identifiers, definition metadata, status, tenant ID when available, and fault status.

It deliberately does not add workflow input, activity input, output payloads, headers, or variable values as span attributes.

That is the right default. Telemetry should help you understand execution without quietly turning observability into another place where sensitive or high-cardinality data leaks.

The basic .NET setup is standard OpenTelemetry:

```csharp
services.AddOpenTelemetry()
    .WithTracing(builder => builder
        .AddSource("Elsa.Workflows")
        .AddOtlpExporter())
    .WithMetrics(builder => builder
        .AddMeter("Elsa.Workflows")
        .AddOtlpExporter());
```

The meter emits workflow and activity measurements such as:

- `elsa.workflow.started`
- `elsa.workflow.completed`
- `elsa.workflow.faulted`
- `elsa.activity.duration`

Faulted workflow and activity spans use an error status and record the exception type when an exception is available. Elsa does not add exception messages or stack traces to workflow span events.

Again, that is a privacy and cardinality tradeoff. If a host wants more detail, it can add its own instrumentation, but the framework default should be conservative.

## Trace context through HTTP activities

Workflow systems often sit in the middle of other systems. A workflow receives a request, calls an API, waits, resumes, sends another request, and so on.

If each step becomes a separate trace island, the picture is incomplete.

In Elsa 3.8, outbound `SendHttpRequest` and `FlowSendHttpRequest` calls inject the current W3C trace context headers when an active workflow or activity span exists. Downstream services can continue the same trace without needing Elsa-specific middleware.

You still need normal .NET HTTP client instrumentation if you want outbound HTTP spans from the host. Elsa's job here is to keep the trace context moving across the workflow boundary.

## The diagnostics collector

The `Elsa.Diagnostics.OpenTelemetry` module is collector and read-side infrastructure. It does not create workflow spans, mutate `Activity.Current`, export telemetry to vendors, or provide durable OpenTelemetry persistence.

It receives OTLP HTTP/protobuf telemetry under:

```text
POST /elsa/otlp/v1/traces
POST /elsa/otlp/v1/metrics
POST /elsa/otlp/v1/logs
```

Studio reads normalized diagnostics data through the Elsa API:

```text
POST /elsa/api/diagnostics/opentelemetry/resources/search
POST /elsa/api/diagnostics/opentelemetry/traces/search
GET  /elsa/api/diagnostics/opentelemetry/traces/{traceId}
POST /elsa/api/diagnostics/opentelemetry/metrics/search
POST /elsa/api/diagnostics/opentelemetry/logs/search
GET  /elsa/api/diagnostics/opentelemetry/storage
GET  /elsa/api/diagnostics/opentelemetry/collector-configuration
```

Live updates use the diagnostics hub:

```text
/elsa/hubs/diagnostics/opentelemetry
```

The default collector path is useful for local development and focused troubleshooting. For example:

```bash
OTEL_SERVICE_NAME=elsa-server
OTEL_RESOURCE_ATTRIBUTES=service.instance.id=local-dev
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5000/elsa/otlp/v1
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_BSP_SCHEDULE_DELAY=1000
OTEL_METRIC_EXPORT_INTERVAL=1000
```

If the collector is exposed beyond loopback, configure the API key option. The collector configuration endpoint returns endpoint and required-header names, but it does not return secret header values.

That distinction matters. Studio can help you configure a sender without becoming a place where collector secrets are displayed.

## The Studio view

Studio adds the OpenTelemetry diagnostics page at:

```text
/diagnostics/opentelemetry
```

![Elsa Studio OpenTelemetry diagnostics page showing resources, traces, metrics, logs, dropped telemetry, and trace rows](../assets/2026-06-01-elsa-3-8-preview-1/opentelemetry-viewer.png)

The module is a viewer for Core DTOs. It does not parse OTLP protobuf payloads in the browser. Core owns ingestion, redaction, storage, permissions, and API contracts. Studio renders resources, traces, trace details, metrics, OTLP logs, storage diagnostics, and collector configuration.

This gives the UI a clean boundary. If the wire format or storage behavior changes, Core changes with the contract. Studio stays focused on the operator workflow.

The viewer includes the pieces you would expect from a small diagnostics surface: resource search, trace search, trace detail and waterfall layout, metric series rows, OTLP log search, live updates, filters, export behavior, and storage overflow state.

It also keeps OpenTelemetry separate from structured logs and console logs. Correlation can happen through trace IDs, span IDs, resource values, and time windows, but the signals are not forced into one generic table.

## Bounded local storage

The default OpenTelemetry diagnostics store is bounded and in memory.

Capacity options cover traces, spans, metric points, OTLP log records, and live subscriber queues. When a buffer exceeds capacity, the oldest item for that signal is dropped and diagnostics counters are incremented.

This is the same kind of operational honesty that the logging modules use. If the local diagnostics store is under pressure, Studio should be able to show that pressure instead of pretending the view is complete.

For production observability, you should usually export to an external OpenTelemetry Collector or observability backend. Those systems are built for retention, search, alerting, dashboards, scaling, and long-term analysis.

Elsa's local collector is not trying to replace them.

It is for the times when you want recent workflow-relevant telemetry available from Studio without standing up a full observability environment for every local or preview deployment.

That is a smaller promise, but a useful one.
