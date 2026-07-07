# Content Brief: Building Elsa 4 · Week 5: The Runtime Execution Seam Explodes into Specs

## Template
**Recommended**: `news-analysis`: This is a weekly engineering journal entry interpreting a burst of source-controlled architecture work, not a how-to or product announcement.
**Template file**: `templates/news-analysis.md` (adapted to the local DevJournal prompt).

## Target Audience
.NET developers, workflow-engine users, Elsa contributors, and software architects following the Elsa 3 to Elsa 4 rebuild.

## Search / Reader Intent
Informational and continuity-driven. Readers want to understand what changed in Week 5, why the runtime execution seam matters, and how the spec flood fits the larger “Building Elsa 4” story.

## Required Narrative
- Headline: the runtime execution seam finally moved from deferred constitutional boundary to an ordered Speckit program.
- Supporting thread A: runtime execution contracts form a scheduler/work-queue + checkpoint-commit + post-commit outbox + recovery model.
- Supporting thread B: Groundwork persistence provides the provider-neutral substrate that can store some of the resulting state without pretending every runtime workload is a document.
- Supporting thread C: workflow-as-activity survived as intent, but the activity construction mechanism was redesigned around descriptor types and later corrected again by the root-activity contract.

## Verified Primary Sources
- Constitution §E2.6: executable-always-runs and artifact-only runtime.
- Program goal: `docs/program-goals/runtime-execution-seam.md`.
- Program goal: `docs/program-goals/groundwork-persistence-readiness.md`.
- Runtime specs cited: `007-runtime-executable-state-contracts`, `008-checkpoint-commit-envelope`, `022-runtime-scheduler-work-queue`, `046-runtime-post-commit-outbox-store`, `049-runtime-recovery-scanner`, `064-runtime-workflow-execution-context`, `070-workflow-root-activity-contract`.
- Groundwork specs cited: `012-groundwork-persistence-foundation`, `013-groundwork-core-manifest-planner`, `014-groundwork-sqlite-document-store`.
- Activity seam specs cited: `005-workflow-as-activity`, `006-activity-construction-seam`.
- PRs verified with `gh pr view`: #7, #8, #18, #24, #48, #50, #51, #66, #72.

## Content Parameters
- **Word count**: 1,700–2,000 words.
- **Format**: Markdown with strict project frontmatter.
- **Tone**: Builder’s log; technical, source-linked, no hype.
- **Required frontmatter**: only `title`, `slug`, `description`, `publishedAt`, `status`, `authors`, `category`, `tags`, `series`, optional SEO/excerpt fields.

## Recommended Title
Building Elsa 4 · Week 5: The Runtime Execution Seam Explodes into Specs

## Meta Description
Week 5 turns Elsa 4's runtime contract into 67 merged PRs of ordered specs, with Groundwork defining the persistence substrate beneath it.

## Key Takeaways Draft
> **Key Takeaways**
> - Week 5 converts the runtime seam from a deferred constitutional boundary into an ordered spec program.
> - The runtime model now has representative slices for artifacts, checkpoint commits, work queues, outbox delivery, recovery, and execution context.
> - Groundwork advances in parallel as a provider-neutral persistence foundation, while workflow-as-activity forces a cleaner construction seam.

## Information-Gain Opportunities
- **[PERSONAL EXPERIENCE]**: Explain why the interesting part is not “many specs” but the decision to make each runtime seam inspectable before implementation spreads.
- **[UNIQUE INSIGHT]**: Tie Groundwork’s workload taxonomy to the runtime outbox/recovery work: persistence helps only when the workload boundary is named first.
- **[UNIQUE INSIGHT]**: Show what the root-activity correction rules out: no universal workflow-level graph hidden inside core runtime contracts.

## Required Sections
1. **Where we are on the road**: recap Week 4 as leaving the runtime seam deferred; reference the kickoff by title, “Why Elsa 4?”
2. **Key Takeaways**: answer-first summary box.
3. **Headline**: runtime execution seam becomes a spec program; cite constitution §E2.6 and runtime program goal.
4. **Supporting thread — Groundwork**: cite Groundwork program goal and specs 012–014; emphasize provider-neutral, document-first, workload-classified storage.
5. **Supporting thread — workflow-as-activity and construction seam**: cite specs 005, 006, and 070; emphasize rejected design mechanism and root-activity correction.
6. **What this unlocks next**: runtime implementation, Week 6/7 themes around hardening, activity-owned behavior, and provider validation.
7. **This week by the numbers**: 162 non-merge commits, 67 merged PRs, 3,678 files changed (+87,247/-25,855), contributors Sipke Schoorstra (105), Joey Barten (50), j03y-nxxbz (7).
8. **Follow along**: foundation repo, studio repo, constitution, glossary.

## What It Rules Out
- Runtime execution cannot load Design-owned workflow documents to execute.
- Checkpoint names cannot be used as persistence policy knobs.
- Post-commit effects cannot run before the checkpoint commit succeeds.
- Groundwork cannot silently treat runtime queues, execution logs, outbox records, or distributed locks as ordinary documents.
- Core workflow/runtime contracts cannot own universal flowchart edges, start nodes, or generic composition semantics.

## Internal Link Notes
Do not invent URLs for previous series posts. Mention “Why Elsa 4?” by title only. Link primary sources directly to GitHub source files and PRs.
