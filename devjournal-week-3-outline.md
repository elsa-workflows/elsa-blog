# Outline: Building Elsa 4 · Week 3: The First Speckit Slices

## Title Suggestions
1. Building Elsa 4 · Week 3: The First Speckit Slices
2. Building Elsa 4 · Week 3: Pinning Workflow State
3. Building Elsa 4 · Week 3: What State Must Not Become

## Target Parameters
- **Primary keyword**: Building Elsa 4 Week 3
- **Search intent**: Informational / engineering journal
- **Target word count**: 1,300-1,600 words
- **H2 sections**: 6
- **Target reading level**: Expert-accessible, clear paragraphs, no hype

---

## Outline

### H2: Where we are on the road (~160 words)
- **Answer-first opener**: Week 3 is the point where Elsa 4 starts converting architecture review into numbered Speckit slices.
- **Key points to cover**:
  - Reference “Why Elsa 4?” by title only.
  - Recap Week 2 as boundary-shaping work.
  - Name the headline: §E2.9 scope policy plus activity identity catalog.
- **Source**: elsa-core worked example; Week 3 commits.
- **Chart suggestion**: None.
- **Image placement**: No.

### H2: The headline decision: `WorkflowDefinitionState` gets a fence (~520 words)
- **Answer-first opener**: §E2.9 defines `WorkflowDefinitionState` as the canonical authored document and prevents it from becoming the next god object.
- **Key points to cover**:
  - Quote the constitution line about canonical authored document and god-object risk.
  - Explain the triplet: authored state, read models/projections, executable.
  - Connect to Design ↔ Runtime and artifact-only runtime.
- **H3: What it rules out**
  - Runtime/operational state.
  - Executable/build metadata.
  - Projections/search/listing.
  - Security/ownership.
  - Designer layout and validation errors.
- **Source**: constitution §E2.9; spec 002; commit `d01eed8a`.
- **Chart suggestion**: None; use prose triplet.
- **Image placement**: No.

### H2: Why did the activity catalog matter this week? (~320 words)
- **Answer-first opener**: Spec 001 makes the catalog the source of truth for visible activities, so the picker no longer depends on live provider discovery.
- **Key points to cover**:
  - `ActivityTypeKey` decouples logical identity from CLR type information.
  - Catalog row presence controls picker visibility.
  - `IsBrowsable` is explicitly removed/rejected.
  - Non-CLR activity entries become possible through the same catalog path.
- **Source**: spec 001; constitution §E2.8; commit `db691030`.
- **Chart suggestion**: None.
- **Image placement**: No.

### H2: How did the first Speckit slices make the build legible? (~330 words)
- **Answer-first opener**: Specs 001 and 002 turn architecture into reviewable slices with user stories, requirements, and tests.
- **Key points to cover**:
  - Spec 001: activity identity, catalog, descriptor, provenance.
  - Spec 002: state scope, layout siblings, NodeId, ActivityVersionId.
  - Commits show implementation chunks instead of one opaque rewrite.
- **Source**: specs 001/002; commits `99da3acb`, `ca1957d3`.
- **Chart suggestion**: None.
- **Image placement**: No.

### H2: What did Week 3 deliberately reject? (~250 words)
- **Answer-first opener**: The important move was not only adding models; it was refusing several tempting shortcuts.
- **Key points to cover**:
  - No god `WorkflowDefinitionState`.
  - No picker entries from assembly scanning.
  - No layout inside `ActivityNode`/State.
  - No ambiguous legacy `WorkflowMetadata` catch-all.
- **Source**: constitution §E2.9.2; specs 001/002; commit `99da3acb`.

### H2: What this unlocks next (~180 words)
- **Answer-first opener**: Future work can now attach concerns to the right surface instead of negotiating the boundary from scratch.
- **Key points to cover**:
  - Runtime executable can remain the runtime artifact.
  - Projections can serve dashboards without changing authored state.
  - Activity availability policy can filter catalog rows without redefining catalog facts.
- **Source**: constitution §E2.6, §E2.8, §E2.9.

### H2: This week by the numbers (~130 words)
- 15 non-merge commits.
- 0 merged PRs.
- 2 spec slices.
- 1 contributor: Joey Barten.
- “If you read one thing” links: spec 001, spec 002, constitution §E2.9, `d01eed8a`.

### H2: Follow along (~80 words)
- Foundation repo.
- Studio repo.
- Constitution.
- Glossary.

---

## Content Gaps to Exploit
1. Most engineering logs list commits; this one explains the negative-space boundary decisions.
2. The post should connect entity-level scope to the older package-level “god package” problem.
3. Use primary-source links heavily rather than recap from memory.
