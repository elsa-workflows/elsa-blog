# Content Brief: Building Elsa 4 · Week 3: The First Speckit Slices

## Template
**Recommended**: `thought-leadership` / development journal: this is a technical narrative post grounded in primary sources, not a tutorial or release note.
**Source prompt**: `tools/devjournal/writing-prompt.md`

## Topic Intake
- **Topic**: Week 3 of the Building Elsa 4 series, covering 2026-05-22 through 2026-05-29 exclusive.
- **Target audience**: .NET developers, workflow-engine users, software architects, and contributors following the Elsa 3 to Elsa 4 rebuild.
- **Search intent**: Informational; readers want to understand why the architecture changed and what the numbered Speckit slices mean.
- **Business context / CTA**: Build trust in Elsa 4's architecture process; invite readers to follow the foundation and studio repositories.

## Primary Sources to Cite
- `specs/001-activity-identity-catalog/spec.md`: Activity Identity & Catalog as Source-of-Truth.
- `specs/002-workflow-state-scope/spec.md`: WorkflowDefinitionState Scope Policy.
- `.specify/memory/constitution.md` §E2.8 and §E2.9.
- `docs/reference/elsa-worked-examples.md`: elsa-core baseline and god-package problem.
- Commits verified locally:
  - `db6910306cebc36e41be318275878ae204d70bd9` — Unit B activity identity and catalog model.
  - `d01eed8a7e95712ea9d47c99e4e75f4d39e745ec` — Unit C Phase 3, §E2.9 scope policy.
  - `ca1957d3cfda30da92845353eea80e867ddcb6fc` — Unit C layout siblings, NodeId rename, ActivityVersionId collapse.
  - `99da3acbf7c49171e6a07c3428b8651970b9e5a2` — Unit C IsRequired contract, WorkflowMetadata deletion, migration reset.
- Week count verification: 15 non-merge commits in the exclusive week window; sole author in git log is `j03y-nxxbz`; `gh pr list` returned 0 merged PRs for the window.

## Search / Content Intent
This post should not compete as a generic SEO guide. It should be an answer-first engineering diary entry: what changed, why the boundary matters, and what the change rejects. The reader should leave with a mental model of Elsa 4's authoring / reading / executing triplet.

## Recommended Title
Building Elsa 4 · Week 3: The First Speckit Slices

Alternative titles:
1. Building Elsa 4 · Week 3: Pinning the Workflow State Boundary
2. Building Elsa 4 · Week 3: From Decisions to Specs
3. Building Elsa 4 · Week 3: The Catalog Becomes the Source of Truth

## Meta Description
Week 3 turns Elsa 4 decisions into Speckit slices: WorkflowDefinitionState scope, the activity catalog source of truth, and the first numbered specs.

## Key Takeaways Draft
> **Key Takeaways**
> - Week 3 produced 15 non-merge commits and the first two numbered specs.
> - §E2.9 defines `WorkflowDefinitionState` as authored content, not runtime, projection, layout, or executable state.
> - The activity catalog becomes the design-time source of truth for picker visibility.

## Information Gain Opportunities
- **[PERSONAL EXPERIENCE]**: Explain that the meaningful work this week is negative space: naming what state must not absorb.
- **[UNIQUE INSIGHT]**: Connect §E2.9 directly back to elsa-core problem #1: god packages become god objects if boundaries are not pinned at the entity level.
- **[ORIGINAL DATA]**: Use the week window count: 15 non-merge commits, 0 merged PRs, 2 new spec slices, 1 contributor.

## Content Outline

### Where we are on the road (120-170 words)
- Recap Week 2 as boundary setup work and reference the kickoff by title, “Why Elsa 4?”.
- Headline: Week 3 is where the work becomes legible through numbered Speckit slices.
- Promise: explain §E2.9 and the catalog source-of-truth rule.

### The headline decision: `WorkflowDefinitionState` gets a fence (450-550 words)
- Answer-first: §E2.9 says State is the canonical authored document.
- Quote: “the canonical authored document of a workflow definition” and the god-object warning.
- Explain the triplet: `WorkflowDefinitionState` ↔ read models/projections ↔ `WorkflowExecutable`.
- What it rules out: runtime state, executable/build metadata, publication/deployment state, projections, security/ownership, designer layout, validation errors.

### Supporting thread: the activity catalog becomes the picker truth (250-350 words)
- Spec 001 decouples activity identity from CLR types.
- `ActivityTypeKey` survives CLR renames and repackaging.
- Picker visibility comes from catalog rows, not live providers or assembly scanning.
- Tie to commit `db691030`.

### Supporting thread: the spec slices sharpen the model (300-400 words)
- Spec 002 groups the workflow scope policy, layout siblings, NodeId naming, and `ActivityVersionId` collapse.
- Mention `WorkflowDefinitionVersionLayout` and `WorkflowDefinitionDraftLayout` as sibling entities.
- Mention `IsRequired` and legacy `WorkflowMetadata` deletion as cleanup in support of the boundary.

### What this unlocks next (170-230 words)
- Future units can allocate publication, executable, projection, and validation concerns without dumping them into State.
- Runtime can remain artifact-only through `WorkflowExecutable`.
- The catalog can later support non-CLR activities and availability policy without picker drift.

### This week by the numbers (compact)
- 15 non-merge commits.
- 0 merged PRs.
- 2 spec slices.
- Sole contributor: Joey Barten.
- Best links: spec 001, spec 002, constitution §E2.9, commit `d01eed8a`.

### Follow along
- Foundation repo.
- Studio repo.
- Constitution.
- Glossary.

## Citation Capsule Plan
| Section | Capsule Focus | Source |
|---|---|---|
| Headline | §E2.9 defines State and prevents god-object creep | constitution §E2.9 |
| Activity catalog | Catalog rows, not live scans, drive picker visibility | spec 001 + constitution §E2.8 |
| Spec slices | Unit C slices layout, NodeId, and ActivityVersionId into separate decisions | spec 002 + commits |
| Numbers | Week count and PR count | local git log + GitHub PR search |

## Internal Link Architecture
- **Link TO**: Mention “Why Elsa 4?” by title only; do not invent a URL.
- **Link TO**: `Groundwork: Provider-Neutral Persistence for Elsa` may be related later, but avoid linking unless chronology is intentionally non-linear.
- **Link FROM**: Future series index should link to this post once the series exists.
- **Cluster position**: Spoke in Building Elsa 4 DevJournal series.

## Distribution Plan
- **LinkedIn**: Short architecture note: “The hardest part of a workflow definition is deciding what it is not.”
- **Twitter/X**: Thread around the triplet: authored state, projections, executable.
- **Reddit / community**: Share only as a process note in workflow/.NET architecture discussions, not as promotion.
