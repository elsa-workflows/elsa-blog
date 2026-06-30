---
title: "Stable Instance Names for Azure Service Bus"
slug: "stable-instance-names-for-azure-service-bus"
description: "A practical look at why Elsa's Azure Service Bus deployments now support stable application instance names, and how a random per-process name can turn restarts into orphaned subscriptions."
publishedAt: "2026-06-22"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "azure-service-bus"
  - "kubernetes"
  - "operations"
featuredImage: "../assets/2026-06-22-stable-instance-names-for-azure-service-bus/featured.png"
featuredImageAlt: "Generated technical illustration of an Elsa workflow engine connected to bounded Azure Service Bus instance lanes, with faded abandoned lanes in the background"
seoTitle: "Stable Instance Names for Azure Service Bus in Elsa"
seoDescription: "Elsa now supports opt-in stable application instance names so Azure Service Bus deployments can avoid leaking per-instance change-token subscriptions across restarts."
redirectFrom: []
---

# Stable Instance Names for Azure Service Bus

Some production bugs start with the wrong question.

A customer running Elsa on Kubernetes with the Azure Service Bus transport reported slow startup, crash loops, and a Service Bus namespace full of old per-instance queues. The obvious suspicion was the backlog. There were queues with thousands of messages in them, and the application was not becoming ready quickly enough.

That was close, but not quite right.

The backlog was real. It just was not the thing blocking startup.

The more interesting failure was that every restart created another per-instance change-token subscription. Over time those abandoned subscriptions accumulated until the Azure Service Bus topic hit its hard subscription limit. At that point a fresh pod could no longer create the topology it needed, MassTransit kept retrying, and the host never reached `ApplicationStarted`.

That is the kind of operational detail that is easy to miss until a system has been restarted enough times in anger.

## Why the instance name matters

Elsa uses an application instance name for cluster-related infrastructure. With the Azure Service Bus transport, that name is part of the per-instance entities used for distributed cache change-token signaling.

Before the recent fix, the default provider generated a random instance name for each process start. That is a reasonable local default. It avoids collisions when multiple logical instances are started inside the same process, including some component test scenarios.

In a Kubernetes deployment backed by Azure Service Bus, though, that behavior has a sharp edge.

If a pod restarts and gets a new random Elsa instance name, the new process creates a new change-token subscription. The old subscription is now orphaned. Azure Service Bus does have `AutoDeleteOnIdle`, but continuous change-token traffic can keep those abandoned entities non-idle. So they do not necessarily disappear just because the process that created them is gone.

One restart is harmless.

Many restarts can become a pile of abandoned subscriptions.

And Azure Service Bus Standard has a hard limit of 2,000 subscriptions per topic. Once the change-token topic reaches that limit, creating the next subscription fails with `QuotaExceeded`. Since Elsa's MassTransit host startup waits for the bus to start, the application can get stuck before readiness.

The investigation is captured in [`elsa-core` issue #7732](https://github.com/elsa-workflows/elsa-core/issues/7732) and the root-cause issue [`#7736`](https://github.com/elsa-workflows/elsa-core/issues/7736). The fix landed in [`elsa-core` PR #7734](https://github.com/elsa-workflows/elsa-core/pull/7734) and was ported to the 3.7, 3.8, and main branches in [`#7742`](https://github.com/elsa-workflows/elsa-core/pull/7742), [`#7743`](https://github.com/elsa-workflows/elsa-core/pull/7743), and [`#7744`](https://github.com/elsa-workflows/elsa-core/pull/7744).

## The useful correction

The fix is deliberately opt-in for the patch line: Elsa now has `ApplicationInstanceOptions`, read by `ConfiguredApplicationInstanceNameProvider`.

The provider resolves the instance name in this order:

1. `ApplicationInstanceOptions.InstanceName`, when set.
2. The environment variable named by `ApplicationInstanceOptions.InstanceNameEnvironmentVariable`, when configured and non-empty.
3. A random name, preserving the previous behavior when nothing is configured.

That gives production hosts a way to say: this logical instance should reuse the same transport identity across restarts.

The important part is that the name must be both stable and unique.

Stable means the same logical instance gets the same value after a restart. Unique means two instances that are running at the same time must not share the value. A Kubernetes StatefulSet fits that model well because each pod has a stable ordinal hostname. A Deployment can work too, but then you need to be much more deliberate about what you project into the environment.

The shape looks like this:

```csharp
elsa.UseApplicationCluster(cluster =>
{
    cluster.ApplicationInstanceOptions = options =>
    {
        options.InstanceNameEnvironmentVariable = "HOSTNAME";
    };
});
```

Or, if the host already knows the right stable identity:

```csharp
elsa.UseApplicationCluster(cluster =>
{
    cluster.ApplicationInstanceOptions = options =>
    {
        options.InstanceName = "orders-0";
    };
});
```

The implementation also validates the configured name and shortens long values deterministically when needed, because downstream transport entity names still have provider-specific limits. That is a small detail, but it matters. A fix for restart churn should not introduce a new failure mode where a long pod name breaks transport setup.

## What this does not solve

This does not magically clean up a namespace that has already reached the subscription cap.

If an Azure Service Bus namespace already has thousands of orphaned change-token subscriptions or queues, you still need a one-time cleanup as part of rollout. The stable name prevents the same logical instance from leaking a new subscription on every restart after the fix is configured. It does not delete historical debris by itself.

It also does not mean the original startup report had only one cause. The tracking issue [`#7737`](https://github.com/elsa-workflows/elsa-core/issues/7737) groups a few related reliability findings, including a separate scheduling bookmark startup path in [`#7735`](https://github.com/elsa-workflows/elsa-core/issues/7735). The Quartz scheduling error that appeared in the same customer logs was fixed separately in `elsa-extensions` through [`#160`](https://github.com/elsa-workflows/elsa-extensions/pull/160), [`#161`](https://github.com/elsa-workflows/elsa-extensions/pull/161), and [`#162`](https://github.com/elsa-workflows/elsa-extensions/pull/162).

That separation is worth spelling out. In distributed systems, one incident report can contain several problems that look like one problem because they all show up during startup.

## The broader lesson

Random names are useful when the lifetime of the name is the lifetime of the process.

They are less useful when the name is used to create durable infrastructure.

For local development and tests, a random Elsa application instance name is convenient. For a clustered production deployment using a broker with durable topology and hard entity limits, the instance name becomes part of the operational contract. It should be treated the same way you treat a queue name, a consumer group, or a database schema name: stable enough that the infrastructure can converge, and unique enough that live instances do not step on each other.

That is a fairly small configuration change.

But small identity choices have a habit of becoming very large once a system is restarted hundreds or thousands of times.
