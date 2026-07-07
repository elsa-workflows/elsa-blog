# Outline: Building Elsa 4 · Week 5

## Title Suggestions
1. Building Elsa 4 · Week 5: The Runtime Execution Seam Explodes into Specs
2. Building Elsa 4 · Week 5: Runtime Becomes an Ordered Program
3. Building Elsa 4 · Week 5: What Happens When the Runtime Seam Gets Real?

## Target Parameters
- **Primary keyword**: Building Elsa 4 Week 5
- **Search intent**: Informational / engineering-journal continuity
- **Target word count**: 1,700–2,000 words
- **H2 sections**: 7
- **Reading level**: technical but direct

---

## Outline

### H2: Where we are on the road (~140 words)
- Week 4 recap: the runtime seam was still a deferred boundary from the earlier architecture work.
- Reference the series kickoff, “Why Elsa 4?”, by title only.
- Answer-first: Week 5 is the week the seam becomes an ordered spec program.
- Mention verified scale: 162 non-merge commits and 67 merged PRs.

### Key Takeaways box (~80 words)
- The runtime seam moves from constitution/program-goal language into specs.
- Groundwork gives a persistence substrate without collapsing every workload into documents.
- The activity construction/root-activity corrections show the team rejecting convenient but leaky abstractions.

### H2: The headline: the runtime execution seam becomes a spec program (~520 words)
- Open with constitution §E2.6: executable-always-runs and artifact-only runtime.
- Cite runtime execution program goal.
- Use representative runtime specs rather than listing all 70+ slices.
- Explain the ordered shape: artifact and execution state → checkpoint envelope → scheduler queue → post-commit outbox → recovery → execution context.
- Cite PRs #7, #8, #24, #48, #50, #51, #66.
- Include “what it rules out”: runtime does not execute authored Design documents; post-commit effects do not fire before checkpoint commit.

### H2: Supporting thread: Groundwork becomes the persistence substrate (~360 words)
- Open with Groundwork program goal and spec 012.
- Cite provider-neutral manifest, workload classification, Elsa validation bridge.
- Cite spec 013 for same manifest producing relational and document plans.
- Cite spec 014 for SQLite document store and declared-index/concurrency rules.
- Connect to runtime: Groundwork can support suitable stores, but runtime hot paths remain benchmark-gated or specialized.
- Cite PR #18.

### H2: Supporting thread: workflow-as-activity exposes a leaky seam (~330 words)
- Cite spec 005 as intent and historical record.
- Cite spec 006 as the redesign: descriptor-type-driven construction, no runtime dependency on Design.
- Explain that this matters because workflow-as-activity crosses the exact seam the runtime contract protects.
- Include what was rejected: `IImplementationDescriptor`, `Kind` strings, two registries, design-side descriptor knowledge.

### H2: Supporting thread: the root activity correction narrows the model (~300 words)
- Cite spec 070 and PR #72.
- Explain why graph-shaped workflow boundaries were corrected.
- The workflow owns one root activity; Flowchart, Sequence, If, ForEach own their child semantics.
- What it rules out: universal workflow-level edges, start node IDs, generic composition carrier in Workflows Core.

### H2: What this unlocks next (~190 words)
- Runtime implementation can now proceed through named, testable contracts.
- Groundwork provider validation can continue without forcing hot-path runtime stores into generic document storage.
- Week 6/7 themes can focus on implementing, hardening, activity-owned behavior, and recovery/provider evidence.

### H2: This week by the numbers (~170 words)
- 162 non-merge commits.
- 67 merged PRs.
- 3,678 files changed, +87,247/-25,855.
- Contributors in prose: Sipke Schoorstra (105), Joey Barten (50), j03y-nxxbz (7).
- “If you read one thing” links: constitution §E2.6, runtime program goal, spec 007, spec 012, spec 070.

### H2: Follow along (~90 words)
- Foundation repo.
- Studio repo.
- Constitution.
- Glossary.
- Invite readers to inspect specs and PRs as primary sources.

---

## Content Gaps to Exploit
1. Avoid enumerating all specs. Explain the ordered runtime program.
2. Make the negative space visible: what each seam rejects is as important as what it adds.
3. Connect Groundwork to runtime carefully: it is a substrate, not an automatic answer for every runtime workload.
4. Treat workflow-as-activity as a stress test of the architecture, not a side feature.
