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
  - "workflow-authoring"
---
```

## Topics and Tags

Use **one to three unique tags**, chosen from the approved topics below. Pick the
main subject first and add another topic only when the article substantially
covers it. These are reader filters, not an inventory of every technology mentioned.

| Tag | Use for |
| --- | --- |
| `architecture` | System design, boundaries, hosting, and framework decisions. |
| `devjournal` | The Building Elsa 4 development journal, including its introduction. |
| `workflow-authoring` | Building workflows: patterns, approvals, BPMN, expressions, and triggers. |
| `workflow-runtime` | Execution, scheduling, bookmarks, replay, and recovery behavior. |
| `extensibility` | Custom activities, converters, modules, plugins, and extension APIs. |
| `persistence` | Storage providers, serialization, migrations, and persisted state. |
| `security` | Authentication, authorization, secrets, sandboxing, and tenant isolation. |
| `operations` | Deployment, upgrades, diagnostics, logs, and observability. |
| `ai` | Agents, Weaver, and AI-assisted workflow development. |
| `studio` | Studio features, visual editing, and its management interface. |

Use `category` for the article format, such as Tutorial or Release, and `series`
for series membership. Keep `devjournal` as the journal's reader filter until the
website offers series filtering. Do not add product versions, near-universal
labels such as `dotnet` or `elsa-workflows`, synonyms, or one-off component names.
Those details belong in the title, description, or article.

The single source of truth is [schemas/tags.schema.json](schemas/tags.schema.json).
Both `npm run validate` and `npm run build` reject unknown tags, duplicates, empty
tag lists, and more than three tags, including in drafts and archived posts.
CI runs these checks before publication. Medium imports suggest only approved
topics from the headline; review those suggestions before publishing.

To propose a topic, change the shared schema and this table in the same pull
request. Explain the distinct reader need, why existing topics cannot cover it,
and identify at least five published posts that should use it. Retag those posts
in that pull request. Prefer renaming or merging an existing topic to growing
the list; review the affected filters and counts as part of that decision.

Run `node --test scripts/taxonomy.test.mjs` when changing the taxonomy rules.

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
