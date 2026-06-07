---
title: "Workflow Alterations in Elsa 3.8"
slug: "workflow-alterations-in-elsa-3-8"
description: "A closer look at Elsa 3.8 workflow alterations: staged runtime correction, alteration plans and jobs, built-in operations, Studio UI, and operational guardrails."
publishedAt: "2026-06-06"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Product"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "workflow"
  - "operations"
featuredImage: "../assets/2026-06-06-workflow-alterations-in-elsa-3-8/featured.png"
featuredImageAlt: "Generated technical illustration of a running workflow with a staged alteration plan prepared beside it"
seoTitle: "Workflow Alterations in Elsa 3.8"
seoDescription: "Elsa 3.8 adds Studio support for workflow alterations: staged runtime correction through plans, jobs, built-in operations, logs, and status tracking."
redirectFrom: []
---

# Workflow Alterations in Elsa 3.8

Changing a running workflow instance is not something a product should make feel casual.

But real workflow systems eventually need a controlled way to do it.

An activity might be stuck because the outside world changed. A variable might contain a wrong value. An instance might need to move to a newer workflow definition version. A waiting activity might need to be cancelled because the business process already continued elsewhere.

The alternative is often worse: edit data by hand, restart the instance, replay from the beginning, or tell operators there is no supported path.

Elsa 3.8 preview 1 adds the Studio experience around alterations, building on the Core alteration model.

The design is deliberately staged. You do not click a random button on a live process and hope. You prepare an alteration plan, review what it targets, submit it, and inspect the resulting jobs and logs.

That is the right mental model for runtime correction.

## Plans and jobs

The Core model separates an alteration plan from alteration jobs.

An alteration plan is the intended change: which alterations should be applied and which workflow instances should be targeted.

An alteration job is the execution of that plan for one workflow instance.

That distinction matters when a plan targets more than one instance. A plan can be submitted once, then produce several jobs with their own status and log entries. One instance may succeed while another fails. The operator needs to see that at the job level, not just as a single vague result.

The core entities reflect this:

- `AlterationPlan` contains the alterations, target instance IDs, status, and timestamps.
- `AlterationJob` records the plan ID, workflow instance ID, status, serialized log, and timestamps.
- `AlterationLog` and `AlterationLogEntry` capture what happened while applying the change.

Job statuses are simple on purpose: pending, running, completed, failed. Plans add the intermediate generating and dispatching states because a submitted plan may need to create and dispatch multiple jobs before those jobs run.

## The built-in alterations

Elsa 3.8 includes built-in alteration types for common operational corrections:

- cancel a workflow
- cancel an activity
- schedule an activity
- modify a variable
- migrate to a newer version

Each alteration has a handler that receives an `AlterationHandlerContext`. That context exposes the alteration, workflow execution context, workflow, cancellation token, service provider, and alteration log. It also lets the handler mark the operation as succeeded or failed.

There is also a commit hook for permanent side effects. The XML comment is a useful clue about the design intent: use the hook for work that should happen when the alteration is committed, such as deleting records from a database.

That is the sort of detail that makes alterations feel like an operational subsystem rather than a bag of state mutations.

## The API shape

The alterations API has four main operations:

```text
POST /elsa/api/alterations/dry-run
POST /elsa/api/alterations/run
POST /elsa/api/alterations/submit
GET  /elsa/api/alterations/{id}
```

`dry-run` determines which workflow instances a submit request would target. It does not apply the alterations. This is useful when the target is expressed as a filter and you want to inspect the instance IDs before submitting.

`run` applies alterations directly to explicit workflow instance IDs and dispatches successfully updated workflows when scheduled work is produced.

`submit` stores a plan and schedules it for execution through the alteration plan scheduler.

`get` loads a plan together with the jobs created for it.

The mutable operations require:

```text
run:alterations
```

Reading a plan requires:

```text
read:alterations
```

The timestamp filters are validated through the workflow instance filter validation path before the dry-run and submit endpoints accept them. That is a small but important boundary, because alteration targeting should not accept arbitrary timestamp filter shapes.

## The Studio workflow

Studio adds pages for plans, workflow instance selection, plan details, and instance editing. It also adds the designer-side pieces that make the feature usable: an alteration catalog, staging service, side panel, configuration dialog, and submit dialog.

![Elsa Studio alterations builder side panel with instance status and whole-instance actions](../assets/2026-06-01-elsa-3-8-preview-1/alterations-builder.png)

The staging service is intentionally scoped to an editor session. It holds the alterations the user has selected before they are submitted. That local staging step is what makes the workflow feel deliberate:

1. Find or inspect the workflow instance.
2. Add one or more alterations from the catalog.
3. Configure their fields.
4. Review the staged changes.
5. Submit the plan.
6. Inspect jobs, statuses, and logs.

The UI language matters here. An alteration is not just another activity button. It is an operational change to runtime state.

## Why this exists

Long-running workflows are not like short request handlers.

They can wait for hours, days, or months. They can coordinate external systems. They can span versions of a process. They can get stuck because of data, a missing callback, a cancelled business event, a failed integration, or a deployment that changed the world around them.

In that kind of system, "just restart it" is often not an acceptable operational answer.

Alterations give Elsa a supported path for a class of corrections that operators already need in real systems. The feature does not remove the need for careful workflow design, retries, compensation, incident handling, or good observability. It also does not mean every user should be allowed to mutate every running instance.

Permissions, review, audit expectations, and internal operating procedures still matter.

What Elsa 3.8 adds is a product shape for runtime correction: plans, jobs, handlers, logs, statuses, a staged Studio workflow, and a set of built-in operations that cover common cases.

That is a much better foundation than telling people to patch workflow state by hand.
