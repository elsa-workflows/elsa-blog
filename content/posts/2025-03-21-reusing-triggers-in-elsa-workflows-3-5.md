---
title: "Reusable Triggers in Elsa Workflows 3.5"
slug: "reusing-triggers-in-elsa-workflows-3-5"
description: "Elsa 3.5 added reusable trigger base classes for custom events, timers, HTTP endpoints, and delayed execution so activity authors can focus on domain behavior."
publishedAt: "2025-03-21"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "workflow"
  - "dotnet"
  - "extensibility"
featuredImage: "https://cdn-images-1.medium.com/max/1200/1*e3HFPUDKgWuLPxR7j9-gWw.png"
featuredImageAlt: "Event-driven workflow illustration for reusable trigger activities in Elsa Workflows"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/reusing-triggers-in-elsa-workflows-3-5-d86a484f40b3"
seoTitle: "Reusable Triggers in Elsa Workflows 3.5"
seoDescription: "Elsa 3.5 reusable trigger base classes help custom activity authors build event, timer, HTTP endpoint, and delay behavior without reimplementing trigger plumbing."
redirectFrom: []
---

# Reusable Triggers in Elsa Workflows 3.5

Elsa 3.5 added a small but useful extensibility layer for custom trigger-based activities.

Instead of rebuilding the same trigger plumbing every time you need a domain event, timer, HTTP endpoint, or delayed resume point, you can inherit from a reusable base class and focus on the behavior that belongs to your activity.

The original version of this post was written while Elsa 3.5 was still in preview. That historical context still matters, but the feature itself is no longer just a preview idea. The [3.5.0 release discussion](https://github.com/elsa-workflows/elsa-core/discussions/6853) later moved the line from preview packages to the regular 3.5 release.

> **Key Takeaways**
> - Elsa 3.5 introduced four reusable trigger helpers: `EventBase<T>`, `TimerBase`, `HttpEndpointBase<T>`, and `DelayFor`.
> - The base classes keep trigger indexing, waiting, resuming, and completion logic out of your custom activity code.
> - Use them when your activity has domain-specific trigger semantics but can reuse Elsa's existing trigger infrastructure.

## What problem do reusable triggers solve?

The [official reusable triggers documentation](https://docs.elsaworkflows.io/extensibility/reusable-triggers-3.5-preview) lists four helpers for common trigger patterns: custom events, interval timers, HTTP endpoints, and delayed execution. The same shape is visible in the Elsa Core source for [`EventBase<T>`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Runtime/Activities/EventBase.cs), [`TimerBase`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Scheduling/Activities/TimerBase.cs), [`HttpEndpointBase<T>`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Http/Activities/HttpEndpointBase.cs), and [`DelayFor`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Scheduling/Extensions/DelayActivityExecutionContextExtensions.cs). That matters because these are the places where custom activity code can otherwise become mostly infrastructure.

If you have written custom workflow activities before, you have probably seen this shape. The interesting part is usually small: get the event name, decide the interval, define an HTTP route, or schedule a resume point.

The repetitive part is everything around it:

- producing the trigger payload used during indexing,
- waiting for the external stimulus,
- resuming the activity when the stimulus arrives,
- passing input back into the workflow,
- and completing the activity at the right time.

Reusable trigger base classes are a way to keep those two concerns separate.

You still own the domain-specific part. Elsa owns the trigger mechanics.

That is the main mental model.

## When should you use `EventBase<T>`?

`EventBase<T>` is for activity types that resume when a named event is triggered. In the current Elsa Core implementation, the base class gets the event name, indexes an event stimulus, waits for that event, reads the event input, assigns `Result`, calls your hook, and completes the activity.

That means the custom activity can stay focused on naming and handling the event:

```csharp
public class OrderApproved : EventBase<object>
{
    protected override string GetEventName(ExpressionExecutionContext context) =>
        "OrderApproved";

    protected override void OnEventReceived(
        ActivityExecutionContext context,
        object? input)
    {
        Console.WriteLine("Order approved event received.");
    }
}
```

The important detail is not the `Console.WriteLine`. It is the fact that the activity did not have to manually wire the bookmark, trigger payload, event input, or completion behavior.

This pattern is useful for domain events, integration events, and application-level signals where a generic event activity would work technically, but a named custom activity would make the workflow easier to read.

## When should you use `TimerBase`?

`TimerBase` is for recurring interval behavior. The base class asks your activity for a `TimeSpan`, repeats with that interval, emits the timer trigger stimulus, calls your elapsed hook, and completes the activity after each tick.

A custom timer can be very small:

```csharp
public class PollEveryFiveSeconds : TimerBase
{
    protected override TimeSpan GetInterval(ExpressionExecutionContext context) =>
        TimeSpan.FromSeconds(5);

    protected override void OnTimerElapsed(ActivityExecutionContext context)
    {
        Console.WriteLine("Polling interval elapsed.");
    }
}
```

This is a good fit when the interval has domain meaning.

For example, `PollInventoryStatus`, `RefreshCustomerSnapshot`, or `CheckExternalJobStatus` may be more expressive in a workflow than a generic timer followed by a separate activity. The workflow reads closer to the business process, while Elsa still handles the timer infrastructure.

## When should you use `HttpEndpointBase<T>`?

`HttpEndpointBase<T>` is for custom activities that start or resume workflows from an HTTP request. The base class gets your endpoint options, waits for a matching HTTP request, exposes the current `HttpContext`, and completes the activity after your handler runs.

The activity defines the HTTP surface:

```csharp
public class ReceiveWebhook : HttpEndpointBase<object>
{
    protected override HttpEndpointOptions GetOptions() => new()
    {
        Path = "webhooks/orders",
        Methods = [HttpMethods.Post]
    };

    protected override async ValueTask OnHttpRequestReceivedAsync(
        ActivityExecutionContext context,
        HttpContext httpContext)
    {
        httpContext.Response.StatusCode = StatusCodes.Status202Accepted;
        await httpContext.Response.WriteAsync(
            "Webhook accepted.",
            context.CancellationToken);
    }
}
```

This is useful when an HTTP endpoint is not just a transport detail, but part of the activity's meaning.

A workflow designer can use `ReceiveWebhook`, `ReceivePaymentCallback`, or `StartDocumentApproval` as a first-class activity instead of configuring a generic endpoint the same way in every workflow.

## How does `DelayFor` fit in?

`DelayFor` is the smallest helper in this group, but it is useful because it works from inside any custom activity. The extension calculates a resume time from the current system clock and delegates to `DelayUntil`.

That lets an activity pause itself without manually creating the scheduling machinery:

```csharp
public class WaitBeforeRetry : Activity
{
    protected override ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        context.DelayFor(TimeSpan.FromSeconds(5), OnDelayElapsedAsync);
        return default;
    }

    private async ValueTask OnDelayElapsedAsync(ActivityExecutionContext context)
    {
        Console.WriteLine("Retry delay elapsed.");
        await context.CompleteActivityAsync();
    }
}
```

Use this when the delay belongs inside the custom activity's behavior.

If the delay is just a visible workflow step, the regular delay activity is still the clearer modeling choice. But if the delay is part of a retry policy, polling loop, or protocol-specific wait, keeping it inside the custom activity can make the workflow cleaner.

## What should custom activity authors watch for?

Reusable trigger base classes reduce boilerplate, but they do not remove design responsibility. The official docs and the current Elsa Core source both point to the same boundary: these helpers are for activities that can reuse Elsa's existing trigger model.

Before creating a custom trigger activity, check three things.

First, ask whether the activity name will make workflows easier to understand. A domain-specific activity is worth it when it hides repetition and clarifies intent. It is not worth it if it only wraps a generic activity without adding meaning.

Second, keep trigger identity stable. Event names, HTTP paths, and timer intervals affect indexing and resumption. Treat them as part of the activity contract, not throwaway implementation details.

Third, keep host concerns out of the activity where possible. If the behavior depends on services, options, or tenant-specific rules, inject or resolve those through the normal Elsa and .NET patterns rather than hard-coding them into the trigger.

This is the same modularity story that shows up in later Elsa work, such as [shell features and modular configuration](https://www.elsaworkflows.io/blog/configuring-elsa-with-shell-features). Small extension points are most useful when they keep module boundaries honest.

## Why this still matters after Elsa 3.5

The reusable trigger work is not a headline feature like a new designer surface, but it changes the cost of building good custom activities.

Without these base classes, teams often choose between two awkward options. They either keep using generic activities and repeat the same configuration in many workflows, or they build custom activities and reimplement trigger plumbing that should not be application code.

`EventBase<T>`, `TimerBase`, `HttpEndpointBase<T>`, and `DelayFor` create a middle path.

You can make a workflow read like your domain without owning the low-level mechanics of waiting, indexing, resuming, and completing.

That is usually where the best Elsa extensions live: domain-specific on the outside, boring and reusable on the inside.

## FAQ

### Are reusable triggers only for Elsa 3.5?

They were introduced around the Elsa 3.5 work and documented as part of the 3.5 preview, but the pattern remains useful beyond that release. If you are working against a newer Elsa 3.x version, verify the exact signatures in the Elsa Core source or the current docs before copying examples.

### Should I replace every generic trigger with a custom activity?

No. Generic trigger activities are still useful when the workflow configuration itself is the clearest expression of intent. Create a custom trigger activity when it removes repeated setup, gives the workflow a better domain vocabulary, or hides infrastructure that workflow authors should not have to think about.

### Can `DelayFor` replace the normal delay activity?

Usually no. Use the normal delay activity when the wait is a visible workflow step. Use `DelayFor` when the wait is internal to a custom activity, such as a retry delay, protocol wait, or domain-specific pause before completing the activity.
