import fs from "node:fs";
import path from "node:path";
import { rootDir } from "./content.mjs";

const exportPostsDir = process.argv[2];

if (!exportPostsDir) {
  console.error("Usage: node scripts/import-medium-export.mjs <medium-export-posts-dir>");
  process.exit(1);
}

const postsDir = path.join(rootDir, "content/posts");
const existingMediumIds = new Set(
  fs.readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .flatMap((file) => {
      const content = fs.readFileSync(path.join(postsDir, file), "utf8");
      return [...content.matchAll(/(?:medium\.com\/(?:@sipkeschoorstra\/[^"\n]+-|p\/)|sipkeschoorstra\.medium\.com\/[^"\n]+-)([a-f0-9]{12})/g)].map((match) => match[1]);
    })
);

let imported = 0;
let skipped = 0;

for (const file of fs.readdirSync(exportPostsDir).filter((name) => name.endsWith(".html")).sort()) {
  const fullPath = path.join(exportPostsDir, file);
  const html = fs.readFileSync(fullPath, "utf8");
  const post = parseExportedPost(file, html);

  if (!post.shouldImport || existingMediumIds.has(post.mediumId)) {
    skipped++;
    continue;
  }

  const target = path.join(postsDir, `${post.publishedAt}-${post.slug}.md`);
  fs.writeFileSync(target, renderPost(post), "utf8");
  imported++;
  console.log(`Imported ${path.basename(target)}`);
}

console.log(`Imported ${imported} post(s), skipped ${skipped}.`);

function parseExportedPost(file, html) {
  const title = decodeHtml(matchText(html, /<title>([\s\S]*?)<\/title>/));
  const subtitle = decodeHtml(matchText(html, /<section data-field="subtitle" class="p-summary">\s*([\s\S]*?)\s*<\/section>/));
  const body = matchText(html, /<section data-field="body" class="e-content">\s*([\s\S]*?)\s*<\/section>\s*<footer>/);
  const bodyText = decodeHtml(stripHtml(body));
  const canonicalUrl = matchText(html, /<a href="([^"]+)" class="p-canonical">/);
  const publishedAt = matchText(html, /<time class="dt-published" datetime="([^"]+)"/).slice(0, 10);
  const mediumId = matchText(file, /-([a-f0-9]{12})\.html$/) || matchText(canonicalUrl, /-([a-f0-9]{12})$/);
  const featuredImage = matchText(body, /<img[^>]+src="([^"]+)"/);
  const isDraft = file.startsWith("draft_");
  const isReply = bodyText.length < 1000;
  const description = descriptionFor(subtitle, bodyText, title);

  return {
    title,
    slug: slugify(title),
    description,
    publishedAt,
    status: isDraft ? "draft" : "published",
    category: categoryFor(title),
    tags: tagsFor(title, bodyText),
    featuredImage,
    featuredImageAlt: title,
    sourceName: "Medium",
    sourceUrl: canonicalUrl || `https://medium.com/p/${mediumId}`,
    mediumId,
    body: cleanBody(body),
    shouldImport: !isDraft && !isReply && Boolean(publishedAt) && Boolean(mediumId)
  };
}

function renderPost(post) {
  const lines = [
    "---",
    `title: ${yamlString(post.title)}`,
    `slug: ${yamlString(post.slug)}`,
    `description: ${yamlString(post.description)}`,
    `publishedAt: ${yamlString(post.publishedAt)}`,
    "updatedAt: null",
    `status: ${yamlString(post.status)}`,
    "authors:",
    "  - \"sipke\"",
    `category: ${yamlString(post.category)}`,
    "tags:",
    ...post.tags.map((tag) => `  - ${yamlString(tag)}`),
    post.featuredImage ? `featuredImage: ${yamlString(post.featuredImage)}` : undefined,
    post.featuredImage ? `featuredImageAlt: ${yamlString(post.featuredImageAlt)}` : undefined,
    `sourceName: ${yamlString(post.sourceName)}`,
    `sourceUrl: ${yamlString(post.sourceUrl)}`,
    `seoTitle: ${yamlString(post.title)}`,
    `seoDescription: ${yamlString(post.description)}`,
    "redirectFrom: []",
    "---",
    "",
    post.body,
    ""
  ];

  return `${lines.filter((line) => line !== undefined).join("\n")}`;
}

function categoryFor(title) {
  const lower = title.toLowerCase();

  if (lower.includes("elsa 3.0") || lower.includes("elsa 3.1") || lower.includes("what's new") || lower.includes("what’s new")) {
    return "Release";
  }

  if (lower.includes("part ") || lower.includes("scheduled") || lower.includes("workflow driven") || lower.includes("orchestration")) {
    return "Tutorial";
  }

  return "Engineering";
}

function tagsFor(title, bodyText) {
  const source = `${title} ${bodyText}`.toLowerCase();
  const tags = new Set();

  if (source.includes("elsa")) tags.add("elsa-workflows");
  if (source.includes(".net") || source.includes("asp.net") || source.includes("dotnet")) tags.add("dotnet");
  if (source.includes("orchard")) tags.add("orchard-core");
  if (source.includes("graphql")) tags.add("graphql");
  if (source.includes("openid") || source.includes("open id")) tags.add("openid-connect");
  if (source.includes("lucene")) tags.add("lucene");
  if (source.includes("docker")) tags.add("docker");
  if (source.includes("raspberry")) tags.add("raspberry-pi");
  if (source.includes("nvm")) tags.add("nodejs");
  if (source.includes("workflow")) tags.add("workflow");
  if (source.includes("multitenant") || source.includes("multi-tenant")) tags.add("multitenancy");

  return [...tags].length ? [...tags] : ["engineering"];
}

function cleanBody(body) {
  return body
    .replace(/<div class="section-divider"><hr class="section-divider"><\/div>/g, "")
    .replace(/\sdata-href="[^"]*"/g, "")
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/\sname="[^"]*"/g, "")
    .replace(/\sid="[^"]*"/g, "")
    .replace(/<li><br><\/li>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function descriptionFor(subtitle, bodyText, title) {
  const source = subtitle || bodyText || title;
  const trimmed = source.replace(/\s+/g, " ").trim();

  if (trimmed.length <= 180) {
    return trimmed.length >= 20 ? trimmed : title;
  }

  return `${trimmed.slice(0, 180).replace(/\s+\S*$/, "")}...`;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\.net/gi, " dotnet ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/ /g, " ")
    .trim();
}

function matchText(value, regex) {
  return value.match(regex)?.[1]?.trim() ?? "";
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}
