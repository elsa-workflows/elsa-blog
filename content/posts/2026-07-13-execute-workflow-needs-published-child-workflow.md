---
title: "Why ExecuteWorkflow Needs a Published Child Workflow"
slug: "execute-workflow-needs-published-child-workflow"
description: "ExecuteWorkflow resolves a published managed definition, not merely a registered .NET workflow type. Learn how to configure child workflows correctly."
publishedAt: "2026-07-13"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "child-workflows"
  - "testing"
featuredImage: "../assets/2026-07-13-execute-workflow-needs-published-child-workflow/featured.png"
featuredImageAlt: "A parent workflow connects through a registry to a verified child workflow"
seoTitle: "Why ExecuteWorkflow Needs a Published Child Workflow"
seoDescription: "ExecuteWorkflow resolves a published managed definition, not merely a registered .NET workflow type. Learn how to configure child workflows correctly."
redirectFrom: []
---

# Why ExecuteWorkflow Needs a Published Child Workflow

`ExecuteWorkflow` runs a child from Elsa's managed workflow-definition store. Registering a C# workflow type with `AddWorkflow<T>()` is useful, but it does not by itself create the published definition that `ExecuteWorkflow` resolves.

That distinction surfaced in a recent [Elsa community discussion](https://github.com/elsa-workflows/elsa-core/discussions/6973#discussioncomment-17577881): a parent could see its child workflow type registered, yet execution still failed because no published child definition existed. It is an easy trap because both concepts are legitimately called “a workflow,” but they live at different layers of Elsa.

> **Key takeaways**
> - `ExecuteWorkflow` looks up the child by managed definition ID and requires a published version.
> - `AddWorkflow<T>()` registers a runtime type; it does not publish a managed definition.
> - In tests, load the definitions and populate Elsa's registries before you run the parent.

## What does `ExecuteWorkflow` resolve?

`ExecuteWorkflow` resolves a **published workflow graph by definition ID** before it starts a child instance. Its runtime implementation asks `IWorkflowDefinitionService` for that ID using `VersionOptions.Published`; when it cannot find one, it throws an exception stating that no published version was found. You can see that lookup in [the activity source](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Runtime/Activities/ExecuteWorkflow.cs).

```csharp
var workflowGraph = await workflowDefinitionService.FindWorkflowGraphAsync(
    workflowDefinitionId,
    VersionOptions.Published,
    context.CancellationToken);
```

The important word is **published**. The activity is designed to compose managed workflow definitions: the parent refers to a definition ID, Elsa finds its published graph, and then it creates and invokes a child workflow instance from that graph. It is not a type-activation shortcut.

<!-- [UNIQUE INSIGHT] -->

This gives you a useful mental model: registration answers “can this host construct this .NET workflow type?” Publishing answers “is this managed definition a runnable child that other managed workflows may select by ID?” A solution must satisfy the second question when the parent uses `ExecuteWorkflow`.

## Why is `AddWorkflow<T>()` not enough?

`AddWorkflow<T>()` registers a programmatic workflow type with Elsa's runtime. It is the right building block when you want to run that type through the runtime APIs, but it does not turn the type into a persisted, versioned, published managed definition.

The distinction is visible in Elsa's own integration test infrastructure. `TestApplicationBuilder.AddWorkflow<T>()` forwards to `elsa.AddWorkflow<T>()`, while the passing `ExecuteWorkflow` tests use a different route: they load workflow definitions from a directory and populate the registries before running the parent. See [the test setup](https://github.com/elsa-workflows/elsa-core/blob/main/test/integration/Elsa.Workflows.IntegrationTests/Activities/ExecuteWorkflow/ExecuteWorkflowTests.cs).

That is why this setup can still fail:

```csharp
services.AddElsa(elsa => elsa.AddWorkflow<ChildWorkflow>());
```

The type is available to the runtime, but `ExecuteWorkflow` is looking for a published definition whose ID matches the value configured in its **Workflow Definition** input.

## How do you configure a managed child workflow?

Create or import the child as a managed definition, then publish a version of it. In an application, that might happen through Elsa Studio, your definition-management integration, or an import process. The exact mechanism can vary, but the state you need is the same: a definition with the expected ID and a published version.

Elsa's [child-workflow integration fixture](https://github.com/elsa-workflows/elsa-core/blob/main/test/integration/Elsa.Workflows.IntegrationTests/Activities/ExecuteWorkflow/Workflows/child-workflow.json) makes the requirement explicit:

```json
{
  "definitionId": "child-workflow",
  "isPublished": true
}
```

For tests, mirror the integration test's lifecycle rather than only registering a class:

1. Load or create the parent and child managed definitions.
2. Ensure the child has the definition ID that the parent's `ExecuteWorkflow` activity uses.
3. Publish the child definition.
4. Populate the registries before running the parent.

The last step matters in test hosts. Elsa's [integration test](https://github.com/elsa-workflows/elsa-core/blob/main/test/integration/Elsa.Workflows.IntegrationTests/Activities/ExecuteWorkflow/ExecuteWorkflowTests.cs) calls `PopulateRegistriesAsync()` before it runs the parent workflow. That helper is a testing detail, not a production deployment recipe; in production, make sure the definition store and registries contain the published child before traffic reaches the parent.

## Should you use a managed definition or a programmatic workflow?

Use a managed definition when the parent needs to choose the child by definition ID, versioning and publication are part of the workflow lifecycle, or authors work with the definition in Elsa Studio. Use a programmatic workflow when you deliberately want to construct and invoke a .NET type through the runtime APIs instead of going through `ExecuteWorkflow`'s managed-definition lookup.

| Your parent needs to… | Prefer… | Why |
| --- | --- | --- |
| Call a child selected by definition ID | A published managed child definition | `ExecuteWorkflow` resolves published definitions by ID. |
| Manage child versions and publication | A published managed child definition | The definition store provides the lifecycle `ExecuteWorkflow` expects. |
| Invoke a C# workflow type directly | A programmatic workflow and the runtime API | Type registration and managed-definition lookup are separate paths. |

This is also a helpful boundary when troubleshooting [resumable workflow state](/blog/suspended-workflows-in-elsa-3-7): a workflow instance's runtime state is not evidence that a managed definition with a particular ID has been published. Check the definition lifecycle independently.

## A five-step checklist for the “not published” error

When `ExecuteWorkflow` says it cannot find a published version, work through this list in order:

1. Confirm the value in the parent activity is the child's **definition ID**, not its display name or C# type name.
2. Confirm that a managed child definition exists in the configured definition store.
3. Confirm that the child has a **published** version, not only a draft or latest version.
4. In integration tests, load the definitions and populate the registries before starting the parent.
5. If the child is intentionally programmatic-only, call it through the runtime API that fits that design instead of using `ExecuteWorkflow`.

`WaitForCompletion` is a separate concern. It changes whether the parent waits for a child that was successfully started; it does not change the initial published-definition lookup.

## The practical takeaway

The fastest fix is usually not another `AddWorkflow<T>()` call. Treat `ExecuteWorkflow` as a managed-definition composition activity: give it a child definition ID that exists in the definition store and has a published version. Once that lifecycle is in place, the parent can reliably create the child instance and decide whether to wait for it.

If you are new to composition in Elsa, start by making the child definition visible and publishable, then connect the parent to that stable definition ID. It keeps the runtime behavior, Studio experience, and test setup aligned.

## Frequently asked questions

### Does `WaitForCompletion` make an unpublished child runnable?

No. Elsa resolves the published child definition before it decides whether the parent should wait for the child's completion. `WaitForCompletion` controls the parent/child completion behavior after a child has been found and started.

### Can I use `ExecuteWorkflow` with only `AddWorkflow<T>()`?

No. `AddWorkflow<T>()` registers the C# type in the runtime, while `ExecuteWorkflow` asks the definition service for a published managed workflow graph. Import or create the child definition and publish it, or invoke a programmatic workflow through the runtime API instead.

### What is the smallest useful integration-test setup?

Load a published parent and child definition, make the parent's child definition ID match the child's `definitionId`, then populate the registries before starting the parent. Elsa's own integration test follows that sequence and is the best compact reference for a test host.

## Primary sources

- [Community question and maintainer explanation: Calling a Child workflow from a Parent workflow fails due to child workflow not being published](https://github.com/elsa-workflows/elsa-core/discussions/6973#discussioncomment-17577881) (accessed July 13, 2026)
- [Elsa `ExecuteWorkflow` source](https://github.com/elsa-workflows/elsa-core/blob/main/src/modules/Elsa.Workflows.Runtime/Activities/ExecuteWorkflow.cs) (accessed July 13, 2026)
- [Elsa `ExecuteWorkflow` integration tests](https://github.com/elsa-workflows/elsa-core/blob/main/test/integration/Elsa.Workflows.IntegrationTests/Activities/ExecuteWorkflow/ExecuteWorkflowTests.cs) (accessed July 13, 2026)
- [Published child workflow fixture](https://github.com/elsa-workflows/elsa-core/blob/main/test/integration/Elsa.Workflows.IntegrationTests/Activities/ExecuteWorkflow/Workflows/child-workflow.json) (accessed July 13, 2026)
