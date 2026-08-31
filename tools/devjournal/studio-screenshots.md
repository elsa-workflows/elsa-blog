# DevJournal · Studio screenshots (historically accurate)

For Studio-heavy weeks (a new panel, the designer, Weaver, Extension Builder,
diagnostics), a real screenshot beats a branded cover as an *inline* image. The
non-negotiable rule mirrors the rest of the DevJournal: **every screenshot must
be built from the commit that was HEAD at the end of that week**, never from
current `main`. A Week 6 post must not show a Week 13 UI.

These are **inline** images (`![alt](../assets/<stem>/name.png)`), not the
`featuredImage` — the branded cover from `generate_cover.mjs` stays the cover.

## 0. Pick the week's commits

```bash
# Studio commit at the end of the week window (<= the post's `until` date)
git -C /tmp/src-efs log -1 --format='%h %ci %s' --before='<until>T23:59:59'
# Backend commit, same boundary (only needed for data-backed views)
git -C /tmp/src-ef  log -1 --format='%h %ci %s' --before='<until>T23:59:59'
```

Record the short SHAs; they go in every caption for provenance, e.g.
``(`elsa-foundation-studio@aca0542`)``.

## 1. Build + run the Studio shell (client-side views work with no backend)

Isolate each historical build in a throwaway git worktree so the source
checkouts stay clean:

```bash
git -C /tmp/src-efs worktree add -f /tmp/efs-<week> <studio-sha>
cd /tmp/efs-<week>

# pnpm 11 blocks esbuild's postinstall and fails the pre-run deps check.
# Opt in explicitly (throwaway worktree, never committed):
cat >> pnpm-workspace.yaml <<'YAML'
verifyDepsBeforeRun: false
allowBuilds:
  esbuild: true
YAML

pnpm install
pnpm -r build
dotnet build src/Elsa.Studio.Web/Elsa.Studio.Web.csproj

# Run. Use --no-launch-profile so ASPNETCORE_URLS is respected.
dotnet run --no-build --no-launch-profile --urls http://localhost:5089 \
  --project src/Elsa.Studio.Web/Elsa.Studio.Web.csproj
```

The shell, navigation, dashboard SDK widgets, and empty-state panels all render
without a backend. Data views show "Failed to fetch" until step 2.

## 2. (Optional) Run the backend for populated data views

Needed only for the workflow designer with real definitions, instances, or a
live Weaver conversation. The backend is SQLite-backed (zero DB setup), has no
auth gate, and its CORS already allows `http://localhost:5089`.

```bash
git -C /tmp/src-ef worktree add -f /tmp/ef-<week> <backend-sha>
cd /tmp/ef-<week>
dotnet build src/Apps/Elsa.Server/Elsa.Server.csproj

# Run on http to avoid dev-cert friction with headless Chrome.
dotnet run --no-build --no-launch-profile --urls http://localhost:5095 \
  --project src/Apps/Elsa.Server/Elsa.Server.csproj
```

Then point Studio at it by launching the shell with
`Studio__BackendBaseUrl=http://localhost:5095`. The dashboard's **Backend API**
card should flip to **Connected**.

### Weaver (GitHub Copilot agent provider)

The `GitHubCopilotAgent` shell feature is already enabled in the server's
`shells.json`; it only needs a token. **Pass it as an environment variable —
never write it to a file or commit it, and revoke it afterwards:**

```bash
COPILOT_GITHUB_TOKEN=<token> dotnet run --no-build --no-launch-profile \
  --urls http://localhost:5095 --project src/Apps/Elsa.Server/Elsa.Server.csproj
```

The Weaver panel's agent dropdown then offers `github-copilot` alongside the
`deterministic-workflow-authoring` stub.

## 3. Capture

Static routes (shell, dashboard, empty panels) — just the system Chrome:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1600,900 --virtual-time-budget=9000 \
  --ignore-certificate-errors \
  --screenshot=out.png "http://localhost:5089/"
```

Interactive flows (open the Create-workflow modal, drive the designer, send a
Weaver prompt) need a scripted driver. `capture_studio.mjs` in this folder is a
reference Puppeteer driver that runs against the **already-installed** Chrome
(`npm i puppeteer-core`, no browser download). It is intentionally *not* a repo
dependency — run it from a scratch dir.

## 4. Wire into the post + clean up

1. Copy PNGs into `content/assets/<post-stem>/` (1600×900 works well inline).
2. Add `![descriptive alt](../assets/<stem>/name.png)` plus an *italic caption
   that names the commit SHA* so the image is as verifiable as the prose.
3. `npm run validate` (inline images aren't schema-validated, but keep the
   build green).
4. Tear down: stop the `dotnet` processes, then
   `git -C /tmp/src-efs worktree remove --force /tmp/efs-<week>` (and the
   backend worktree). Revoke any token used for Weaver.

## Honesty rules

- Only claim what the screenshot shows. A backend-less panel showing an empty
  state is fine to show — say so; don't imply data that isn't there.
- Keep the SHA in the caption. If a feature wasn't on the shell at that commit,
  it doesn't belong in that week's post.
