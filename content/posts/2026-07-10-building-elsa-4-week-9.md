---
title: "Building Elsa 4 · Week 9: Boundaries You Can Inspect"
slug: "building-elsa-4-week-9"
description: "Week 9 makes Elsa 4 changes reviewable through Git-reconciled workflow definitions, deterministic serialization, and a server-side Studio management bridge."
publishedAt: "2026-07-10"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "devjournal"
  - "software-architecture"
  - "gitops"
  - "serialization"
  - "security"
featuredImage: "../assets/2026-07-10-building-elsa-4-week-9/featured.png"
featuredImageAlt: "Three illuminated architectural chambers make workflow definitions, deterministic data, and server-side host control visible as separate boundaries."
series: "Building Elsa 4"
seoTitle: "Building Elsa 4 Week 9: Boundaries You Can Inspect"
seoDescription: "Week 9 makes Elsa 4 changes inspectable with Git-reconciled definitions, deterministic JSON, and a Studio bridge that keeps host keys server-side."
excerpt: "A public repository is only the start. Week 9 makes three Elsa 4 boundaries inspectable from decision to implementation."
---

# Building Elsa 4 · Week 9: Boundaries You Can Inspect

## Where we are on the road

[Week 8 made the runtime execution seam real](/blog/building-elsa-4-week-8). Week 9 turns outward from that execution spine. It asks how workflow definitions cross environments, how their content gets a stable identity, and how Studio reaches protected host operations without handing a server credential to the browser.

The three answers look separate at first: Git reconciliation, deterministic serialization, and a server-side management bridge. They share one idea. A boundary is useful only when we can inspect who owns it, what crosses it, how it fails, and what it deliberately refuses to do.

> **Key Takeaways**
> - Git carries immutable workflow-definition versions for review and distribution, but it never becomes Elsa's runtime store.
> - Stable serialized bytes make content hashes and Git diffs meaningful.
> - Studio keeps backend host-management keys server-side and checks explicit user permissions.
> - The ADRs, specs, PRs, and pinned code are public, so each boundary can be inspected.

## Why is Git a boundary instead of the runtime store?

[ADR 0034 defines Git as a reconciliation source and export sink](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L11-L14). The operational catalog remains Elsa's only runtime read path. Immutable workflow-definition versions may move through Git, but workflow execution never waits on a clone, fetch, or repository query.

That limit matters because Git adds a narrow set of useful capabilities. It gives authored workflows PR review, readable diffs, cross-environment distribution, and an out-of-database canonical record. Elsa already has immutable workflow versions, so the decision does not pretend Git invented version history for the engine. [The ADR states that distinction directly](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L31-L40).

The authority split is precise. Git owns the canonical content for a fixed definition ID and version. The catalog owns retention as an append-only ledger. If both sides present the same identity with different content, Elsa treats the source as broken. [It does not try to merge two supposedly immutable versions](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L46-L59).

Version 1 also has one writer. One catalog promotes and exports; consumer environments import read-only. That constraint follows from Elsa's current system-assigned version numbers. Two independent writers could otherwise create different `2.0.0` versions for the same definition. [Multi-writer and Git-first authoring are therefore explicit non-goals for this slice](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L61-L74).

<!-- [UNIQUE INSIGHT] -->

Export is a reconciliation pass, not a reaction to one promotion event. It compares the catalog's immutable version set with the repository's files, writes what is absent, and skips what is already present. Import follows the inverse rule. [That set-based shape prevents a Git-to-catalog-to-Git loop without provenance flags](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L91-L102).

[Drafts stay outside this boundary](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L136-L149) because they are mutable, disposable, and potentially multi-author. They remain in the operational store. The implemented GitOps slice landed in [Foundation PR #577](https://github.com/elsa-workflows/elsa-foundation/pull/577), while ADR 0034 still records `proposed` at the pinned research SHA. The code has moved; the decision status remains visible rather than being rewritten by the journal.

## What makes a Git-reviewed workflow definition trustworthy?

Equal workflow state must produce equal serialized bytes. Otherwise, a content hash can report a change caused only by dictionary enumeration or member ordering. [ADR 0034 makes canonical serialization a hard prerequisite](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0034-workflow-definitions-reconcile-from-and-export-to-git.md#L76-L89), because a noisy hash would make Git review less trustworthy, not more.

[Spec 086 defines the shipped behavior](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/specs/086-deterministic-payload-serialization/spec.md#L1-L27). The shared payload serializer now applies a fixed object-member order and sorts dictionary keys. [PR #549](https://github.com/elsa-workflows/elsa-foundation/pull/549) landed that work in the common serializer rather than building a separate Git-only renderer.

That choice connects this week's GitOps work to the broader [persistence boundary built around Groundwork](/blog/groundwork-and-the-persistence-boundary-in-elsa). Stable content identity is not only useful when a file reaches Git. [Activity reconciliation already relies on a content hash](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/specs/086-deterministic-payload-serialization/spec.md#L36-L40), so it also needs equal logical input to produce equal bytes.

Serialization had another source of instability: two competing stories for type identity. One used short registered aliases. [The older open-object converter embedded assembly-qualified names in `_type` fields and could fall back to `Type.GetType`](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0035-serialization-unifies-on-the-alias-registry-and-retires-open-object-polymorphism.md#L16-L25). [ADR 0035 chooses the alias registry as the single persisted type mechanism](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0035-serialization-unifies-on-the-alias-registry-and-retires-open-object-polymorphism.md#L54-L66).

Dynamic data still needs a representation, but it does not need a hidden CLR type tag. A declared `Any` value is stored as opaque JSON and materializes as `JsonNode`. Each expression engine adapts that node to its own value model. [The storage contract stays JSON-native while the language-specific conversion stays at the expression boundary](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0035-serialization-unifies-on-the-alias-registry-and-retires-open-object-polymorphism.md#L68-L86).

The change does not claim that Elsa semantically reorders arbitrary opaque JSON. Designer bags move to `JsonElement` and preserve authored bytes verbatim. [ADR 0035 explicitly protects that opaque-data rule](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0035-serialization-unifies-on-the-alias-registry-and-retires-open-object-polymorphism.md#L88-L112). [PR #570](https://github.com/elsa-workflows/elsa-foundation/pull/570) then removes open-object polymorphism instead of maintaining both models.

## Why does Studio put a server between the browser and host control?

A signed-in browser user and a trusted server-to-server caller are different principals. [ADR 0037 says the browser must not carry an Elsa host-management key](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0037-studio-management-bridge-keeps-host-management-key-server-side.md#L7-L11). Studio now keeps that credential server-side and exposes a separate browser-facing management bridge.

The request path has three steps. The browser authenticates to Studio with its normal session or bearer token. Studio checks a feature-owned permission such as `module-management.read` or `extension-builder.manage`. Only then does the Studio server attach the host-management key when it calls the target Elsa host. [The ADR records both the permission model and the server-held credential boundary](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0037-studio-management-bridge-keeps-host-management-key-server-side.md#L21-L45).

This is not a transparent reverse proxy. Studio owns the browser routes and data shapes, so the frontend does not couple itself to backend host-control paths. [The pinned bridge implementation maps Studio-owned status, registry, and Extension Builder capability routes](https://github.com/elsa-workflows/elsa-foundation-studio/blob/f8598566b642f166f8e192d366269fab1e4f6db2/src/Elsa.Studio.Web/StudioBackendManagementBridge.cs#L8-L35).

The failure model is part of the contract. Studio reports `available`, `unconfigured`, `unreachable`, `unauthorized`, or `degraded`. The browser can render a useful state instead of repeatedly probing a protected backend endpoint. [ADR 0037 requires those explicit availability states](https://github.com/elsa-workflows/elsa-foundation/blob/92de20a21b5e0f821d8add8f3ec954aa7fd27402/docs/adr/0037-studio-management-bridge-keeps-host-management-key-server-side.md#L59-L72).

This work complements [OpenID Connect in Elsa Studio](/blog/openid-connect-in-elsa-studio), but it solves a different problem. Login proves who the user is. Host-control permissions decide what that user may request. The server-held management key authenticates Studio to another host. [Studio PR #255](https://github.com/elsa-workflows/elsa-foundation-studio/pull/255) removes the browser exposure, and [PR #257](https://github.com/elsa-workflows/elsa-foundation-studio/pull/257) gates the surfaces with host-control permissions.

## What does “building in the open” mean here?

It means a reader can trace the main claims across public decision records, specs or PRs, and SHA-pinned code. The decision artifact explains tradeoffs. A spec or PR makes the scope concrete. A pinned file shows the resulting code without letting a later edit move the evidence underneath the article.

<!-- [PERSONAL EXPERIENCE] -->

That chain matters during a week with unusual velocity. Running the [DevJournal repository extractor](https://github.com/elsa-workflows/elsa-blog/blob/a0b2256d9d78de240c1a1d0a45ebf30dce8ac710/tools/devjournal/devjournal_extract.py) against the pinned source clones counted 403 non-merge Foundation commits and 164 merged pull requests. Studio added 89 non-merge commits and 43 merged pull requests.

Those numbers are not the story. They explain why the story needs durable anchors. At that pace, a weekly list of features would age before publication. A decision record with explicit non-goals can survive the next refactor, and a pinned implementation link lets readers distinguish what the project intended from what actually landed.

Open work also means leaving uncertainty visible. ADR 0034 is proposed at the recorded SHA. ADRs 0035 and 0037 are accepted. The GitOps feature is implemented. Those facts can coexist. Building in the open is not polishing every artifact into one confident status; it is giving contributors enough evidence to see the state for themselves.

## What does this unlock next?

These boundaries make later work smaller by stating what it must not absorb. GitOps v1 does not solve multi-writer authoring or synchronize drafts. The deterministic serializer is shared infrastructure, not a private Git formatter. The Studio bridge centralizes user permission checks and backend availability without weakening the existing host-control credential boundary.

None of that is a roadmap promise. It is the value of a well-drawn seam: future changes have a clear place to attach and a clear line they should not cross. The next DevJournal can then describe movement against public constraints, not reinterpret a feature list after the fact.

That is what building Elsa 4 in the open looks like this week. The repositories show the code. The ADRs show the tradeoffs. The gaps between them remain visible too.
