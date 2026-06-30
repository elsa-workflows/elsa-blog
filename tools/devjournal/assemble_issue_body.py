#!/usr/bin/env python3
"""
Assemble the GitHub issue body for a weekly DevJournal task.

Combines a fixed instruction header for the Copilot coding agent with the
auto-extracted research brief. The coding agent (running on a high-reasoning
model such as Claude Opus, selected in the repository's Copilot coding-agent
settings) writes the post and opens the PR. Prints the full body to stdout.

Usage
-----
  python assemble_issue_body.py --week 8 --since 2026-06-26 --until 2026-07-03 \
      --slug-date 2026-07-03 --brief-file brief.md
"""

from __future__ import annotations

import argparse
import sys

HEADER = """\
## Task: write the Elsa 4 DevJournal post for Week {week}

You are the technical narrator of the **"Building Elsa 4 in the open"** series.
Write this week's development-journal post and open a pull request.

**Window:** `{since}` (inclusive) -> `{until}` (exclusive)
**Target file:** `content/posts/{slug_date}-building-elsa-4-week-{week}.md`

### Steps

1. **Read the playbook.** Follow [`tools/devjournal/writing-prompt.md`](../blob/main/tools/devjournal/writing-prompt.md)
   for voice, structure, and the non-negotiable rule: *every claim links to a
   primary source* (an ADR file, a Speckit spec slice, a PR number, or a commit
   SHA in `elsa-foundation` / `elsa-foundation-studio`).
2. **Verify the material.** The research brief below is auto-extracted and is a
   *pointer, not ground truth*. Clone the public source repos and confirm every
   ADR / spec / PR / SHA you cite actually exists and says what you claim:
   ```bash
   git clone --no-tags https://github.com/elsa-workflows/elsa-foundation.git /tmp/ef
   git clone --no-tags https://github.com/elsa-workflows/elsa-foundation-studio.git /tmp/efs
   ELSA_FOUNDATION=/tmp/ef ELSA_STUDIO=/tmp/efs \\
     python3 tools/devjournal/devjournal_extract.py --since {since} --until {until}
   ```
3. **Write the post** at `content/posts/{slug_date}-building-elsa-4-week-{week}.md`
   using the repository's frontmatter conventions (see root `CONTRIBUTING.md`).
   Use **`status: "draft"`** so it is excluded from public output until a human
   publishes it. Required frontmatter:
   ```yaml
   ---
   title: "Building Elsa 4 · Week {week}: <the week's single most important theme>"
   slug: "building-elsa-4-week-{week}"
   description: "<150-160 chars>"
   publishedAt: "{slug_date}"
   status: "draft"
   authors:
     - "sipke"
   category: "Engineering"
   tags:
     - "elsa-workflows"
     - "dotnet"
     - "devjournal"
     - "software-architecture"
   seoTitle: "Building Elsa 4 · Week {week}"
   seoDescription: "<=160 chars>"
   redirectFrom: []
   ---
   ```
4. **Narrate the series, not the noise.** If one initiative dominates (e.g. an
   ADR series), tell *one* story about it. Open by locating the reader on the
   Elsa 3 -> Elsa 4 road; close with "what this unlocks next".
5. **Validate** before opening the PR:
   ```bash
   npm install && npm run validate
   ```
6. **Open a pull request** titled `Building Elsa 4 · Week {week}` targeting
   `main`, summarising the chosen theme and listing the sources you cited.

### Definition of done

- [ ] One clear headline theme (not a flat list of everything that changed).
- [ ] Every ADR / spec / PR reference verified against the source repos.
- [ ] At least one "what we rejected / what this rules out" insight.
- [ ] Frontmatter present, `status: "draft"`, `npm run validate` passes.
- [ ] PR opened against `main`.

---

## Auto-extracted research brief (pointers, not ground truth)

"""


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Assemble DevJournal issue body")
    ap.add_argument("--week", required=True)
    ap.add_argument("--since", required=True)
    ap.add_argument("--until", required=True)
    ap.add_argument("--slug-date", required=True,
                    help="Date used in the post filename/publishedAt (YYYY-MM-DD)")
    ap.add_argument("--brief-file", required=True)
    args = ap.parse_args(argv)

    with open(args.brief_file, encoding="utf-8") as f:
        brief = f.read()

    sys.stdout.write(HEADER.format(
        week=args.week, since=args.since, until=args.until,
        slug_date=args.slug_date))
    sys.stdout.write(brief)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
