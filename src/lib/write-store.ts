import { parse as parseYaml } from "yaml";

import { blogSchema, POST_SLUG_PATTERN } from "./blog-schema";

export interface PostFrontmatter {
  title: string;
  slug: string;
  description: string;
  publishedAt: string;
  tags: string[];
  featured: boolean;
  draft: boolean;
  visualAlt: string;
}

export interface PostDocument {
  frontmatter: PostFrontmatter;
  body: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  tags: string[];
  featured: boolean;
  draft: boolean;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function parsePostFile(raw: string): PostDocument {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error("Missing frontmatter block");
  }
  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  return {
    frontmatter: {
      title: String(data.title ?? ""),
      slug: String(data.slug ?? ""),
      description: String(data.description ?? ""),
      publishedAt: formatDate(data.publishedAt),
      tags,
      featured: data.featured === true,
      draft: data.draft === true,
      visualAlt: String(data.visualAlt ?? ""),
    },
    body: raw.slice(match[0].length).replace(/^\r?\n/, ""),
  };
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function serializePostFile({ frontmatter, body }: PostDocument): string {
  const tags = `[${frontmatter.tags.map(yamlString).join(", ")}]`;
  const lines = [
    "---",
    `title: ${yamlString(frontmatter.title)}`,
    `slug: ${yamlString(frontmatter.slug)}`,
    `description: ${yamlString(frontmatter.description)}`,
    `publishedAt: ${frontmatter.publishedAt}`,
    `tags: ${tags}`,
    `featured: ${frontmatter.featured}`,
    `draft: ${frontmatter.draft}`,
    `visualAlt: ${yamlString(frontmatter.visualAlt)}`,
    "---",
    "",
  ];
  const trimmedBody = body.replace(/\s+$/, "");
  return `${lines.join("\n")}${trimmedBody ? `\n${trimmedBody}\n` : ""}`;
}

export function validatePost(document: PostDocument): ValidationIssue[] {
  const result = blogSchema.safeParse(document.frontmatter);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "frontmatter",
    message: issue.message,
  }));
}

export function isValidSlug(slug: string): boolean {
  return POST_SLUG_PATTERN.test(slug);
}

export function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function summarizePosts(
  files: { name: string; raw: string }[],
): PostSummary[] {
  const summaries = files
    .filter(({ name }) => name.endsWith(".md"))
    .map(({ name, raw }) => {
      const { frontmatter } = parsePostFile(raw);
      return {
        slug: frontmatter.slug || name.replace(/\.md$/, ""),
        title: frontmatter.title,
        description: frontmatter.description,
        publishedAt: frontmatter.publishedAt,
        tags: frontmatter.tags,
        featured: frontmatter.featured,
        draft: frontmatter.draft,
      };
    });

  return summaries.sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) {
      return a.publishedAt < b.publishedAt ? 1 : -1;
    }
    return a.slug.localeCompare(b.slug);
  });
}
