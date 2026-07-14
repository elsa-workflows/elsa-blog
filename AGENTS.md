# Repository Agent Instructions

This repository is a Node.js static content pipeline for the Elsa blog. Keep these instructions feature-neutral: do not add guidance for a single post, campaign, or implementation plan.

## Commands

- Run `npm ci` to install the lockfile-pinned dependencies.
- Run `npm run validate` to validate authors and post frontmatter.
- Run `npm run build` to generate the static artifacts in `dist/`.
- Use `npm run import:medium <medium-export-posts-dir>` only for an explicit Medium import task.
- Do not invent `npm test`, lint, typecheck, Make, or hook commands; they are not configured here. Check `package.json` when in doubt.

## Scope and generated files

- Edit posts, authors, assets, schemas, and scripts in their existing directories.
- Treat `dist/` as generated output; do not hand-edit or commit it.
- Keep this file independent of feature-specific plans. Automation or hooks must preserve that property rather than rewriting this file with stale task guidance.
