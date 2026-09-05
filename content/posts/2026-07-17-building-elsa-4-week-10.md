---
title: "Building Elsa 4 · Week 10: Identity Is Not Authority"
slug: "building-elsa-4-week-10"
description: "Week 10 separates executable identity from publication authority, keeps layout with source references, and makes Studio publication a reviewable operation."
publishedAt: "2026-07-17"
status: "draft"
authors: ["sipke"]
category: "Engineering"
tags: ["elsa-workflows", "dotnet", "devjournal", "software-architecture"]
series: "Building Elsa 4"
excerpt: "A workflow artifact tells us what will run. A publication slot tells us whether new work may start. Week 10 makes that distinction explicit."
---

# Building Elsa 4 · Week 10: Identity Is Not Authority

## Opening the boundary

An executable can still be needed after its publication stops accepting work. That distinction runs through Week 10, covering **July 10 through July 16, 2026**: the window `[2026-07-10, 2026-07-17)`. [ADR 0043](https://github.com/elsa-workflows/elsa-foundation/blob/58bbd6d28b0c0ec1c31ad1b65d43be7dcd3f41a8/docs/adr/0043-publication-slots-define-start-authority.md) separates permission to start a workflow from the identity and retention of its executable.

[Week 9 explored boundaries we can inspect](/blog/building-elsa-4-week-9). This week gives those boundaries a sharper vocabulary. What did we compile? Which publication may accept new work? What did the author actually confirm? Treating all three as "the workflow version" hides decisions that need different owners.

> **Key Takeaways**
> - Executable hashes describe compiled execution material, not an individual publication.
> - Layout and publication provenance live on source references.
> - A publication slot selects at most one active publication under ADR 0043.
> - Studio's review flow distinguishes preparation, saving, promotion, and publication, including partial failures.

## What does an executable hash identify?

The hash identifies compiled execution material rather than a particular publish. [ADR 0038](https://github.com/elsa-workflows/elsa-foundation/blob/58bbd6d28b0c0ec1c31ad1b65d43be7dcd3f41a8/docs/adr/0038-artifact-hash-is-purely-behavioral-and-executables-are-content-addressed.md) removes source identity from that material. Two publications can therefore point to the same content-addressed executable while retaining separate provenance. Publication time and version labels don't need to manufacture another executable identity.

The initial implementation landed on July 10 in [elsa-workflows/elsa-foundation#608](https://github.com/elsa-workflows/elsa-foundation/pull/608). Its [hasher](https://github.com/elsa-workflows/elsa-foundation/blob/2d7801122c5f2ebe1f629cd528a18dbb848f480c/src/Elsa/Workflows/Publishing/Api/Services/WorkflowExecutableHasher.cs) renders the executable node tree deterministically and computes a SHA-256 hash. The payload includes activity identities, descriptors, bindings, and structure rather than source-definition labels.

This is content identity, not a theorem prover. It doesn't establish that two arbitrarily different graphs compute equivalent results. The useful promise is narrower: equivalent canonical execution material doesn't become different merely because it was published again. That distinction keeps the model understandable without claiming more than the implementation can establish.

<!-- [UNIQUE INSIGHT] -->

Once identity stops answering "which publish?", the provenance question still needs an answer. The ADR doesn't discard it. It moves those facts onto source references. That's the important architectural move: separate two valid questions instead of making one identifier carry both meanings indefinitely.

## Why does layout belong on a reference?

Layout belongs on a source reference because two arrangements can depict the same executable. [ADR 0039](https://github.com/elsa-workflows/elsa-foundation/blob/58bbd6d28b0c0ec1c31ad1b65d43be7dcd3f41a8/docs/adr/0039-layout-sidecar-lives-on-the-source-reference.md) places the publish-time layout sidecar beside provenance, outside the artifact hash. Moving a node on the canvas shouldn't change what the engine executes, and it shouldn't mutate an already stored executable.

The rejected alternative is revealing. If layout lived on the artifact with last-publish-wins behavior, an ostensibly immutable object would acquire changing presentation state. Another alternative, loading geometry from the original definition, would prevent independent inspection when that definition wasn't available. The reference-carried sidecar avoids both dependencies.

This also makes a limitation explicit. Inspecting an artifact without a chosen reference requires selecting a presentation. The ADR specifies borrowing the newest reference's layout and identifying that choice, or using automatic layout when none exists. There isn't one secretly canonical canvas arrangement. There is immutable execution material and an explicitly selected way to display it.

## Who may start the workflow?

A slot's selected publication is the authority for new starts. [ADR 0043](https://github.com/elsa-workflows/elsa-foundation/blob/58bbd6d28b0c0ec1c31ad1b65d43be7dcd3f41a8/docs/adr/0043-publication-slots-define-start-authority.md), accepted July 13, says neither an artifact nor a source reference grants that authority alone. Trigger bindings, schedules, and route tables project the selection; they aren't independent owners of publication intent.

Ordinary publication replaces the `default` slot. Intentional coexistence requires an explicit named slot. That addresses a concrete ambiguity in the ADR: publishing an HTTP workflow at `/foo`, editing it to `/bar`, and publishing again shouldn't silently leave both versions accepting work. Side-by-side operation is useful, but it needs to be an expressed choice.

The activation contract is stricter than "save the new thing, then remove the old thing." It calls for candidate preparation before a revision-checked slot transition. A failed or losing candidate leaves the prior publication authoritative. Where stores can't share a transaction, the decision specifies durable projection intent and reconciliation rather than pretending every write is atomic.

These are accepted architectural requirements, not a claim that this journal independently certified every provider. The public record makes them reviewable precisely because it states the failure cases, ownership, and ordering.

Retiring authority also doesn't mean deleting the executable. [ADR 0040](https://github.com/elsa-workflows/elsa-foundation/blob/58bbd6d28b0c0ec1c31ad1b65d43be7dcd3f41a8/docs/adr/0040-one-artifact-store-with-reference-derived-lifetime.md) retains artifacts through live references and retained execution records, including their dependency closure. An execution that has pinned an artifact still needs it for inspection or continuation. Retention answers "is this still needed?", not "may another run start?"

## What is the author actually confirming?

Studio prepares a publication review without saving or promoting the captured draft. The [July 13 operations implementation](https://github.com/elsa-workflows/elsa-foundation-studio/blob/a9ca709844f4e9987ff59749dac2b2fed959f288/src/Elsa.Studio.Workflows/Client/src/workflow-editor/useWorkflowOperations.ts) reads policy, slots, and relevant versions first. The author then confirms a particular draft snapshot and publication intent, rather than clicking a warning that appears after the meaningful mutation.

The [review model](https://github.com/elsa-workflows/elsa-foundation-studio/blob/a9ca709844f4e9987ff59749dac2b2fed959f288/src/Elsa.Studio.Workflows/Client/src/workflow-editor/publicationReview.ts) records changes to activities, inputs, outputs, and triggers. It distinguishes replacement from named side-by-side publication. Missing information about an occupied slot prevents preparing a trustworthy review instead of being interpreted as an empty baseline.

Confirmation then crosses several boundaries. Studio saves the reviewed draft, checks validation, promotes a version, runs server publication preflight, and requests publication. Server preflight can reject activation after promotion. In that case the promoted version remains available, and the interface reports partial failure rather than implying that nothing happened.

<!-- [UNIQUE INSIGHT] -->

That failure language is part of the design, not just better copy. A retry after promotion shouldn't be explained as if the original draft were untouched. The implementation has distinct states for a saved draft whose promotion failed and a promoted version whose publication failed. The reader can inspect those branches in [elsa-workflows/elsa-foundation-studio#352](https://github.com/elsa-workflows/elsa-foundation-studio/pull/352).

## Building in the open means preserving the distinctions

The decision records and Studio code expose different kinds of evidence. The ADRs describe ownership and required invariants. The merged implementation shows how a client carries those distinctions into a review flow. Neither should be substituted for the other, and a source link pinned to this week keeps later changes from rewriting the account.

This continues the motivation behind [rebuilding Elsa 4](/blog/why-elsa-4-rebuilding-a-dotnet-workflow-engine): make the boundaries explicit enough to reason about independently. Here, the questions are unusually practical. Does replacing a publication affect retained runs? Does moving a node change identity? What remains after a failed confirmation?

The useful next step for contributors is to inspect those cases against the linked contracts and code. Not every retained object is authorized to start. Not every failed operation left the system unchanged. Week 10 makes both distinctions visible.
