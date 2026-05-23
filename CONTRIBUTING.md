# Contributing

## Article Ideas

Create an issue with the `Article idea` template before drafting substantial new content.

Good article ideas include:

- Target audience.
- Main problem or story.
- Proposed category.
- Expected outcome for readers.

## Creating A Post

Create a branch:

```bash
git checkout -b article/my-post-slug
```

Add a Markdown file:

```text
content/posts/YYYY-MM-DD-my-post-slug.md
```

Use kebab-case for slugs and filenames.

## Required Frontmatter

```yaml
---
title: "Post title"
slug: "post-title"
description: "Short description used in listings and SEO."
publishedAt: "2026-06-01"
status: "draft"
authors:
  - "author-id"
category: "Tutorial"
tags:
  - "elsa"
  - "dotnet"
---
```

## Status Values

- `draft`: validated but excluded from public output.
- `published`: included in index, RSS, sitemap, and post artifacts.
- `archived`: hidden from index and RSS, but still built as a detail artifact.

## Assets

Put post-specific assets in:

```text
content/assets/YYYY-MM-DD-post-slug/
```

Reference images from Markdown using relative paths:

```markdown
![Workflow designer](../assets/YYYY-MM-DD-post-slug/screenshot.png)
```

Featured images should include meaningful alt text:

```yaml
featuredImage: "../assets/YYYY-MM-DD-post-slug/featured.png"
featuredImageAlt: "Elsa workflow designer showing an approval workflow"
```

## Review Expectations

Reviewers should check:

- Technical accuracy.
- Clarity and tone.
- Frontmatter completeness.
- SEO title and description.
- Image quality and alt text.
- Link validity where practical.

## Publishing

Publishing is done by merging to `main`.

Before merge, set:

```yaml
status: "published"
publishedAt: "YYYY-MM-DD"
```

## Updating Published Posts

For material updates, set `updatedAt`.

Avoid changing slugs after publication. If a slug must change, add the old path to `redirectFrom`:

```yaml
redirectFrom:
  - "/blog/old-slug"
```
