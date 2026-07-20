---
title: "Why Elsa 4 HTTP Endpoints Fall Back to 202"
slug: "why-elsa-4-http-endpoints-fall-back-to-202"
description: "Elsa 4 HTTP endpoints can return a live workflow-authored response in sync mode, while suspension and distributed execution fall back safely to 202 Accepted."
publishedAt: "2026-07-20"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "http-workflows"
  - "workflow-engine"
  - "software-architecture"
featuredImage: "../assets/2026-07-20-why-elsa-4-http-endpoints-fall-back-to-202/featured.png"
featuredImageAlt: "A soft 3D workflow diagram splits an HTTP request into synchronous and durable response paths."
seoTitle: "Why Elsa 4 HTTP Endpoints Fall Back to 202"
seoDescription: "Elsa 4 HTTP endpoints can return a live workflow-authored response in sync mode, while suspension and distributed execution fall back safely to 202 Accepted."
redirectFrom: []
---

# Why Elsa 4 HTTP Endpoints Fall Back to 202

Elsa 4 now has an explicit answer to a deceptively hard HTTP question: should a workflow keep the request open, or accept the request and continue durably? [`elsa-foundation` PR #605](https://github.com/elsa-workflows/elsa-foundation/pull/605), merged on 2026-07-10, introduced `Async` and `Sync` response modes. A later [typed value-flow change in PR #757](https://github.com/elsa-workflows/elsa-foundation/pull/757) made the response itself a committed activity result.

The useful idea is not simply that synchronous responses are possible. It is that Elsa can only return one while execution remains on the request's local, inline path. When the workflow crosses a durable boundary, the honest response is `202 Accepted`.

> **Key Takeaways**
> - `Async` is the default and returns `202 Accepted` after Elsa starts or resumes the workflow.
> - `Sync` can return the status, headers, and body authored by `WriteHttpResponse`.
> - Suspension, missing response instructions, or non-local execution deliberately fall back to `202`.

> **Elsa 4 status:** These contracts describe the current `elsa-foundation` `main` branch. Elsa 4 remains under active development, so treat the APIs as implementation insight rather than released Elsa 3 configuration guidance.

## What changed in Elsa 4's HTTP endpoint model?

Elsa 4 now exposes two response modes on `HttpEndpoint`: `Async`, the default, and `Sync`. The [response-mode contract](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Http/Core/ResponseMode.cs) keeps this choice separate from route identity, so changing response delivery does not create a different HTTP trigger.

```csharp
public enum ResponseMode
{
    Async = 0,
    Sync
}
```

The distinction is tested as behavior, not just configuration. The [host-level acceptance suite](https://github.com/elsa-workflows/elsa-foundation/blob/main/tests/Elsa/Activities/Http/IntegrationTests/HttpEndpointSyncResponseEndToEndTests.cs) covers six cases: a live authored response, suspension before a response, request timeout, the unchanged async baseline, a mid-flow resume, and protection against persisting live request services.

This extends the execution seam described in [Building Elsa 4 Week 8](/blog/building-elsa-4-week-8). The runtime may drain work inline, but that does not erase the durable workflow model around it.

## Why is `202 Accepted` still the default?

`202 Accepted` is the safe default because starting a durable workflow is not the same as completing an HTTP operation. In async mode, Elsa routes the stimulus, reports the started and resumed execution IDs, and lets workflow processing continue without promising that a response-producing activity will run inside the current request.

That default protects the common long-running case. A workflow might wait for a timer, human task, external message, or another HTTP callback. Holding the original connection open would tie a durable process to a transient network resource.

<!-- [UNIQUE INSIGHT] -->

The key boundary is not “fast workflow” versus “slow workflow.” It is **request-affine execution** versus **durable continuation**. A workflow can be quick and still dispatch to another node. It can also be long enough to suspend immediately. Elsa therefore bases the response on what actually completed within the local dispatch, not on an estimated duration.

## When can a workflow return the live HTTP response?

A `Sync` endpoint can return the workflow-authored response when local dispatch drains far enough to commit a `WriteHttpResponse` result before the request ends. The middleware then delivers that committed instruction to the live ASP.NET Core response.

| What happens during dispatch? | HTTP result |
| --- | --- |
| `WriteHttpResponse` commits a response instruction locally | The authored status, headers, content type, and body |
| The workflow suspends before writing a response | `202 Accepted` with execution IDs |
| The workflow writes no response | `202 Accepted` |
| Execution is forwarded to another runtime node | `202 Accepted` |
| The configured request timeout expires | `408 Request Timeout` |

The mid-flow case is especially useful. A workflow can wait at a synchronous `HttpEndpoint`, then let the **resuming** request receive the subsequent `WriteHttpResponse` result in that same exchange. The original request is not revived; the new request owns its own local response opportunity.

## What happens when the workflow suspends?

Suspension ends the live-response opportunity because the original `HttpContext` is not durable workflow state. The Elsa 4 middleware therefore uses one fallback path: if no response instruction was committed after dispatch, it returns `202 Accepted`.

This makes an old source of confusion explicit. In Elsa 3, [issue #4895](https://github.com/elsa-workflows/elsa-core/issues/4895) documents a workflow that reached `WriteHttpResponse` after a `Delay`. By then the workflow had resumed from background work and no original HTTP context remained. Elsa 4 does not pretend that such a response can still target the old connection.

The fallback also applies to distributed execution. The [forwarding actor](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Runtime/Distributed/Services/ForwardingWorkflowExecutionActor.cs) sends only the durable command envelope to the owning node. Request-affine options are dropped at that process boundary, so another node cannot accidentally inherit a live request.

That is the same operational principle behind safe [suspended-workflow upgrades](/blog/suspended-workflows-and-elsa-upgrades): persist the information needed to continue, never a live runtime resource.

## Why doesn't `WriteHttpResponse` use `HttpContext`?

On current `main`, `WriteHttpResponse` returns a typed `HttpResponseInstruction`; it does not write to `HttpContext`. [Commit `ead8acd9`](https://github.com/elsa-workflows/elsa-foundation/commit/ead8acd9f624994173e4895a8f0804d21d506061) moved HTTP responses into Elsa 4's typed value flow on 2026-07-16.

```csharp
var instruction = new HttpResponseInstruction(
    StatusCode,
    Headers,
    Body,
    ContentType);

return ValueTask.FromResult(ActivityTransition.Complete(instruction));
```

After the activity attempt commits, the request-owned [`HttpResponseInstructionDelivery`](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Http/Services/HttpResponseInstructionDelivery.cs) looks for the committed result and writes it to the response. This keeps the activity isolated and makes the response instruction inspectable as normal workflow output.

<!-- [UNIQUE INSIGHT] -->

That ordering matters. The workflow does not mutate a live response and then hope its activity state commits. It commits an atomic instruction first; only the HTTP adapter touches the transport. The design aligns response delivery with the typed, durable result model instead of creating a second side channel.

## How should workflow authors choose a response mode?

Choose `Async` unless the caller genuinely needs an immediate workflow-authored response and the path is designed to stay local and bounded. Choose `Sync` for request-response workflows that reach `WriteHttpResponse` without waiting at a durable boundary.

Use this checklist:

1. **Keep `Async` for long-running work.** Return execution IDs and let clients query status or receive a later notification.
2. **Use `Sync` for a bounded response path.** Make the status, headers, body, and content type explicit in `WriteHttpResponse`.
3. **Set a request timeout.** A synchronous workflow is still subject to network and host limits.
4. **Treat `202` as a valid outcome.** A sync endpoint can still suspend or execute elsewhere.
5. **Do not persist request services yourself.** Keep application data durable and transport resources request-scoped.

The broader design lesson matches Elsa 4's [inline and deferred event split](/blog/inline-vs-deferred-events-in-elsa-4): timing semantics belong in an explicit contract. They should not hide in an assumption that every invocation will finish in the same process and call stack.

## Frequently asked questions

### Does `Sync` guarantee a non-202 response?

No. `Sync` gives the local inline execution a chance to return a committed `WriteHttpResponse` instruction. If the workflow suspends, writes no response, or dispatches non-locally, the endpoint returns `202 Accepted` with the relevant execution IDs.

### Can a delayed workflow write to the original HTTP response?

No. After a durable suspension, the original request and its `HttpContext` are gone. Resume the workflow with a new request, expose a status endpoint, or notify the caller through another channel instead of retaining the original connection.

### Does this change Elsa 3 HTTP workflow behavior?

No. This post describes Elsa 4 development in `elsa-foundation`. Elsa 3 has its own HTTP workflow implementation and released configuration model. Use the [Elsa 3 HTTP workflow guide](https://docs.elsaworkflows.io/guides/http-workflows) for current Elsa 3 applications.

## The practical takeaway

Elsa 4 treats an HTTP response as a local delivery opportunity around a durable workflow, not as durable state itself. `Sync` can produce a normal request-response exchange when execution stays local and reaches `WriteHttpResponse`. `202 Accepted` remains the truthful answer once the workflow must continue independently.

That makes the fallback a feature, not a failure. It preserves the workflow instance, avoids leaking live transport state into persistence, and tells the caller exactly what happened: Elsa accepted the work, but the durable process now outlives this request.

## Primary sources

- [`elsa-foundation` PR #605: synchronous HTTP responses](https://github.com/elsa-workflows/elsa-foundation/pull/605), merged 2026-07-10 and accessed 2026-07-20.
- [`elsa-foundation` PR #757: typed value flow](https://github.com/elsa-workflows/elsa-foundation/pull/757), merged 2026-07-17 and accessed 2026-07-20.
- [Typed HTTP response result commit](https://github.com/elsa-workflows/elsa-foundation/commit/ead8acd9f624994173e4895a8f0804d21d506061), committed 2026-07-16 and accessed 2026-07-20.
- [Elsa 4 `ResponseMode` source](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Http/Core/ResponseMode.cs), accessed 2026-07-20.
- [Elsa 4 HTTP endpoint middleware](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Http/Middleware/HttpEndpointMiddleware.cs), accessed 2026-07-20.
- [Committed HTTP response instruction delivery](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Activities/Http/Services/HttpResponseInstructionDelivery.cs), accessed 2026-07-20.
- [Distributed forwarding actor](https://github.com/elsa-workflows/elsa-foundation/blob/main/src/Elsa/Workflows/Runtime/Distributed/Services/ForwardingWorkflowExecutionActor.cs), accessed 2026-07-20.
- [Elsa 4 synchronous HTTP acceptance tests](https://github.com/elsa-workflows/elsa-foundation/blob/main/tests/Elsa/Activities/Http/IntegrationTests/HttpEndpointSyncResponseEndToEndTests.cs), accessed 2026-07-20.
- [Elsa 3 issue #4895: workflow resumes without the original HTTP context](https://github.com/elsa-workflows/elsa-core/issues/4895), accessed 2026-07-20.
- [Elsa 3 HTTP workflow guide](https://docs.elsaworkflows.io/guides/http-workflows), accessed 2026-07-20.
