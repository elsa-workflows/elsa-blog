---
title: "ConsoleLogStreaming"
slug: "console-log-streaming"
description: "Streaming console output from distributed applications in real time"
publishedAt: "2026-05-27"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "dotnet"
  - "logging"
  - "observability"
  - "distributed-systems"
featuredImage: "../assets/2026-05-27-console-log-streaming/featured.png"
featuredImageAlt: "Dark terminal interface showing console log output streamed to connected clients in real time"
seoTitle: "ConsoleLogStreaming"
seoDescription: "Streaming console output from distributed applications in real time"
redirectFrom: []
---

# ConsoleLogStreaming

While working on Elsa Studio, I needed a simple way to stream console output from running workflows to the browser in real time.

Not persisted logs.
Not a full observability stack.
Just live console output.

The idea behind ConsoleLogStreaming is straightforward:

- capture console output,
- expose it through a REST API,
- allow client applications to subscribe to the stream.

The project lives here:

https://github.com/valence-works/console-log-streaming

## Why?

Elsa workflows can execute long-running processes involving:

- background jobs,
- HTTP calls,
- AI agents,
- distributed execution,
- resumable workflows,
- and external systems.

When such workflows run from Elsa Studio, it's useful to see what's happening while the workflow executes.

For example:

```text
Dispatching workflow...
Calling external API...
Waiting for signal...
Workflow resumed...
Completed.
```

That sort of feedback makes debugging much easier and gives users visibility into what the runtime is doing.

## Basic setup

The library is intentionally lightweight.

Register the services:

```csharp
builder.Services.AddConsoleLogStreaming();
```

Enable the middleware:

```csharp
app.UseConsoleLogStreaming();
```

And that's basically it.

Console output written using:

```csharp
Console.WriteLine("Hello world");
```

becomes available to connected clients.

Pretty neat.

## Streaming logs to a client

A client application can subscribe to the stream and receive console output in real time.

Something along these lines:

```javascript
const eventSource = new EventSource("/console-logs");

eventSource.onmessage = e => {
    console.log(e.data);
};
```

This makes it easy to integrate live runtime output into:

* dashboards,
* workflow designers,
* admin portals,
* orchestration UIs,
* or debugging tools.

## Using it from Elsa Studio

One of the places where this is currently used is Elsa Studio.

When workflows execute, runtime output can be streamed directly to the UI, making it much easier to understand what's happening during execution.

Especially with:

* long-running workflows,
* background activities,
* AI agents,
* and distributed task execution.

Being able to surface runtime activity live from the server turns out to be surprisingly useful.

## Final thoughts

This project is intentionally small in scope.

It's not trying to replace structured logging systems or observability platforms.

It simply provides a lightweight mechanism for exposing console output to remote clients in real time.

Sometimes that's all you need.

Project repository:

[https://github.com/valence-works/console-log-streaming](https://github.com/valence-works/console-log-streaming)
