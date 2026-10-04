---
title: "Human Approval Workflows in Elsa 3: Wait, Reject, and Resubmit"
slug: "human-approval-workflows-in-elsa-3"
description: "Model human approvals in Elsa 3: pause on a bookmark, resume with a decision, and loop back on reject so the same workflow instance continues."
publishedAt: "2026-10-04"
status: "published"
authors:
  - "sipke"
category: "Tutorial"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "approvals"
  - "bookmarks"
  - "workflow-patterns"
seoTitle: "Human Approval Workflows in Elsa 3"
seoDescription: "Model human approvals in Elsa 3: pause on a bookmark, resume with a decision, and loop back on reject so the same workflow instance continues."
redirectFrom: []
related:
  - "suspended-workflows-and-elsa-upgrades"
  - "why-elsa-payloads-change-shape-after-persistence"
  - "elsa-3-8-stable-upgrade-guide"
---

# Human Approval Workflows in Elsa 3: Wait, Reject, and Resubmit

Almost every business app grows an approval flow sooner or later. Expense claims, document reviews, access requests, quality gates.

The first version is usually a status column and a few if statements. The second version is where people reach for a workflow engine, and where the same questions keep coming up:

- How do I make the workflow wait for a person?
- How do I send the decision back in?
- What happens on reject? Do I start over?
- Why did my variables disappear?

This post walks through the pattern in Elsa 3 (3.8.4). It is about the shape and the decisions, not a click-by-click build.

## 1. A human wait is a bookmark

In Elsa 3, a workflow does not sit in memory waiting for your manager to come back from lunch.

When the workflow reaches a blocking activity, that activity creates a **bookmark** and the instance suspends. Elsa persists the bookmark, the execution log, and any variables that use Workflow Instance storage. Later, a matching **stimulus** resumes the instance from that bookmark.

That has two consequences:

- Your host needs **runtime persistence**, not only the management store. No durable bookmarks, no durable waits.
- A suspended instance costs you a database row, not a thread. Waiting three days is fine.

In Studio a waiting instance shows as **Suspended**. Through the API you will see status **Running** with sub-status **Suspended**. Same thing, two views.

## 2. Do not use Delay as "wait for the manager"

`Delay` waits for time. It needs scheduling, and it resumes itself when the timer fires.

A person approving is not a timer. Use an activity that waits for an external signal (an **Event**, a custom blocking activity, or a tokenized resume URL) and drive it with a stimulus when the decision arrives.

If you also need a deadline, add a timeout branch next to the human wait. Do not replace the human wait with a timer.

## 3. The shape

Here is a thin expense-claim shape. It is the smallest graph that still proves the pattern:

```text
HTTP submit (claimId, employee, amount)
  -> validate (bad input: respond 400, stop)
  -> respond 202 with the workflow instance id
  -> wait for the review              (one outstanding wait)
       API:   Event "ClaimReviewed", Result bound to Review
       Links: Event "ClaimApproved-<round>" or "ClaimRejected-<round>",
              joined by a Join (Wait any); each branch sets Review
  -> decision on getReview().decision
       Approved -> mark Approved, finish
       Rejected -> mark NeedsChanges, add 1 to Round
                -> wait: "ClaimRevised"
                -> back to the review wait   (same instance)
```

Three things in that sketch matter more than the rest.

**Respond before you wait.** If an HTTP-started workflow reaches the human wait before it writes a response, the request completes with an empty 200 and the caller never learns the instance id. Answer the submit first (202 Accepted is honest) and include the instance id the caller needs later.

**One outstanding wait at a time.** Several open bookmarks plus "which call resumes which wait" gets confusing fast. Start with one pause point at a time. Add parallel reviewers later, on purpose.

**The wait must not start new workflows.** In Elsa 3.8 a start trigger has to be a trigger activity that is marked as able to start a workflow. That flag is off by default. If the event you wait on can also start the workflow, a decision event might start a brand new instance instead of resuming yours. For an inline human wait, keep it off.

## 4. Sending the decision in

You have a few options. Two common ones from the docs:

**Authenticated event trigger.** Your approval UI or backend calls Elsa with the event name, the target instance, and the decision as input:

```http
POST /elsa/api/events/ClaimReviewed/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "workflowInstanceId": "<instance id from the 202>",
  "input": { "decision": "Rejected", "comment": "Receipt missing" }
}
```

The endpoint needs the `trigger:event` permission. Send the decision by `workflowInstanceId`, not by correlation id. On this API path, bind the Event Result to a variable (for example `Review`) and read `getReview().decision`. On the link path the Event Result is empty, so each branch sets `Review` itself. The body field `workflowExecutionMode` defaults to asynchronous: the call returns a 200 after dispatch, before the workflow resumes, so resume errors show up in the journal and incidents, not in the response.

**Tokenized resume URL.** For an email link on an Event wait, mint one link per choice with `createEventTriggerUrl` in JavaScript (Liquid has no token helper), for example `createEventTriggerUrl("ClaimApproved-" + getRound(), TimeSpan.FromHours(48))`. Pass the lifetime as a `TimeSpan`: any other value, such as a string, silently gives a link that never expires. The link is bound to the current instance. The anonymous GET carries no input, so the event name is the decision and the Event Result is empty. Wait on both with two Event activities joined by a Join in Wait any mode (a Fork with Wait any in code), which cancels the other wait, and have each branch set `Review` itself, for example to `({ decision: "Approved" })`. Put the review round in the event name (set the Event name to the expression `"ClaimApproved-" + getRound()`) and add 1 to `Round` on reject. An old link then names an event that no later wait listens for, so it cannot approve a later round. Bookmark tokens (`GenerateBookmarkTriggerUrl` with `GET` or `POST /elsa/api/bookmarks/resume`) are C# only: use them from a custom blocking activity that creates its own bookmark. Both token endpoints are anonymous, so treat the URL like a secret.

Whichever you pick, **scope the stimulus** with the instance id. An unscoped event is a broadcast, and in 3.8 an unscoped stimulus is also tried as a start trigger first.

## 5. Reject and resubmit: rewind is a design choice

"Rewind" is an overloaded word. For approvals there are two clean designs:

**(a) Same-instance loop.** Reject sets a status and waits for a "revised" signal on the same instance. When it arrives, the flow goes back to the review wait. Variables stay on the instance, and the journal tells the whole story in one place: suspended, stimulus, branch, suspended again, and eventually finished.

**(b) New instance on resubmit.** Reject finishes the instance in a terminal "needs changes" state. The employee submits again, which starts a new instance that reloads the claim from your database.

Pick (a) when the revise loop is short and you can keep one readable wait at a time. Pick (b) when a revision restarts a long chain, takes weeks, or you want a clean history per attempt.

What rewind is **not**: replaying the journal backwards, or reaching for operator tools to move an instance around. Those exist for fixing broken instances, not for modelling a business go-back.

And pick one style per workflow. Mixing both in the same flow is how teams end up debugging bookmarks at 2 AM.

## 6. Where state lives

Most "my variables vanished" stories are really "I put state in the wrong place" stories. Code-first variables have no storage driver by default, so they are not saved across a wait. Use Workflow Instance storage for anything that must survive the suspend: in Studio it is the Storage option in the variable dialog (the default for new variables), and in code it is `.WithWorkflowStorage()`. `Review` and `Round` both need that storage.

| State | Lives in | Use it for |
|-------|----------|------------|
| Workflow variables | this instance, Workflow Instance storage | routing data for this run: claim id, status, latest decision |
| Bookmarks | runtime persistence | the pause point until a stimulus arrives |
| Your database | your app | the claim itself, its versions, the audit trail, anything another workflow or report reads |

Two rules of thumb:

- If it must outlive the workflow instance, it belongs in your database. Retention cleanup comes from an elsa-extensions module and can remove finished instances; your audit trail should not disappear with them.
- If you later split work into parent and child workflows, child variables are not the parent's variables. Pass data through explicit inputs and outputs.

## 7. Correlation: find the instance by business key

Set the instance **correlation id** to your business key (here the claim id). Use it to find or look up the right instance from the claim screen. Do not resume the wait by correlation id: a correlation-only stimulus can still start a new workflow. Send the decision by instance id.

Correlation links instances. It does not merge their variables.

## 8. What to watch for

- **Publish, then drive it for real.** Trigger workflows only receive traffic once the definition is published. Test with real HTTP calls, not only Studio Run.
- **Payload shape matters.** Here payload means the stimulus, not the input. If you build custom blocking activities, the stimulus must match the shape the bookmark was created with, or the hash lookup misses.
- **Who is allowed to decide.** The API permission says who may call Elsa. It does not say this person may approve this claim. Check that in your app before you send the stimulus.
- **Retries and double clicks.** Approval callbacks get retried. Make the business action idempotent so a retry does not apply the decision twice. Event token links stay valid for their lifetime, and a click that matches no wait is queued for a few minutes, so put the review round in the event name as shown above. Bookmarks are already single-use by default.
- **Read the journal.** When a claim "did something weird", open the instance and follow status, then journal, then incidents. The branch that actually ran is right there.

## Wrap-up

The whole pattern fits in a sentence: submit, answer the caller, wait on one bookmark, resume with a decision, and on reject loop back on the same instance (or start a fresh one, on purpose).

Start that thin. Add a second reviewer, a timeout, or a child workflow only once this version reads cleanly in the journal.

## Further reading

- [Workflow Patterns: Human-in-the-Loop Approval](https://docs.elsaworkflows.io/guides/patterns)
- [Execution Model](https://docs.elsaworkflows.io/guides/architecture/execution-model)
- [Public Trigger Tokens](https://docs.elsaworkflows.io/guides/security/public-trigger-tokens)
- [Correlation ID](https://docs.elsaworkflows.io/getting-started/concepts/correlation-id)

If you want to build this pattern hands-on, the [Elsa+ Training Solo Bundle](/elsa-plus/training/) includes a lab kit for it.
