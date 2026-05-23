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

## Licensing

Code and automation in this repository are licensed under MIT.

Content under `content/` is licensed under CC BY 4.0 unless otherwise stated.
