import fs from "node:fs/promises";
import path from "node:path";
import { Feed } from "feed";
import { marked } from "marked";
import { SitemapStream, streamToPromise } from "sitemap";
import {
  artifactUrl,
  publicPostUrl,
  resolveAssetUrl,
  rootDir,
  siteUrl,
  validateContent
} from "./content.mjs";

const distDir = path.join(rootDir, "dist");

try {
  const { authors, posts, errors } = await validateContent();

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }

    process.exit(1);
  }

  await resetDist();
  await writeNoJekyll();
  await copyAssets();

  const generatedAt = new Date().toISOString();
  const publicPosts = posts.filter((post) => post.status === "published");
  const detailPosts = posts.filter((post) => post.status === "published" || post.status === "archived");

  await writeJson("index.json", {
    generatedAt,
    posts: publicPosts.map((post) => toIndexPost(post, authors))
  });

  await fs.mkdir(path.join(distDir, "posts"), { recursive: true });

  for (const post of detailPosts) {
    const detailPost = await toDetailPost(post, authors);
    await writeJson(`posts/${post.slug}.json`, detailPost);
    await writeHtml(`posts/${post.slug}.html`, toPostHtmlDocument(detailPost));
  }

  await writeMediumImportPages(detailPosts, authors);
  await writeHtml("posts/index.html", toPostsIndexHtml(publicPosts, authors));
  await writeRss(publicPosts, authors);
  await writeSitemap(publicPosts);
  await writeRedirects(detailPosts);

  console.log(`Built ${publicPosts.length} published post(s) and ${detailPosts.length} detail artifact(s).`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function resetDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
}

async function writeNoJekyll() {
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");
}

async function copyAssets() {
  const source = path.join(rootDir, "content/assets");
  const target = path.join(distDir, "assets");

  try {
    await fs.cp(source, target, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function toIndexPost(post, authors) {
  return {
    title: post.title,
    slug: post.slug,
    description: post.description,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt ?? null,
    category: post.category,
    tags: post.tags,
    authors: post.authors.map((id) => toPublicAuthor(authors.get(id))),
    url: publicPostUrl(post.slug),
    contentUrl: artifactUrl(`posts/${post.slug}.json`),
    featuredImage: resolveAssetUrl(post, post.featuredImage),
    featuredImageAlt: post.featuredImageAlt,
    sourceName: post.sourceName,
    sourceUrl: post.sourceUrl
  };
}

async function toDetailPost(post, authors) {
  const html = normalizePostHtml(await marked.parse(post.markdown), post);

  return {
    ...toIndexPost(post, authors),
    status: post.status,
    markdown: post.markdown,
    html,
    canonicalUrl: post.canonicalUrl ?? publicPostUrl(post.slug),
    excerpt: post.excerpt,
    series: post.series,
    sourceName: post.sourceName,
    sourceUrl: post.sourceUrl,
    redirectFrom: post.redirectFrom ?? [],
    related: post.related ?? [],
    seo: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.description,
      openGraphImage: resolveAssetUrl(post, post.featuredImage)
    }
  };
}

function normalizePostHtml(html, post) {
  if (post.sourceName !== "Medium") {
    return html;
  }

  let normalized = html.trim();
  normalized = removeLeadingHeading(normalized, "h3", post.title);
  normalized = removeLeadingHeading(normalized, "h4", post.description);

  if (post.featuredImage) {
    normalized = removeFeaturedFigure(normalized, post.featuredImage);
  }

  normalized = removeEmptyElements(normalized);

  return normalized;
}

function removeLeadingHeading(html, tagName, expectedText) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);

  if (!match || match.index > 200) {
    return html;
  }

  if (normalizeText(match[1]) !== normalizeText(expectedText)) {
    return html;
  }

  return `${html.slice(0, match.index)}${html.slice(match.index + match[0].length)}`.trim();
}

function removeFeaturedFigure(html, featuredImage) {
  const pattern = /<figure[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<\/figure>/i;
  const match = html.match(pattern);

  if (!match || match.index > 800) {
    return html;
  }

  if (normalizeImageUrl(match[1]) !== normalizeImageUrl(featuredImage)) {
    return html;
  }

  return `${html.slice(0, match.index)}${html.slice(match.index + match[0].length)}`.trim();
}

function normalizeText(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(value) {
  return value.replace(/\/max\/\d+\//, "/max/*/");
}

function removeEmptyElements(html) {
  let normalized = html;
  let previous;

  do {
    previous = normalized;
    normalized = normalized.replace(/<div>\s*<\/div>/g, "");
  } while (normalized !== previous);

  return normalized.trim();
}

function toPublicAuthor(author) {
  return {
    id: author.id,
    name: author.name,
    avatar: author.avatar,
    bio: author.bio,
    url: author.url
  };
}

function toPostHtmlDocument(post) {
  const title = post.seo?.title ?? post.title;
  const description = post.seo?.description ?? post.description;
  const canonicalUrl = post.canonicalUrl;
  const image = post.seo?.openGraphImage ?? post.featuredImage;
  const authors = post.authors ?? [];
  const authorNames = authors.map((author) => author.name);
  const publishedAt = post.publishedAt;
  const modifiedAt = post.updatedAt ?? post.publishedAt;
  const jsonLd = removeUndefinedProperties({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    image,
    datePublished: publishedAt,
    dateModified: modifiedAt,
    author: authors.map((author) =>
      removeUndefinedProperties({
        "@type": "Person",
        name: author.name,
        url: author.url
      })
    ),
    mainEntityOfPage: canonicalUrl
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
${image ? `  <meta property="og:image" content="${escapeHtml(image)}">\n` : ""}  <meta property="article:published_time" content="${escapeHtml(publishedAt)}">
  <meta property="article:modified_time" content="${escapeHtml(modifiedAt)}">
${authors.map((author) => `  <meta property="article:author" content="${escapeHtml(author.name)}">`).join("\n")}
  <meta property="article:section" content="${escapeHtml(post.category)}">
${post.tags.map((tag) => `  <meta property="article:tag" content="${escapeHtml(tag)}">`).join("\n")}
${image ? "  <meta name=\"twitter:card\" content=\"summary_large_image\">\n" : ""}  <script type="application/ld+json">${escapeScriptJson(jsonLd)}</script>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
      color: #1f2933;
      background: #f7f8fa;
    }

    body {
      margin: 0;
    }

    article {
      box-sizing: border-box;
      width: min(760px, calc(100% - 32px));
      margin: 0 auto;
      padding: 56px 0 72px;
    }

    h1 {
      margin: 0 0 12px;
      line-height: 1.1;
      font-size: clamp(2rem, 6vw, 3.5rem);
      color: #111827;
    }

    .byline {
      margin: 0 0 28px;
      color: #5f6b7a;
      font-size: 0.95rem;
    }

    .featured-image {
      display: block;
      width: 100%;
      height: auto;
      margin: 0 0 28px;
      border-radius: 8px;
    }

    .lead {
      margin: 0 0 32px;
      color: #334155;
      font-size: 1.2rem;
    }

    article :where(img, video, iframe) {
      max-width: 100%;
    }

    article :where(pre, code) {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }

    article pre {
      overflow-x: auto;
      padding: 16px;
      border-radius: 8px;
      background: #111827;
      color: #f8fafc;
    }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="byline">By ${escapeHtml(formatAuthorList(authorNames))} &middot; ${escapeHtml(publishedAt)}</p>
${post.featuredImage ? `    <img class="featured-image" src="${escapeHtml(post.featuredImage)}" alt="${escapeHtml(post.featuredImageAlt ?? post.title)}">\n` : ""}    <p class="lead">${escapeHtml(post.description)}</p>
${post.html}
  </article>
</body>
</html>
`;
}

function toPostsIndexHtml(posts, authors) {
  const listItems = posts
    .map((post) => {
      const postAuthors = post.authors.map((id) => authors.get(id).name);
      return `      <li>
        <a href="./${escapeHtml(post.slug)}.html">${escapeHtml(post.title)}</a>
        <span>${escapeHtml(formatAuthorList(postAuthors))} &middot; ${escapeHtml(post.publishedAt)}</span>
      </li>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Elsa Workflows Blog Posts</title>
  <meta name="description" content="Prerendered Elsa Workflows blog posts for importing and debugging.">
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
      color: #1f2933;
      background: #f7f8fa;
    }

    body {
      margin: 0;
    }

    main {
      box-sizing: border-box;
      width: min(880px, calc(100% - 32px));
      margin: 0 auto;
      padding: 56px 0 72px;
    }

    h1 {
      margin: 0 0 24px;
      color: #111827;
    }

    ul {
      display: grid;
      gap: 16px;
      padding: 0;
      list-style: none;
    }

    li {
      display: grid;
      gap: 4px;
      padding: 16px 0;
      border-bottom: 1px solid #d8dee8;
    }

    a {
      color: #0f5f8f;
      font-size: 1.1rem;
      font-weight: 700;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }

    span {
      color: #5f6b7a;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>Elsa Workflows Blog Posts</h1>
    <ul>
${listItems}
    </ul>
  </main>
</body>
</html>
`;
}

async function writeMediumImportPages(posts, authors) {
  await fs.mkdir(path.join(distDir, "medium-import"), { recursive: true });

  for (const post of posts) {
    const detailPost = await toDetailPost(post, authors);
    await writeHtml(`medium-import/${post.slug}.html`, toMediumImportHtmlDocument(detailPost));
  }
}

function toMediumImportHtmlDocument(post) {
  const image = post.featuredImage;
  const body = removeLeadingHeading(post.html, "h1", post.title);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(post.title)}</title>
  <meta name="description" content="${escapeHtml(post.description)}">
  <link rel="canonical" href="${escapeHtml(post.url)}">
${image ? `  <meta property="og:image" content="${escapeHtml(image)}">\n` : ""}</head>
<body>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
${image ? `    <p><img src="${escapeHtml(image)}" alt="${escapeHtml(post.featuredImageAlt ?? post.title)}"></p>\n` : ""}${body}
    <hr>
    <p>Originally published at <a href="${escapeHtml(post.url)}">${escapeHtml(post.url)}</a>.</p>
  </article>
</body>
</html>
`;
}

function formatAuthorList(names) {
  return names.join(", ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function removeUndefinedProperties(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedProperties);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedProperties(entryValue)])
  );
}

async function writeRss(posts, authors) {
  const feed = new Feed({
    title: "Elsa Workflows Blog",
    description: "Articles, tutorials, release notes, and engineering updates from Elsa Workflows.",
    id: `${siteUrl}/blog`,
    link: `${siteUrl}/blog`,
    language: "en",
    copyright: `Copyright ${new Date().getFullYear()} Elsa Workflows`,
    feedLinks: {
      rss: artifactUrl("rss.xml")
    }
  });

  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: publicPostUrl(post.slug),
      link: publicPostUrl(post.slug),
      description: post.description,
      date: new Date(post.updatedAt ?? post.publishedAt),
      author: post.authors.map((id) => {
        const author = authors.get(id);
        return {
          name: author.name,
          link: author.url
        };
      })
    });
  }

  await fs.writeFile(path.join(distDir, "rss.xml"), feed.rss2(), "utf8");
}

async function writeSitemap(posts) {
  const stream = new SitemapStream({ hostname: siteUrl });

  stream.write({
    url: "/blog",
    lastmod: new Date().toISOString().slice(0, 10)
  });

  for (const post of posts) {
    stream.write({
      url: `/blog/${post.slug}`,
      lastmod: post.updatedAt ?? post.publishedAt
    });
  }

  stream.end();

  const xml = await streamToPromise(stream);
  await fs.writeFile(path.join(distDir, "sitemap-blog.xml"), xml.toString(), "utf8");
}

async function writeRedirects(posts) {
  const redirects = posts.flatMap((post) =>
    (post.redirectFrom ?? []).map((from) => ({
      from,
      to: `/blog/${post.slug}`,
      status: 301
    }))
  );

  await writeJson("redirects.json", redirects);
}

async function writeJson(relativePath, value) {
  const target = path.join(distDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeHtml(relativePath, value) {
  const target = path.join(distDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value, "utf8");
}
