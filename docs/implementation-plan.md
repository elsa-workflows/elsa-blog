# Elsa Blog Implementation Plan

## Architecture

GitHub owns the canonical blog content. Posts are Markdown files with YAML frontmatter under `content/posts`. Authors and assets live in adjacent content folders. GitHub Actions validates the content and builds static artifacts into `dist`. Lovable fetches those artifacts and renders the blog UI.

Lovable must not become the source of truth for blog content. It owns routes, layout, loading states, and SEO rendering only.

## Artifact Contract

The website should read:

```text
https://elsa-workflows.github.io/elsa-blog/index.json
https://elsa-workflows.github.io/elsa-blog/posts/{slug}.json
https://elsa-workflows.github.io/elsa-blog/rss.xml
https://elsa-workflows.github.io/elsa-blog/sitemap-blog.xml
```

Canonical public URLs remain:

```text
https://www.elsaworkflows.io/blog
https://www.elsaworkflows.io/blog/{slug}
```

## Lovable Requirements

Create a `/blog` listing page that fetches `index.json`, sorts posts by `publishedAt` descending, and renders title, description, date, category, tags, author, and featured image.

Create a `/blog/{slug}` detail page that fetches `posts/{slug}.json`, renders the `html` field, and handles loading, fetch failure, and not-found states.

Set SEO metadata from the post artifact:

- `seo.title || title`
- `seo.description || description`
- `canonicalUrl`
- `seo.openGraphImage`
- `publishedAt`
- `updatedAt`
- `authors`

Use `summary_large_image` for Twitter cards when a featured image exists.

## Publishing Workflow

1. Open an article idea issue.
2. Create a branch.
3. Add a Markdown post with `status: "draft"`.
4. Open a pull request.
5. Review content, metadata, links, and assets.
6. Set `status: "published"` and a stable `publishedAt`.
7. Merge to `main`.
8. GitHub Actions publishes the artifact site.

## Slug Changes

Avoid changing slugs after publication.

If a slug changes, add the old public path to `redirectFrom`:

```yaml
redirectFrom:
  - "/blog/old-slug"
```

The build emits `dist/redirects.json`. Lovable or the website host should use this file to apply 301 redirects.

## MVP Phases

### Phase 1: Repository And Schema

- Repository created under `elsa-workflows/elsa-blog`.
- Content folders added.
- README and CONTRIBUTING added.
- Post and author schemas documented.
- Sample draft post added.

### Phase 2: Static Artifacts

- Validation script added.
- Build script added.
- GitHub Actions added.
- GitHub Pages deployment enabled.

### Phase 3: Lovable UI

- `/blog` listing page.
- `/blog/{slug}` detail page.
- Loading, error, and empty states.
- Featured image, author, tags, and category display.

### Phase 4: RSS, Sitemap, SEO

- RSS artifact.
- Sitemap fragment.
- Dynamic SEO metadata.
- Canonical URLs.
- Redirect handling.

### Phase 5: Contributor Workflow

- Article idea issue template.
- Pull request template.
- Branch protection.
- Optional preview artifacts.
- Optional link checking.

## Implementation Checklist

- [x] Add repository scaffold.
- [x] Add content folders.
- [x] Add sample author.
- [x] Add sample draft post.
- [x] Add frontmatter validation.
- [x] Add static artifact generation.
- [x] Add RSS generation.
- [x] Add sitemap generation.
- [x] Add redirect artifact generation.
- [x] Add GitHub Actions workflow.
- [ ] Create GitHub repository.
- [ ] Push initial commit.
- [ ] Enable GitHub Pages.
- [ ] Configure branch protection.
- [ ] Build Lovable `/blog` page.
- [ ] Build Lovable `/blog/{slug}` page.
- [ ] Add redirect handling to website host or Lovable.
