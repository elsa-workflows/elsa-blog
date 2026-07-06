---
title: "Inline vs Deferred Events in Elsa 4"
slug: "inline-vs-deferred-events-in-elsa-4"
description: "Elsa 4 now separates inline and deferred event publishing so read-back paths can require awaited handlers while notifications stay fire-and-forget."
publishedAt: "2026-07-06"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "software-architecture"
  - "workflow-engine"
  - "events"
featuredImage: "../assets/2026-07-06-inline-vs-deferred-events-in-elsa-4/featured.png"
featuredImageAlt: "Generated 3D illustration of Elsa event publishing split into inline and deferred delivery lanes."
seoTitle: "Inline vs Deferred Events in Elsa 4"
seoDescription: "Elsa 4 separates inline and deferred event publishing so validation gates can await handler effects while notifications remain fire-and-forget."
redirectFrom: []
---

# Inline vs Deferred Events in Elsa 4

Elsa 4 now makes event delivery timing visible in the type system. The new `IInlineEventPublisher` and `IDeferredEventPublisher` contracts landed in [`elsa-foundation` PR #505](https://github.com/elsa-workflows/elsa-foundation/pull/505), merged on 2026-07-06. The change is small on the surface, but it closes an easy-to-miss design trap: some event publishers need handler effects before returning, while others only need to notify subscribers later.

This is the same broader story as [Building Elsa 4 Week 2](/blog/building-elsa-4-week-2), where domain events became the way separate domains talk without direct references. The new split answers a different question: once an event exists, does the caller need the handlers to have already run?

> **Key Takeaways**
> - `IInlineEventPublisher` awaits every handler, so handler contributions are observable when `Publish` returns.
> - `IDeferredEventPublisher` enqueues work and returns before handlers run, which is right for fire-and-forget notifications.
> - The draft validation gate now depends on inline delivery, making the wrong delivery timing unrepresentable at that boundary.

## Why does delivery timing matter?

In PR #505, the evidence is concrete: 15 read-back, hydration, or gate sites moved to inline publishing, while 4 draft notification sites moved to deferred publishing. That split matters because a caller that reads state contributed by event handlers must not use a fire-and-forget delivery path.

The draft validation gate is the cleanest example. It publishes `OnDraftValidating`, validators contribute errors to that event, and the gate reads the accumulated errors back afterwards. If the event is published in the background, the gate can read too early. The result is a draft that has real validation errors, but appears clean because the handlers have not run yet.

That bug was latent rather than observed in production. The old call sites passed the sequential strategy. But the old API still made the unsafe state representable: a caller could pass the background strategy to a read-back path. The fix turns timing from a parameter choice into a dependency choice.

## What changed in the event API?

The new API adds two public contracts in `Elsa.Events.Core`: `IInlineEventPublisher` and `IDeferredEventPublisher`. The implementation stays thin. `InlineEventPublisher` delegates to the existing `IEventPublisher` with the sequential strategy. `DeferredEventPublisher` delegates to the same publisher with the background strategy.

That is important. This is not a second event pipeline. It is a more precise public face over the existing pipeline:

```csharp
public interface IInlineEventPublisher
{
    Task Publish(IEvent @event, CancellationToken cancellationToken = default);
}

public interface IDeferredEventPublisher
{
    Task Publish(IEvent @event, CancellationToken cancellationToken = default);
}
```

The benefit is not fewer lines of code. The benefit is that a constructor can now say what delivery semantics it requires. If a component needs handler contributions before continuing, it asks for `IInlineEventPublisher`. If it is sending a notification that must not break the command, it asks for `IDeferredEventPublisher`.

That is a better abstraction than `Publish(event, strategy)`, because the choice is made at composition time instead of being repeated at every call site.

## How does this protect the draft validation gate?

After PR #505, `DraftValidationGate` depends on `IInlineEventPublisher`. The gate no longer accepts an `IEventPublishingStrategy` parameter, so a background publisher cannot be handed to the gate by mistake.

The source comment in `DraftValidationGate` is explicit about the contract: inline delivery awaits every handler, so validation errors are fully aggregated before the gate reads them back. The code path is small:

```csharp
var validatingEvent = new OnDraftValidating(draft);
await eventPublisher.Publish(validatingEvent, cancellationToken);
return validatingEvent.Errors.ToArray();
```

That reads like normal code, but the dependency is doing real work. The type says, "this publish call must be inline." A reviewer no longer has to inspect each call for `EventPublishingStrategy.Sequential`.

The persistence commands show the same intent. `CreateDraft` and `UpdateDraft` use inline publishing for validation and hydration, then deferred publishing for `OnDraftCreated` and `OnDraftValidated` notifications after the write path has done its work.

## When should Elsa use deferred events?

Deferred events are still useful, and PR #505 keeps them for notification-style behavior. The key rule is that the publisher must not need an immediate result from the handlers.

Draft notifications fit that model. A command can create or update a draft, derive validation errors inline, save the changes, and then notify subscribers after the fact. Subscribers should not be able to break the publisher just because they react to a notification.

The new `DeferredEventPublisherTests` pins the behavior directly: `Publish` returns before the handler runs, and the handler effect appears only after the background worker drains the channel. That test is the whole reason the split is valuable. Deferred delivery is not "slower inline delivery." It is a different semantic contract.

Use deferred events when you want fire-and-forget notification behavior. Use inline events when the caller reads handler contributions, needs hydration to complete, or treats handler failures as part of the operation.

## What should extension authors take away?

The design lesson is broader than Elsa's internal draft gate. If an extension point lets handlers contribute state that the publisher reads back, the delivery mode is part of the contract. Hide that behind a generic "publish with options" method and every caller has to remember the rule.

Elsa 4's split makes that rule harder to violate. The operation chooses the face it needs:

1. Inline for gates, hydrators, read-back contributions, and effects that must complete before the caller continues.
2. Deferred for notifications, fan-out, and subscriber work that should not control the publisher's success.
3. The general `IEventPublisher` remains available underneath, but most application code should not need to choose a strategy by hand.

That is the useful pattern: make timing semantics explicit where the dependency is injected, not hidden in a parameter at the point of use.

## Primary sources

- [`elsa-foundation` PR #505: event-delivery inline/deferred split](https://github.com/elsa-workflows/elsa-foundation/pull/505), merged 2026-07-06.
- Commit [`a578b969`](https://github.com/elsa-workflows/elsa-foundation/commit/a578b969): adds `IInlineEventPublisher`, `IDeferredEventPublisher`, and the thin publisher wrappers.
- Commit [`4800074e`](https://github.com/elsa-workflows/elsa-foundation/commit/4800074e): routes read-back and notification call sites through the appropriate publisher face.
- Commit [`4c74df3e`](https://github.com/elsa-workflows/elsa-foundation/commit/4c74df3e): adds the deferred-publisher test that proves publish returns before handlers run.
