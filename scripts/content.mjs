import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import fg from "fast-glob";
import { z } from "zod";

export const rootDir = process.cwd();
export const contentDir = path.join(rootDir, "content");
export const siteUrl = "https://www.elsaworkflows.io";
export const artifactBaseUrl = "https://elsa-workflows.github.io/elsa-blog";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const dateSchema = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
);

export const authorSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  url: z.string().optional()
}).strict();

export const postSchema = z.object({
  title: z.string().min(1),
  slug: slugSchema,
  description: z.string().min(20),
  publishedAt: dateSchema,
  updatedAt: dateSchema.nullable().optional(),
  status: z.enum(["draft", "published", "archived"]),
  authors: z.array(slugSchema).min(1),
  tags: z.array(slugSchema),
  category: z.enum(["Product", "Engineering", "Tutorial", "Release", "Community", "Case Study"]),
  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),
  excerpt: z.string().optional(),
  series: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  redirectFrom: z.array(z.string()).optional(),
  related: z.array(slugSchema).optional()
}).strict();

export async function loadAuthors() {
  const files = await fg("content/authors/*.md", { cwd: rootDir });
  const authors = new Map();

  for (const file of files) {
    const parsed = await readMarkdown(file);
    const author = parseWithContext(authorSchema, parsed.data, file);
    authors.set(author.id, author);
  }

  return authors;
}

export async function loadPosts() {
  const files = await fg("content/posts/*.md", { cwd: rootDir });
  const posts = [];

  for (const file of files) {
    const parsed = await readMarkdown(file);
    const post = parseWithContext(postSchema, parsed.data, file);
    posts.push({
      ...post,
      markdown: parsed.content.trim(),
      sourcePath: file
    });
  }

  return posts.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function validateContent() {
  const authors = await loadAuthors();
  const posts = await loadPosts();
  const slugs = new Set();
  const errors = [];

  for (const post of posts) {
    if (slugs.has(post.slug)) {
      errors.push(`${post.sourcePath}: duplicate slug "${post.slug}"`);
    }

    slugs.add(post.slug);

    for (const authorId of post.authors) {
      if (!authors.has(authorId)) {
        errors.push(`${post.sourcePath}: unknown author "${authorId}"`);
      }
    }

    if (post.featuredImage) {
      const assetPath = path.resolve(path.dirname(path.join(rootDir, post.sourcePath)), post.featuredImage);
      if (!await exists(assetPath)) {
        errors.push(`${post.sourcePath}: featuredImage does not exist at ${post.featuredImage}`);
      }
    }

    if (post.status === "published" && post.publishedAt > new Date().toISOString().slice(0, 10)) {
      errors.push(`${post.sourcePath}: published posts cannot use a future publishedAt date`);
    }
  }

  return { authors, posts, errors };
}

export function publicPostUrl(slug) {
  return `${siteUrl}/blog/${slug}`;
}

export function artifactUrl(relativePath) {
  return `${artifactBaseUrl}/${relativePath.replace(/^\/+/, "")}`;
}

export function resolveAssetUrl(post, assetPath) {
  if (!assetPath) {
    return undefined;
  }

  const sourceDir = path.dirname(post.sourcePath);
  const resolved = path.relative(path.join(rootDir, "content/assets"), path.resolve(rootDir, sourceDir, assetPath));
  return artifactUrl(`assets/${resolved.split(path.sep).join("/")}`);
}

async function readMarkdown(file) {
  const raw = await fs.readFile(path.join(rootDir, file), "utf8");
  return matter(raw);
}

function parseWithContext(schema, data, file) {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const message = result.error.issues
    .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
    .join("; ");

  throw new Error(`${file}: ${message}`);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
