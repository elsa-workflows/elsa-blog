# Elsa 4 DevJournal Toolkit

Tooling for the **"Building Elsa 4 in the open"** weekly blog series — a
development journal that follows the rebuild of the Elsa workflow engine from
`elsa-core` (v3) to the modular, spec-driven **Elsa Foundation** (v4).

The series mines the real git history of two repositories:

- [`elsa-workflows/elsa-foundation`](https://github.com/elsa-workflows/elsa-foundation) — the engine / domain core (started 2026-05-08)
- [`elsa-workflows/elsa-foundation-studio`](https://github.com/elsa-workflows/elsa-foundation-studio) — the modular studio shell (started 2026-06-14)

Both are spec-driven (Speckit) projects with numbered spec slices, ADRs, a
two-layer constitution, and program-goal roadmaps — so each week's work
documents itself. This toolkit turns that paper trail into publishable posts.

## Contents

| File | Purpose |
|---|---|
| `devjournal_extract.py` | Read-only git extractor. Slices both repos by date window and emits a structured research brief: merged PRs, new/changed ADRs, new Speckit spec slices, constitution amendments, program-goal moves, and commits grouped by type. |
| `writing-prompt.md` | The DevJournal writing prompt — voice, structure, and the non-negotiable "every claim links to a primary source" rules for a weekly post. |
| `generate_cover.mjs` | Deterministic featured-cover generator. Renders a branded 1600×900 PNG (dark-slate Elsa designer style, workflow-node motif) from a kicker + title + meta, with no external services. Requires the `@resvg/resvg-js` dev dependency. |
| `studio-screenshots.md` | Runbook for capturing **historically-accurate** Elsa Studio screenshots for Studio-heavy weeks — build the shell (and optionally the backend) from the week's commit, then capture with headless Chrome. Used for *inline* images, not the cover. |
| `capture_studio.mjs` | Reference Puppeteer driver for interactive Studio captures (Create-workflow modal, designer, Weaver conversation). Runs against the installed Chrome; not a repo dependency. |
| `intro-post-outline.md` | A ready-to-write outline for the series anchor post, *"Why Elsa 4?"*, grounded in verified repo sources. |

## Prerequisites

- Python 3.10+
- Local clones of the two source repos (read access is enough).

## Usage

Point the extractor at your local clones via env vars (or the `--repo` flag),
then pick a week or an explicit window:

```bash
export ELSA_FOUNDATION=~/Projects/Elsa/elsa-foundation
export ELSA_STUDIO=~/Projects/Elsa/elsa-foundation-studio

# Week N, numbered from the journey start (2026-05-08)
python3 tools/devjournal/devjournal_extract.py --week 8 -o /tmp/week-08.md

# Or an explicit window (start inclusive, end exclusive)
python3 tools/devjournal/devjournal_extract.py \
    --since 2026-06-26 --until 2026-07-03

# Or override repo paths inline
python3 tools/devjournal/devjournal_extract.py --week 8 \
    --repo foundation:~/src/elsa-foundation \
    --repo studio:~/src/elsa-foundation-studio
```

The script is **read-only** — it only runs `git -C <repo> log/show` and never
mutates repo state.

## The weekly loop

1. **Extract** — run the extractor for the week to get a research brief.
2. **Write** — draft the post using `writing-prompt.md` as the system prompt,
   opening the cited ADRs/specs/PRs to quote them accurately.
3. **Verify** — confirm every PR number, ADR, and spec reference against the
   repos before publishing. The brief is a pointer, not ground truth.
4. **Cover** — generate the branded featured image with
   `generate_cover.mjs` (see `writing-prompt.md` → *Featured cover image*) and
   reference it from the post's `featuredImage` frontmatter.
5. **Screenshots (Studio-heavy weeks)** — when the week ships a visible Studio
   change (a new panel, the designer, Weaver, diagnostics), add *inline*
   screenshots built from that week's commit. Follow `studio-screenshots.md`
   and caption each image with the source SHA.
6. **Publish** — add the post under `content/posts/YYYY-MM-DD-slug.md` following
   the repo's frontmatter conventions (see the root `CONTRIBUTING.md`), open a
   PR, and merge once validation passes.

## Notes

- A "week" is a 7-day window; week N covers
  `[start + 7·(N-1), start + 7·N)` from the 2026-05-08 journey start.
- The studio repo only has history from 2026-06-14; earlier weeks correctly
  report no studio activity.
- This is content/automation tooling and is MIT-licensed, consistent with the
  rest of the repository's code.
