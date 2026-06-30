#!/usr/bin/env python3
"""
Compute the DevJournal extraction window for a scheduled run.

By default it returns the most recently completed Monday-to-Monday week:
  until = Monday of the current week (exclusive end)
  since = the Monday seven days before that (inclusive start)
  week  = 1-based index of that window from the 2026-05-08 journey start.

Overrides (any subset) come from --since / --until / --week.

Output is written as `key=value` lines suitable for GitHub Actions
`$GITHUB_OUTPUT`, and also echoed to stderr for logs.

Examples
--------
  python window.py                         # auto: last complete week
  python window.py --since 2026-06-26 --until 2026-07-03
  python window.py >> "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys

JOURNEY_START = dt.date(2026, 5, 8)


def week_index(since: dt.date) -> int:
    return max(1, (since - JOURNEY_START).days // 7 + 1)


def auto_window(today: dt.date) -> tuple[dt.date, dt.date]:
    # Monday of the current week (weekday(): Mon=0).
    monday_this_week = today - dt.timedelta(days=today.weekday())
    until = monday_this_week
    since = until - dt.timedelta(days=7)
    return since, until


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Compute the DevJournal window")
    ap.add_argument("--since", help="Override window start YYYY-MM-DD (inclusive)")
    ap.add_argument("--until", help="Override window end YYYY-MM-DD (exclusive)")
    ap.add_argument("--week", type=int, help="Override the week label")
    ap.add_argument("--today", help="Pretend today is this date (testing)")
    args = ap.parse_args(argv)

    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()
    since_d, until_d = auto_window(today)

    if args.since:
        since_d = dt.date.fromisoformat(args.since)
    if args.until:
        until_d = dt.date.fromisoformat(args.until)
    week = args.week if args.week else week_index(since_d)

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
