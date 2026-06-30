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
| `intro-post-outline.md` | A ready-to-write outline for the series anchor post, *"Why Elsa 4?"*, grounded in verified repo sources. |
| `window.py` | Computes the extraction window for the automation: the most recent complete Monday→Monday week (or an explicit `--since/--until/--week`). Emits `key=value` lines for `$GITHUB_OUTPUT`. |
| `assemble_issue_body.py` | Wraps the research brief in a task brief for the Copilot coding agent (steps, frontmatter spec, definition of done). |
| `file_devjournal_issue.py` | Creates the weekly GitHub issue (deduped by title prefix) and assigns the Copilot coding agent via GraphQL. |

## Prerequisites

- Python 3.10+
- Local clones of the two source repos (read access is enough).

## The weekly loop

This runs **automatically every week** via
[`.github/workflows/devjournal-weekly.yml`](../../.github/workflows/devjournal-weekly.yml)
(cron: Mondays 07:00 UTC). Each run:

1. **Window** — `window.py` computes the previous complete Monday→Monday week.
2. **Extract** — clones both source repos (full history) and runs the extractor
   for that window to produce a research brief.
3. **Assemble** — `assemble_issue_body.py` wraps the brief in a task brief.
4. **File & assign** — `file_devjournal_issue.py` opens a `Building Elsa 4 ·
   Week N` issue and assigns the **Copilot coding agent**, which writes the post
   (`status: "draft"`), verifies every reference against the source repos, runs
   `npm run validate`, and opens a PR. A human reviews and publishes by flipping
   `status` to `"published"`.

You can also trigger it manually from the Actions tab (**Run workflow**) with
optional `since` / `until` / `week` overrides, a `dry_run` (extract only, no
issue), or `no_assign`.

### One-time setup

1. **Use Opus for the coding agent.** In the elsa-blog repo, go to
   **Settings → Copilot → Coding agent** and set the model to **Claude Opus**
   (or set it org-wide). The agent then runs on your existing Copilot
   entitlement — no API key required. (Requires a Copilot plan where Opus is
   available; for Business/Enterprise an admin must enable it.)
2. **Add a `DEVJOURNAL_PAT` secret** (Settings → Secrets and variables →
   Actions). A fine-grained PAT with **Issues: write** and **Contents: read** on
   this repo. The default `GITHUB_TOKEN` does not reliably trigger the Copilot
   coding agent; the workflow uses `secrets.DEVJOURNAL_PAT` when present and
   falls back to `github.token` otherwise.

### Running the extractor by hand

For a manual post or to preview a week locally, point the extractor at local
clones via env vars (or the `--repo` flag), then pick a week or window:

```bash
export ELSA_FOUNDATION=~/Projects/Elsa/elsa-foundation
export ELSA_STUDIO=~/Projects/Elsa/elsa-foundation-studio

# Week N, numbered from the journey start (2026-05-08)
python3 tools/devjournal/devjournal_extract.py --week 8 -o /tmp/week-08.md

# Or an explicit window (start inclusive, end exclusive)
python3 tools/devjournal/devjournal_extract.py --since 2026-06-26 --until 2026-07-03
```

The script is **read-only** — it only runs `git -C <repo> log/show` and never
mutates repo state.

## Notes

- A "week" is a 7-day window; week N covers
  `[start + 7·(N-1), start + 7·N)` from the 2026-05-08 journey start.
- The studio repo only has history from 2026-06-14; earlier weeks correctly
  report no studio activity.
- This is content/automation tooling and is MIT-licensed, consistent with the
  rest of the repository's code.
