#!/usr/bin/env python3
"""
Elsa 4 DevJournal — weekly commit & decision extractor.

Slices the git history of one or more repositories over a date window and
produces a structured Markdown "research brief" that a blog-writing prompt can
consume. It surfaces the things worth writing about: merged PRs, new/changed
ADRs, new/changed Speckit spec slices, constitution amendments, program-goal
roadmap moves, and feature/fix activity grouped by domain area.

Read-only: every git call uses `git -C <repo>` and never mutates repo state.

Usage examples
--------------
  # Week 1 of the project (auto-numbered from the journey start date)
  python devjournal_extract.py --week 1

  # Explicit date window
  python devjournal_extract.py --since 2026-05-08 --until 2026-05-15

  # Point at custom repo locations
  python devjournal_extract.py --week 2 \
      --repo foundation:/path/to/elsa-foundation \
      --repo studio:/path/to/elsa-foundation-studio

  # Write straight to a file
  python devjournal_extract.py --week 1 -o research/week-01.md

Notes
-----
* "Journey start" defaults to 2026-05-08 (elsa-foundation's first commit /
  the date the constitution pins as the foundation repo creation date).
* A "week" is a 7-day window: week N covers [start + 7*(N-1), start + 7*N).
* Studio only has history from 2026-06-14; weeks before that simply report
  "no activity in window" for the studio repo, which is correct.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field

# --------------------------------------------------------------------------- #
# Configuration defaults
# --------------------------------------------------------------------------- #

JOURNEY_START = dt.date(2026, 5, 8)  # elsa-foundation first commit / repo creation

# Repo locations. Override per-machine via env vars or the repeatable --repo flag,
# e.g. ELSA_FOUNDATION=~/src/elsa-foundation ELSA_STUDIO=~/src/elsa-foundation-studio
DEFAULT_REPOS = {
    "foundation": os.environ.get(
        "ELSA_FOUNDATION", "/Users/sipke/Projects/Elsa/elsa-foundation"),
    "studio": os.environ.get(
        "ELSA_STUDIO", "/Users/sipke/Projects/Elsa/elsa-foundation-studio"),
}

# Directories that carry "decisions worth narrating".
ADR_DIRS = ["docs/adr"]
SPEC_DIRS = ["specs"]
CONSTITUTION_GLOBS = [".specify/memory/"]
PROGRAM_GOAL_DIRS = ["docs/program-goals"]

# Conventional-commit-ish prefixes we bucket on.
TYPE_PREFIXES = ["feat", "fix", "refactor", "perf", "docs", "test", "chore", "spec", "build", "ci"]

# Field separator unlikely to appear in commit metadata.
SEP = "\x1f"
REC = "\x1e"


# --------------------------------------------------------------------------- #
# Git helpers (all read-only)
# --------------------------------------------------------------------------- #

def git(repo: str, *args: str) -> str:
    """Run a read-only git command in `repo` and return stdout (stripped)."""
    out = subprocess.run(
        ["git", "-C", repo, "--no-pager", *args],
        capture_output=True, text=True, check=False,
    )
    if out.returncode != 0:
        return ""
    return out.stdout.rstrip("\n")


def repo_exists(repo: str) -> bool:
    return os.path.isdir(os.path.join(repo, ".git")) or git(repo, "rev-parse", "--git-dir") != ""


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #

@dataclass
class Commit:
    sha: str
    short: str
    date: str
    author: str
    subject: str
    body: str
    is_merge: bool

    @property
    def pr_number(self) -> str | None:
        # "Merge pull request #344 from ..." or squash "... (#344)"
        m = re.search(r"#(\d+)", self.subject)
        return m.group(1) if m else None

    @property
    def type_prefix(self) -> str | None:
        m = re.match(r"^([a-z]+)(\([^)]*\))?!?:", self.subject)
        if m and m.group(1) in TYPE_PREFIXES:
            return m.group(1)
        return None


@dataclass
class RepoSlice:
    name: str
    path: str
    since: str
    until: str
    commits: list[Commit] = field(default_factory=list)
    merged_prs: list[Commit] = field(default_factory=list)
    added: dict[str, list[str]] = field(default_factory=dict)     # category -> paths
    modified: dict[str, list[str]] = field(default_factory=dict)  # category -> paths
    insertions: int = 0
    deletions: int = 0
    files_changed: int = 0
    contributors: collections.Counter = field(default_factory=collections.Counter)


# --------------------------------------------------------------------------- #
# Extraction
# --------------------------------------------------------------------------- #

def collect_commits(repo: str, since: str, until: str) -> list[Commit]:
    fmt = SEP.join(["%H", "%h", "%ad", "%an", "%s", "%b"]) + REC
    raw = git(
        repo, "log", f"--since={since} 00:00:00", f"--until={until} 00:00:00",
        "--date=short", f"--pretty=format:{fmt}",
    )
    commits: list[Commit] = []
    if not raw:
        return commits
    for rec in raw.split(REC):
        rec = rec.strip("\n")
        if not rec.strip():
            continue
        parts = rec.split(SEP)
        if len(parts) < 6:
            parts += [""] * (6 - len(parts))
        sha, short, date, author, subject, body = parts[:6]
        parents = git(repo, "rev-list", "--parents", "-n", "1", sha).split()
        is_merge = len(parents) > 2
        commits.append(Commit(sha, short, date, author, subject.strip(), body.strip(), is_merge))
    return commits


def categorize_path(path: str) -> str | None:
    if any(path.startswith(d + "/") for d in ADR_DIRS):
        return "adr"
    if any(path.startswith(d + "/") for d in SPEC_DIRS):
        return "spec"
    if any(g in path for g in CONSTITUTION_GLOBS):
        return "constitution"
    if any(path.startswith(d + "/") for d in PROGRAM_GOAL_DIRS):
        return "program-goal"
    return None


def collect_changed_paths(repo: str, since: str, until: str) -> tuple[dict, dict]:
    """Return (added, modified) maps category -> sorted unique paths."""
    added: dict[str, set] = collections.defaultdict(set)
    modified: dict[str, set] = collections.defaultdict(set)
    raw = git(
        repo, "log", f"--since={since} 00:00:00", f"--until={until} 00:00:00",
        "--diff-filter=AM", "--name-status", "--pretty=format:",
    )
    for line in raw.splitlines():
        line = line.strip()
        if not line or "\t" not in line:
            continue
        status, _, path = line.partition("\t")
        path = path.split("\t")[-1].strip()
        cat = categorize_path(path)
        if not cat:
            continue
        if status.startswith("A"):
            added[cat].add(path)
        else:
            modified[cat].add(path)
    return (
        {k: sorted(v) for k, v in added.items()},
        {k: sorted(v) for k, v in modified.items()},
    )


def collect_diffstat(repo: str, since: str, until: str) -> tuple[int, int, int]:
    raw = git(
        repo, "log", f"--since={since} 00:00:00", f"--until={until} 00:00:00",
        "--shortstat", "--pretty=format:",
    )
    files = ins = dels = 0
    for line in raw.splitlines():
        m_f = re.search(r"(\d+) files? changed", line)
        m_i = re.search(r"(\d+) insertions?", line)
        m_d = re.search(r"(\d+) deletions?", line)
        if m_f:
            files += int(m_f.group(1))
        if m_i:
            ins += int(m_i.group(1))
        if m_d:
            dels += int(m_d.group(1))
    return files, ins, dels


def first_heading(repo: str, path: str) -> str:
    """Best-effort: read the first markdown H1/title for an ADR/spec at HEAD."""
    content = git(repo, "show", f"HEAD:{path}")
    if not content:
        return ""
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def slice_dir_name(path: str) -> str:
    """specs/081-typed-argument-model/spec.md -> 081-typed-argument-model"""
    parts = path.split("/")
    return parts[1] if len(parts) > 1 else path


def build_slice(name: str, path: str, since: str, until: str) -> RepoSlice:
    rs = RepoSlice(name=name, path=path, since=since, until=until)
    rs.commits = collect_commits(path, since, until)
    rs.merged_prs = [c for c in rs.commits if c.is_merge and c.pr_number]
    # Squash-merge PRs (non-merge commits ending in (#n)) also count.
    for c in rs.commits:
        if not c.is_merge and re.search(r"\(#\d+\)\s*$", c.subject):
            rs.merged_prs.append(c)
    rs.added, rs.modified = collect_changed_paths(path, since, until)
    rs.files_changed, rs.insertions, rs.deletions = collect_diffstat(path, since, until)
    for c in rs.commits:
        if not c.is_merge:
            rs.contributors[c.author] += 1
    return rs


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #

def md_escape(text: str) -> str:
    return text.replace("|", "\\|")


def render_repo_section(rs: RepoSlice) -> list[str]:
    out: list[str] = []
    out.append(f"## Repo: `{rs.name}`")
    out.append("")
    non_merge = [c for c in rs.commits if not c.is_merge]
    if not rs.commits:
        out.append("_No activity in this window._")
        out.append("")
        return out

    out.append(f"- **Commits (non-merge):** {len(non_merge)}")
    out.append(f"- **Merged PRs:** {len({c.pr_number for c in rs.merged_prs})}")
    out.append(f"- **Files changed:** {rs.files_changed} "
               f"(+{rs.insertions} / -{rs.deletions})")
    if rs.contributors:
        contribs = ", ".join(f"{a} ({n})" for a, n in rs.contributors.most_common())
        out.append(f"- **Contributors:** {contribs}")
    out.append("")

    # --- Decisions: ADRs --------------------------------------------------- #
    new_adrs = rs.added.get("adr", [])
    chg_adrs = rs.modified.get("adr", [])
    if new_adrs or chg_adrs:
        out.append("### 🏛️ Architectural Decisions (ADRs)")
        out.append("")
        for p in new_adrs:
            title = first_heading(rs.path, p) or os.path.basename(p)
            out.append(f"- **NEW** — {md_escape(title)}  \n  `{p}`")
        for p in chg_adrs:
            title = first_heading(rs.path, p) or os.path.basename(p)
            out.append(f"- _updated_ — {md_escape(title)}  \n  `{p}`")
        out.append("")

    # --- Decisions: Spec slices ------------------------------------------- #
    new_specs = rs.added.get("spec", [])
    chg_specs = rs.modified.get("spec", [])
    new_slices = sorted({slice_dir_name(p) for p in new_specs if p.endswith("spec.md")})
    touched_slices = sorted({slice_dir_name(p) for p in (new_specs + chg_specs)})
    if touched_slices:
        out.append("### 📐 Speckit Spec Slices")
        out.append("")
        if new_slices:
            out.append("**New slices started this week:**")
            for s in new_slices:
                spec_path = f"specs/{s}/spec.md"
                title = first_heading(rs.path, spec_path)
                label = f" — {md_escape(title)}" if title else ""
                out.append(f"- `{s}`{label}")
            out.append("")
        other = [s for s in touched_slices if s not in new_slices]
        if other:
            out.append("**Slices with activity (planned/refined/implemented):**")
            out.append("- " + ", ".join(f"`{s}`" for s in other))
            out.append("")

    # --- Decisions: Constitution & program goals -------------------------- #
    const_changes = rs.added.get("constitution", []) + rs.modified.get("constitution", [])
    if const_changes:
        out.append("### 📜 Constitution / Framework Changes")
        out.append("")
        for p in sorted(set(const_changes)):
            out.append(f"- `{p}`")
        out.append("")

    pg_changes = rs.added.get("program-goal", []) + rs.modified.get("program-goal", [])
    if pg_changes:
        out.append("### 🎯 Program-Goal (Roadmap) Moves")
        out.append("")
        for p in sorted(set(pg_changes)):
            title = first_heading(rs.path, p) or os.path.basename(p)
            out.append(f"- {md_escape(title)} — `{p}`")
        out.append("")

    # --- Merged PRs -------------------------------------------------------- #
    if rs.merged_prs:
        out.append("### 🔀 Merged Pull Requests")
        out.append("")
        seen = set()
        for c in rs.merged_prs:
            pr = c.pr_number
            if pr in seen:
                continue
            seen.add(pr)
            subj = re.sub(r"^Merge pull request #\d+ from \S+\s*", "", c.subject).strip()
            subj = subj or (c.body.splitlines()[0] if c.body else c.subject)
            out.append(f"- **#{pr}** — {md_escape(subj)}")
        out.append("")

    # --- Feature / fix activity by type ----------------------------------- #
    by_type: dict[str, list[Commit]] = collections.defaultdict(list)
    untyped: list[Commit] = []
    for c in non_merge:
        t = c.type_prefix
        if t:
            by_type[t].append(c)
        else:
            untyped.append(c)
    if by_type:
        out.append("### 🧱 Conventional Commits by Type")
        out.append("")
        for t in TYPE_PREFIXES:
            if t in by_type:
                out.append(f"**{t}** ({len(by_type[t])})")
                for c in by_type[t][:12]:
                    subj = re.sub(r"^[a-z]+(\([^)]*\))?!?:\s*", "", c.subject)
                    out.append(f"- {c.short} {md_escape(subj)}")
                if len(by_type[t]) > 12:
                    out.append(f"- … and {len(by_type[t]) - 12} more")
                out.append("")

    # --- Notable freeform commits (candidate story hooks) ----------------- #
    if untyped:
        out.append("### 📝 Other Notable Commits (story hooks)")
        out.append("")
        for c in untyped[:25]:
            out.append(f"- {c.short} {md_escape(c.subject)}")
        if len(untyped) > 25:
            out.append(f"- … and {len(untyped) - 25} more")
        out.append("")

    return out


def render_editor_hints(slices: list[RepoSlice]) -> list[str]:
    """A short prioritization block to help the writer pick the week's angle."""
    out = ["## ✍️ Editor Hints — what to write about this week", ""]
    hooks: list[str] = []
    for rs in slices:
        for p in rs.added.get("adr", []):
            title = first_heading(rs.path, p) or os.path.basename(p)
            hooks.append(f"New ADR in `{rs.name}`: **{title}** — explain the decision, "
                         f"the forces behind it, and what it rules out.")
        for s in sorted({slice_dir_name(p) for p in rs.added.get("spec", []) if p.endswith('spec.md')}):
            title = first_heading(rs.path, f"specs/{s}/spec.md")
            hooks.append(f"New spec slice in `{rs.name}`: **{s}**"
                         + (f" ({title})" if title else "")
                         + " — narrate the problem it carves out.")
        if rs.added.get("constitution") or rs.modified.get("constitution"):
            hooks.append(f"Constitution moved in `{rs.name}` — a rule changed; "
                         f"that's a high-signal architecture story.")
    if not hooks:
        hooks.append("No decision-grade artifacts landed this window. Consider a "
                     "'quiet week' recap: aggregate the fixes/refactors into one "
                     "theme (e.g. hardening, test maturity) and tie back to a principle.")
    HINT_CAP = 8
    for h in hooks[:HINT_CAP]:
        out.append(f"- {h}")
    if len(hooks) > HINT_CAP:
        out.append(f"- … plus {len(hooks) - HINT_CAP} more decision-grade artifacts this "
                   f"week (see sections below). When a single theme dominates — e.g. one "
                   f"ADR series — narrate the *series* as one story, not 20 posts.")
    out.append("")
    out.append("**Suggested structure:** open with the single most important decision, "
               "then 2-3 supporting threads, then 'what this unlocks next'. Link every "
               "claim to its ADR/spec/PR. Keep the Elsa 3 → Elsa 4 journey framing.")
    out.append("")
    return out


def render(slices: list[RepoSlice], week: int | None, since: str, until: str) -> str:
    title_week = f"Week {week}" if week else f"{since} → {until}"
    lines = [
        f"# Elsa 4 DevJournal — Research Brief ({title_week})",
        "",
        f"_Window: **{since}** (inclusive) → **{until}** (exclusive). "
        f"Generated {dt.date.today().isoformat()}._",
        "",
        "> This is auto-extracted source material, not a finished post. Feed it to "
        "the blog-write prompt (DevJournal variant). Verify every PR/ADR reference "
        "against the repo before publishing.",
        "",
    ]
    lines += render_editor_hints(slices)
    lines.append("---")
    lines.append("")
    for rs in slices:
        lines += render_repo_section(rs)
        lines.append("---")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def parse_repo_args(values: list[str]) -> dict[str, str]:
    repos: dict[str, str] = {}
    for v in values:
        if ":" not in v:
            print(f"warning: ignoring --repo '{v}' (expected name:path)", file=sys.stderr)
            continue
        name, _, path = v.partition(":")
        repos[name.strip()] = os.path.expanduser(path.strip())
    return repos


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Elsa 4 DevJournal weekly extractor")
    ap.add_argument("--week", type=int, help="Week number from journey start")
    ap.add_argument("--start-date", default=JOURNEY_START.isoformat(),
                    help=f"Journey start date (default {JOURNEY_START})")
    ap.add_argument("--since", help="Window start YYYY-MM-DD (overrides --week)")
    ap.add_argument("--until", help="Window end YYYY-MM-DD exclusive (overrides --week)")
    ap.add_argument("--repo", action="append", default=[],
                    help="Repo as name:path (repeatable). Defaults to the two Elsa repos.")
    ap.add_argument("-o", "--output", help="Write to file instead of stdout")
    args = ap.parse_args(argv)

    repos = parse_repo_args(args.repo) or DEFAULT_REPOS

    # Resolve window.
    if args.since and args.until:
        since, until = args.since, args.until
        week = None
    elif args.week:
        start = dt.date.fromisoformat(args.start_date)
        s = start + dt.timedelta(days=7 * (args.week - 1))
        u = s + dt.timedelta(days=7)
        since, until, week = s.isoformat(), u.isoformat(), args.week
    else:
        # Default: the most recent complete 7-day window ending today.
        u = dt.date.today()
        s = u - dt.timedelta(days=7)
        since, until, week = s.isoformat(), u.isoformat(), None

    slices: list[RepoSlice] = []
    for name, path in repos.items():
        if not repo_exists(path):
            print(f"warning: repo '{name}' not found at {path}", file=sys.stderr)
            slices.append(RepoSlice(name=name, path=path, since=since, until=until))
            continue
        slices.append(build_slice(name, path, since, until))

    report = render(slices, week, since, until)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Wrote {args.output} ({len(report)} bytes)", file=sys.stderr)
    else:
        sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
