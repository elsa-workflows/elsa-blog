#!/usr/bin/env python3
"""
Compute the DevJournal extraction window for a scheduled or manual run.

Week numbering matches devjournal_extract.py exactly:
  Week N covers [START + 7*(N-1), START + 7*N), where START = 2026-05-08
  (elsa-foundation's first commit). `since` is inclusive, `until` exclusive.

Default (no overrides) returns the most recently *completed* journey week as of
today. The weekly cron fires on Mondays, a few days after each Friday-aligned
week closes, so the just-finished week is always complete.

Overrides (any subset) come from --since / --until / --week.

Output is written as `key=value` lines suitable for GitHub Actions
`$GITHUB_OUTPUT`, and also echoed to stderr for logs.

Examples
--------
  python window.py                         # auto: last completed week
  python window.py --week 3                # Week 3's window
  python window.py --since 2026-06-26 --until 2026-07-03
  python window.py >> "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys

JOURNEY_START = dt.date(2026, 5, 8)  # elsa-foundation first commit


def week_window(n: int) -> tuple[dt.date, dt.date]:
    """Window for week N: [START + 7*(N-1), START + 7*N)."""
    n = max(1, n)
    since = JOURNEY_START + dt.timedelta(days=7 * (n - 1))
    until = JOURNEY_START + dt.timedelta(days=7 * n)
    return since, until


def latest_complete_week(today: dt.date) -> int:
    """Index of the most recently completed 7-day journey week as of today."""
    elapsed = (today - JOURNEY_START).days
    return max(1, elapsed // 7)


def week_index(since: dt.date) -> int:
    return max(1, (since - JOURNEY_START).days // 7 + 1)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Compute the DevJournal window")
    ap.add_argument("--since", help="Override window start YYYY-MM-DD (inclusive)")
    ap.add_argument("--until", help="Override window end YYYY-MM-DD (exclusive)")
    ap.add_argument("--week", type=int, help="Compute the window for this week N")
    ap.add_argument("--today", help="Pretend today is this date (testing)")
    args = ap.parse_args(argv)

    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()

    if args.week:
        since_d, until_d = week_window(args.week)
        week = args.week
    else:
        week = latest_complete_week(today)
        since_d, until_d = week_window(week)

    # Explicit date overrides win and re-derive the label from `since`.
    if args.since:
        since_d = dt.date.fromisoformat(args.since)
        week = week_index(since_d)
    if args.until:
        until_d = dt.date.fromisoformat(args.until)

    lines = [
        f"since={since_d.isoformat()}",
        f"until={until_d.isoformat()}",
        f"week={week}",
    ]
    print("\n".join(lines))
    print(f"[window] week {week}: {since_d} -> {until_d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
