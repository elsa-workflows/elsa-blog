# Elsa Blog

Git-backed blog content for [www.elsaworkflows.io](https://www.elsaworkflows.io).

GitHub is the canonical source of truth for all blog content. Posts are authored as Markdown files with YAML frontmatter, then built into portable static artifacts that the website can fetch and render.

Lovable currently renders the public blog UI, but it does not own blog content. The content model is intentionally host-agnostic so the blog can later move to Astro, Next.js, Orchard Core, an Elsa-powered CMS, or another renderer.

## Repository Layout

```text
content/
  authors/       Author profiles referenced by posts.
  posts/         Markdown posts with frontmatter.
  assets/        Post-specific images and other media.
schemas/         JSON schemas for content validation.
scripts/         Validation and build scripts.
dist/            Generated artifacts published by GitHub Actions.
```

## Local Development

```bash
npm install
npm run validate
npm run build
```

Generated files are written to `dist/`.

## Public Artifacts

After changes are merged into `main`, GitHub Actions publishes the generated artifacts through GitHub Pages:

```text
https://elsa-workflows.github.io/elsa-blog/index.json
https://elsa-workflows.github.io/elsa-blog/posts/{slug}.json
https://elsa-workflows.github.io/elsa-blog/rss.xml
https://elsa-workflows.github.io/elsa-blog/sitemap-blog.xml
```

Canonical blog URLs remain on the website:

```text
https://www.elsaworkflows.io/blog/{slug}
```

## Publishing Model

1. Create or update a Markdown file under `content/posts`.
2. Add post assets under `content/assets/YYYY-MM-DD-post-slug`.
3. Open a pull request.
4. Wait for validation and build checks.
5. Merge to `main` to publish.

Draft posts use `status: "draft"` and are excluded from public artifacts.

## Publishing a post

Merging a post in `content/posts/YYYY-MM-DD-slug.md` to `main` runs the `Build blog` workflow (validate, build, deploy to GitHub Pages), which updates `https://elsa-workflows.github.io/elsa-blog/index.json` and `posts/<slug>.json` that `www.elsaworkflows.io/blog` (`elsa-workflows/elsa-hub`, published via Lovable) reads client-side, so the post shows to readers right away. Elsa-hub only writes the crawler-facing prerendered `/blog/<slug>.html` and the sitemap entry at its own build, and Lovable only rebuilds on a new elsa-hub commit, so bump root `blog-sync.json` (`latestSlug`, `blogCommit` as the full elsa-blog `main` SHA, `syncedAt` as `YYYY-MM-DD`) in a one-line PR to trigger that rebuild.

1. Merge the post PR to `main`.
2. Wait for the `Build blog` run on that commit to go green (validate, build, deploy), for example `gh run list -R elsa-workflows/elsa-blog --branch main`.
3. Check the post is in `index.json` and `posts/<slug>.json` returns 200.
4. Open a PR on `elsa-workflows/elsa-hub` that updates `blog-sync.json` (`latestSlug`, `blogCommit` = the merge commit SHA, `syncedAt`) and merge it.
5. Publish elsa-hub in Lovable. A publish with no new elsa-hub commit does not rebuild, so step 4 is required.
6. Verify: `https://www.elsaworkflows.io/blog/<slug>` loads; `https://www.elsaworkflows.io/blog/<slug>.html` returns 200 and contains `data-prerendered`, a single `<title>` and canonical, and og tags (curl with a Googlebot user agent); `https://www.elsaworkflows.io/sitemap.xml` lists `/blog/<slug>`.

## Licensing

Code and automation in this repository are licensed under MIT.

Content under `content/` is licensed under CC BY 4.0 unless otherwise stated.
