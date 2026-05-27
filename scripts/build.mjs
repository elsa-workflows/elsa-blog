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
    await writeJson(`posts/${post.slug}.json`, await toDetailPost(post, authors));
  }

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
