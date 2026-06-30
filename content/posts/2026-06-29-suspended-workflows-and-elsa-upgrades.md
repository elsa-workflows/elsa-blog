---
title: "Suspended Workflows Are Runtime State, Not Just Definitions"
slug: "suspended-workflows-and-elsa-upgrades"
description: "A practical look at what happens when Elsa workflows are suspended during an upgrade, and why persisted state and bookmarks need their own migration plan."
publishedAt: "2026-06-29"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "upgrades"
  - "workflow-runtime"
  - "persistence"
featuredImage: "../assets/2026-06-29-suspended-workflows-and-elsa-upgrades/featured.png"
featuredImageAlt: "Editorial illustration of a durable workflow path crossing from an older runtime version into a newer one while persisted state and bookmarks line up"
seoTitle: "Suspended Workflows and Elsa Upgrades"
seoDescription: "Suspended Elsa workflow instances resume from persisted runtime state and bookmarks, so upgrades that change state shape need testing, draining, or a custom migration plan."
redirectFrom: []
---

# Suspended Workflows Are Runtime State, Not Just Definitions

A question came up this week that is worth turning into a post because it touches a part of workflow systems that is easy to underestimate:

What should you do with suspended workflow instances when upgrading Elsa from one version to another?

More concretely, the question in [discussion #7758](https://github.com/elsa-workflows/elsa-core/discussions/7758) was about workflows created under Elsa 3.2 and resumed under 3.7. Some persisted records no longer lined up cleanly with the newer runtime shape. Bookmarks, workflow instance data, type names, event casing, flow scope state. The kind of thing you only discover when a real long-running process has been waiting in storage while the application moved on.

The short answer is not very glamorous: suspended workflow instances are not just old workflow definitions waiting to be reloaded.

They are runtime state.

That distinction matters during upgrades.

## Resume starts from what was persisted

When Elsa resumes a workflow instance, it does not simply take the latest workflow definition and reconstruct everything from scratch.

The current runtime path is more concrete than that. `LocalWorkflowClient` loads the stored workflow instance, takes its persisted `WorkflowState`, resolves the workflow graph using the stored `DefinitionVersionId`, and passes that state back into the workflow runner.

You can see that shape in [`LocalWorkflowClient.RunInstanceAsync`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Runtime/Services/LocalWorkflowClient.cs) and the private `GetWorkflowGraphAsync` overload that builds a `WorkflowDefinitionHandle.ByDefinitionVersionId(workflowInstance.DefinitionVersionId)`.

Bookmarks have their own path. `WorkflowResumer` looks up stored bookmarks by filter, creates a workflow client for each `bookmark.WorkflowInstanceId`, and resumes by passing the stored `bookmark.Id` into the run request. That is in [`WorkflowResumer`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Runtime/Services/WorkflowResumer.cs).

So an upgrade has to preserve more than "there is still a workflow with this name."

It has to preserve enough of the runtime contract for the suspended instance to make sense:

- the referenced workflow definition version still needs to be available,
- the serialized workflow state needs to deserialize into the runtime model,
- the bookmark records need to match the resume stimulus Elsa will compute now,
- and any stateful activity data needs to still mean what the newer activity implementation expects.

That is not unusual for a workflow engine. It is exactly what makes long-running workflows useful: they remember where they were. But it also means persisted workflow state becomes part of your upgrade surface.

## Compatibility hooks help, but they are not a general upgrader

Elsa does have compatibility support in places.

For example, [`SerializationTypeResolver`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Common/Serialization/SerializationTypeResolver.cs) can resolve registered aliases and some legacy type names. Current code also has forwarded-type support in places, such as the obsolete `EventBookmarkPayload` forwarding to `EventStimulus`.

That is useful. It means some renamed or moved types can still be read.

But that is different from saying Elsa has a general-purpose suspended-instance migration engine.

The resolver can help the serializer find a type. It cannot know whether an old bookmark payload still hashes the same way, whether an activity's internal state model changed semantically, or whether a flow-control object from an older version can be safely interpreted as the newer one.

The discussion surfaced a good example: event bookmark casing. In Elsa 3.2, `EventBookmarkPayload.EventName` normalized values to lowercase. In the current runtime, the old payload type is forwarded, and event stimuli are handled differently. If stored bookmarks were created with one casing assumption and the newer runtime computes a different stimulus hash, a resume operation can fail to find what looks like the "same" event from a user's point of view.

Another example is `FlowScope`. In Elsa 3.2, the flow scope stored an owner activity ID and a dictionary of activity flow states. In current code, [`FlowScope`](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Core/Activities/Flowchart/Models/FlowScope.cs) tracks visit counts for activities and connections. Both represent flowchart execution state, but they are not the same serialized shape.

That does not make either design wrong. It just means old suspended instances may contain data that was valid for the old runtime, not automatically valid for the new one.

## The operational rule: drain, test, or migrate

For applications using Elsa in production, I would treat suspended workflow instances the same way I treat database schema changes that carry business state. They deserve an upgrade plan.

The safest option is to drain them before upgrading. Let running and suspended instances complete on the old version where practical. Then upgrade when the system has no long-lived runtime state waiting on old assumptions.

That is not always possible.

Some workflows are meant to wait for days, weeks, or months. Some systems cannot pause new work long enough to drain everything. In that case, the next best option is to test with real data in staging before the upgrade. Not a synthetic "hello world" workflow. A copy of the workflow instance and bookmark records that represent the workflows you actually have suspended.

The test is simple in concept:

1. Take representative suspended instances from the old environment.
2. Include their related bookmark records and the workflow definition versions they reference.
3. Restore them into a staging environment running the target Elsa version.
4. Resume them using the same stimuli or API calls production would use.
5. Compare the persisted old records against freshly suspended records created by the new version.

That last step is often where the migration becomes obvious. If a 3.2 record and a 3.7 record for the same workflow wait point differ in bookmark payload, type alias, casing, or activity state shape, you have something concrete to migrate.

And sometimes that is the right answer: write a targeted migration for your persisted `workflow_instances` and bookmark data.

Not a generic migration for every possible Elsa workflow in the world. A migration for the exact records, providers, activities, and versions your system uses.

## Why this is different from workflow definition versioning

Elsa already has workflow definition versions, and that can make this topic feel like it should be solved automatically.

Definition versioning answers a different question: "Which workflow definition should this instance use?"

Suspended instance compatibility asks: "Can the runtime understand the state this old instance already saved?"

Those are related, but not identical.

An instance can correctly point at its original definition version and still fail because a stored bookmark no longer matches, a serialized type alias is no longer understood, or an internal activity state object changed shape. The definition tells Elsa what the workflow looked like. The runtime state tells Elsa where that particular execution was and what it had already recorded.

This is also why "just use the latest definition" is usually not the right mental model for resuming old work. Long-running workflows need continuity. If an approval workflow was waiting after step four, it should not casually reinterpret itself as a freshly-created instance of whatever the current definition happens to be.

There are tools for runtime correction. Elsa 3.8's workflow alterations work is one example. But alterations are an operational mechanism, not a promise that arbitrary historical persisted state can cross every version boundary without a migration.

## A practical upgrade checklist

If you are planning an Elsa upgrade and you have suspended instances, I would check these before cutting over:

- Do you have any running or suspended workflow instances that must survive the upgrade?
- Are the workflow definition versions referenced by those instances still present after the upgrade?
- Can the target version deserialize the old `WorkflowState` records?
- Can it find and match the old bookmark records using the stimuli your application sends?
- Do your workflows use activities whose internal state models changed between versions?
- Have you tested a copy of real suspended data, not just newly-created workflows?
- If something breaks, is the fix to drain, alter, republish, or migrate stored records?

The uncomfortable part is that the answer can vary by workflow.

A simple workflow waiting on a user task may survive an upgrade just fine. Another workflow using event bookmarks, flowchart state, custom activities, or provider-specific persisted documents may need a small migration. The shape of the data matters.

## The useful takeaway

The main thing I would avoid is treating suspended instances as passive metadata.

They are live runtime state at rest.

That is the whole point of a durable workflow engine. Elsa can stop, persist, and resume a process later. But once a process is persisted, the serialized state becomes part of the contract between the old runtime and the new runtime.

So if you are upgrading across versions and you have important suspended workflows, do the boring work:

Export a few representative records. Restore them into staging. Resume them. Compare the old and new shapes. Decide whether to drain, migrate, or accept that a given class of instances should finish on the old version.

It is not the flashiest upgrade advice, but it is the kind that prevents a long-running process from becoming archaeology.
