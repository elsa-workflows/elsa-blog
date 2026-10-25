---
title: "Inside Elsa 4's Transactional Outbox: No Ghost or Duplicate Child Workflows"
slug: "elsa-4-transactional-outbox"
description: "Elsa 4 records a child workflow start in the same commit as the parent's state, then delivers it afterwards. Here is how that stops ghost and duplicate children."
publishedAt: "2026-10-25"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags: ["workflow-runtime", "persistence"]
seoTitle: "Elsa 4 Transactional Outbox: No Ghost or Duplicate Child Workflows"
seoDescription: "How the Elsa 4 preview uses a transactional outbox and deterministic IDs so a dispatched child workflow starts once, even after a crash."
excerpt: "Starting a child workflow sounds simple until a process dies at the wrong moment. Here is how Elsa 4 makes sure every dispatch ends up with exactly one child."
featuredImage: "../assets/2026-10-25-elsa-4-transactional-outbox/featured.png"
featuredImageAlt: "A glowing amber node sends a capsule of light through a glass box to a single blue node, while a faint duplicate dissolves, on a dark reflective surface."
---

# Inside Elsa 4's Transactional Outbox: No Ghost or Duplicate Child Workflows

Starting a child workflow from a parent workflow sounds like one of the easiest things a workflow engine can do. The parent reaches a dispatch step, the engine starts the child, and the parent moves on.

It stays easy right up until a process dies at the wrong moment. Then you find out whether your engine was honest about what it saved.

In this post I want to walk you through how Elsa 4 handles this. Elsa 4 is still an unreleased preview, so details can change, but this part of the runtime is one I'm genuinely happy with.

## Two ways to get it wrong

When a parent dispatches a child, the engine has two things to do: save the parent's new state, and start the child. Those are two separate writes, and a crash can land between them.

If the engine **starts the child first** and crashes before saving the parent, the child is already running, but the parent has no record of it. When the parent recovers, it runs the dispatch step again and starts a second child. Now you have a duplicate, and the first one is a ghost that nobody is waiting for.

If the engine **saves the parent first** and crashes before starting the child, the parent believes it dispatched something. But no child exists. If the parent is waiting for that child to finish, it waits forever.

Elsa 3 users may recognize this family of problems. Elsa 3 has had an opt-in transactional outbox for workflow dispatch since 3.8, extended to published events in 3.9. For Elsa 4 we built the same idea into the core of the runtime from the start.

## Save the intention, not the action

The fix is a well known pattern called a transactional outbox. Instead of starting the child directly, the parent writes down that it *intends* to start the child, and it does so in the same commit as its own state.

In Elsa 4 that commit is called a checkpoint. When the `DispatchWorkflow` activity runs, one checkpoint records all of this together:

- the parent activity's result,
- the ID the child will get,
- a dispatch record that says the start is pending,
- and the child start itself, as an outbox item.

Either all of that is saved, or none of it is. There is no in-between state where the parent knows about a child that will never start, or where a child exists that the parent never heard of.

Only after the checkpoint has committed does the outbox get delivered. A separate delivery step picks up the pending item and asks the runtime to start the child.

In fire-and-forget mode, the parent gets its child ID and the `Dispatched` outcome as soon as that checkpoint commits. It does not have to wait for the child to actually start.

## The child's ID is decided up front

Saving the intention solves the "lost child" problem. But delivery can still happen more than once. A process can crash after starting the child but before marking the outbox item as delivered. Then recovery delivers it again.

This is where the second half of the design comes in. The child's workflow execution ID is not random. It is derived from the parent's execution ID and the specific activity execution that dispatched it. Run the same dispatch again and you get exactly the same child ID.

So when a start is delivered twice, the second attempt finds the child that already exists and converges on it, instead of creating a new one. The same idea applies to the other messages in the conversation between parent and child: resuming a waiting parent consumes its bookmark once, and cancelling a child is idempotent.

Two different dispatches still get two different children, of course. The ID is tied to that one activity execution, not to the child workflow definition.

## When the process dies

Elsa 4 has a background sweep that looks for outbox items that were saved but never delivered. If a node crashes right after a checkpoint commits, the sweep picks up the stranded child start on its next pass and delivers it. By default the sweep runs every 10 seconds.

If several nodes are running, an outbox item is claimed before it is delivered, and the claim is renewed right before the start goes out. If another node has taken over the item in the meantime, the renewal fails and the item is skipped rather than delivered twice. And in the rare case that a slow delivery does repeat, the deterministic child ID catches it.

## When delivery keeps failing

Sometimes a start fails for a real reason, like the database being briefly unavailable. Elsa 4 retries it a limited number of times before giving up. Out of the box that is 4 attempts in total, 1 second apart, and a host can configure both values on the DispatchWorkflow runtime feature.

What happens after the last attempt depends on the mode:

- **Waiting for the child?** The parent resumes with a `DispatchFailed` outcome, so it gets an answer instead of hanging.
- **Fire-and-forget?** The dispatch is recorded as failed with an incident, and an operator can redrive it later. A redrive reuses the same dispatch identity, so it still cannot produce a second child.

One more practical note: this guarantee needs durable storage. The in-memory stores are the default and are great for trying things out, but they don't survive a crash. For real workloads you use the EF Core stores, which save the checkpoint, the dispatch records and the outbox in one transaction, with PostgreSQL as the production target. And whatever persistence mode a workflow uses, dispatching a child always forces a commit first.

## Why this matters for your workflows

Most of the time you will never see any of this, and that is exactly the point. You add a `DispatchWorkflow` activity, choose the child workflow, and decide whether to wait for it. The engine takes care of the rest, including the bad days.

If you build your own activities, the same thinking applies: decide what is durable before you do something with an effect outside the workflow. Elsa 4 delivers outbox items only after the state is saved, so an effect is never sent before the parent has recorded it.

This is still preview software, and we keep finding and closing edge cases, especially around multi-node delivery. If you try it out and manage to produce a ghost child anyway, I would really like to hear about it!

Learn more: [How Elsa 4 recovers durable work](https://github.com/elsa-workflows/elsa-foundation/blob/main/docs/runtime-durable-resumption.md)
