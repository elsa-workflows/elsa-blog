#!/usr/bin/env python3
"""
File a weekly DevJournal issue and assign it to the GitHub Copilot coding agent.

Standard-library only (urllib). Designed to run inside GitHub Actions, but works
locally too. Reads the GitHub token from $GH_TOKEN or $GITHUB_TOKEN.

Behaviour
---------
1. Dedupe: if an open issue whose title starts with the same "Building Elsa 4 ·
   Week N" prefix already exists, do nothing (idempotent weekly runs).
2. Create the issue with the assembled body (instructions + research brief).
3. Assign the Copilot coding agent (`copilot-swe-agent`) via the GraphQL
   `replaceActorsForAssignable` mutation, looked up through `suggestedActors`.

Exit codes
----------
  0  issue created (and assignment attempted), or skipped as duplicate
  1  hard failure (no token, repo not found, issue creation failed)

The Copilot assignment is best-effort: if the agent is not assignable (feature
disabled) the issue is still created and the script warns rather than failing.

Note on tokens: assignment performed with the default Actions GITHUB_TOKEN may
not reliably trigger the Copilot agent. Provide a PAT (secret DEVJOURNAL_PAT)
for dependable triggering. See tools/devjournal/README.md.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"
GRAPHQL = "https://api.github.com/graphql"
COPILOT_LOGIN = "copilot-swe-agent"


def token() -> str:
    tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not tok:
        print("error: no GH_TOKEN / GITHUB_TOKEN in environment", file=sys.stderr)
        raise SystemExit(1)
    return tok


def _request(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token()}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "elsa-devjournal-bot")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        print(f"error: {method} {url} -> {e.code}\n{detail}", file=sys.stderr)
        raise


def graphql(query: str, variables: dict) -> dict:
    out = _request(GRAPHQL, "POST", {"query": query, "variables": variables})
    if "errors" in out:
        print(f"graphql errors: {json.dumps(out['errors'])}", file=sys.stderr)
    return out


# --------------------------------------------------------------------------- #

def find_open_duplicate(owner: str, repo: str, title_prefix: str) -> str | None:
    q = f'repo:{owner}/{repo} is:issue is:open in:title "{title_prefix}"'
    url = f"{API}/search/issues?q={urllib.parse.quote(q)}"
    out = _request(url)
    for item in out.get("items", []):
        if item.get("title", "").startswith(title_prefix):
            return item.get("html_url")
    return None


def create_issue(owner: str, repo: str, title: str, body: str,
                 labels: list[str]) -> dict:
    url = f"{API}/repos/{owner}/{repo}/issues"
    payload: dict = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    return _request(url, "POST", payload)


def copilot_actor_id(owner: str, repo: str) -> str | None:
    query = """
    query($owner:String!, $repo:String!) {
      repository(owner:$owner, name:$repo) {
        suggestedActors(capabilities:[CAN_BE_ASSIGNED], first:50) {
          nodes { login __typename ... on Bot { id } ... on User { id } }
        }
      }
    }"""
    out = graphql(query, {"owner": owner, "repo": repo})
    nodes = (out.get("data", {}).get("repository", {})
             .get("suggestedActors", {}).get("nodes", []))
    for n in nodes:
        if n.get("login") == COPILOT_LOGIN:
            return n.get("id")
    return None


def assign_actor(issue_node_id: str, actor_id: str) -> bool:
    mutation = """
    mutation($assignableId:ID!, $actorIds:[ID!]!) {
      replaceActorsForAssignable(input:{assignableId:$assignableId, actorIds:$actorIds}) {
        assignable {
          ... on Issue { number assignees(first:10){ nodes{ login } } }
        }
      }
    }"""
    out = graphql(mutation, {"assignableId": issue_node_id, "actorIds": [actor_id]})
    return "errors" not in out and out.get("data") is not None


# --------------------------------------------------------------------------- #

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="File + assign a DevJournal issue")
    ap.add_argument("--repo", required=True, help="owner/name")
    ap.add_argument("--title", required=True)
    ap.add_argument("--title-prefix", required=True,
                    help="Stable prefix used for dedupe, e.g. 'Building Elsa 4 · Week 8'")
    ap.add_argument("--body-file", required=True)
    ap.add_argument("--label", action="append", default=[], help="Repeatable")
    ap.add_argument("--no-assign", action="store_true",
                    help="Create the issue but do not assign Copilot")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print what would happen; create nothing")
    args = ap.parse_args(argv)

    owner, _, repo = args.repo.partition("/")
    with open(args.body_file, encoding="utf-8") as f:
        body = f.read()

    # GitHub issue body limit is 65536 chars; keep margin for safety.
    MAX = 60000
    if len(body) > MAX:
        body = body[:MAX] + ("\n\n> _Research brief truncated for the issue body. "
                             "Re-run `tools/devjournal/devjournal_extract.py` to "
                             "regenerate the full brief._\n")

    if args.dry_run:
        print(f"[dry-run] repo={args.repo}")
        print(f"[dry-run] title={args.title}")
        print(f"[dry-run] labels={args.label}")
        print(f"[dry-run] assign-copilot={not args.no_assign}")
        print(f"[dry-run] body bytes={len(body)}")
        actor = "(skipped in dry-run)"
        print(f"[dry-run] copilot actor lookup: {actor}")
        return 0

    dup = find_open_duplicate(owner, repo, args.title_prefix)
    if dup:
        print(f"Duplicate open issue exists, skipping: {dup}")
        return 0

    issue = create_issue(owner, repo, args.title, body, args.label)
    number = issue.get("number")
    url = issue.get("html_url")
    node_id = issue.get("node_id")
    print(f"Created issue #{number}: {url}")

    if args.no_assign:
        return 0

    actor_id = copilot_actor_id(owner, repo)
    if not actor_id:
        print("warning: Copilot coding agent is not assignable in this repo; "
              "issue created but left unassigned.", file=sys.stderr)
        return 0

    if assign_actor(node_id, actor_id):
        print(f"Assigned {COPILOT_LOGIN} to issue #{number}.")
    else:
        print("warning: assignment mutation reported errors; the issue exists "
              "but may be unassigned. Assign Copilot manually if needed.",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
