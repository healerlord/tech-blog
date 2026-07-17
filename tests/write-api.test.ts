import { describe, expect, it } from "vitest";

import { handleWriteApi, type WriteApiIo } from "../src/lib/write-api";
import {
  parsePostFile,
  serializePostFile,
  type PostDocument,
} from "../src/lib/write-store";

function makeDocument(overrides: Partial<PostDocument["frontmatter"]> = {}): PostDocument {
  return {
    frontmatter: {
      title: "测试文章",
      slug: "test-post",
      description: "测试摘要",
      publishedAt: "2026-07-16",
      tags: ["AI"],
      featured: false,
      draft: true,
      visualAlt: "",
      ...overrides,
    },
    body: "第一段。\n",
  };
}

function makeIo(seed: Record<string, PostDocument> = {}) {
  const files = new Map<string, string>(
    Object.entries(seed).map(([slug, document]) => [
      `${slug}.md`,
      serializePostFile(document),
    ]),
  );
  const assets = new Map<string, Uint8Array>();

  const io: WriteApiIo = {
    async listPosts() {
      return Array.from(files, ([name, raw]) => ({ name, raw }));
    },
    async readPost(slug) {
      return files.get(`${slug}.md`) ?? null;
    },
    async writePost(slug, content) {
      files.set(`${slug}.md`, content);
    },
    async writeAsset(name, data) {
      assets.set(name, data);
    },
  };
  return { io, files, assets };
}

describe("write api", () => {
  it("lists posts as summaries", async () => {
    const { io } = makeIo({ "test-post": makeDocument() });

    const response = await handleWriteApi(io, "GET", "/posts", "");

    expect(response.status).toBe(200);
    const posts = response.body.posts as { slug: string; draft: boolean }[];
    expect(posts).toHaveLength(1);
    expect(posts[0]?.slug).toBe("test-post");
    expect(posts[0]?.draft).toBe(true);
  });

  it("reads a single post and 404s on unknown slugs", async () => {
    const { io } = makeIo({ "test-post": makeDocument() });

    const found = await handleWriteApi(io, "GET", "/posts/test-post", "");
    expect(found.status).toBe(200);

    const missing = await handleWriteApi(io, "GET", "/posts/nope", "");
    expect(missing.status).toBe(404);
  });

  it("saves an existing post and round-trips content", async () => {
    const { io, files } = makeIo({ "test-post": makeDocument() });
    const updated = makeDocument({ title: "更新后的标题", draft: false });

    const response = await handleWriteApi(
      io,
      "PUT",
      "/posts/test-post",
      JSON.stringify(updated),
    );

    expect(response.status).toBe(200);
    const stored = parsePostFile(files.get("test-post.md") ?? "");
    expect(stored.frontmatter.title).toBe("更新后的标题");
    expect(stored.frontmatter.draft).toBe(false);
  });

  it("rejects slug mismatches and edits to unknown posts", async () => {
    const { io } = makeIo({ "test-post": makeDocument() });

    const mismatch = await handleWriteApi(
      io,
      "PUT",
      "/posts/test-post",
      JSON.stringify(makeDocument({ slug: "other-slug" })),
    );
    expect(mismatch.status).toBe(400);

    const missing = await handleWriteApi(
      io,
      "PUT",
      "/posts/other-slug",
      JSON.stringify(makeDocument({ slug: "other-slug" })),
    );
    expect(missing.status).toBe(404);
  });

  it("rejects invalid frontmatter with field-level errors", async () => {
    const { io } = makeIo({ "test-post": makeDocument() });

    const response = await handleWriteApi(
      io,
      "PUT",
      "/posts/test-post",
      JSON.stringify(makeDocument({ tags: [] })),
    );

    expect(response.status).toBe(400);
    const errors = response.body.errors as { field: string }[];
    expect(errors.some((error) => error.field.startsWith("tags"))).toBe(true);
  });

  it("creates a new post and rejects duplicates", async () => {
    const { io, files } = makeIo();

    const created = await handleWriteApi(
      io,
      "POST",
      "/posts",
      JSON.stringify(makeDocument()),
    );
    expect(created.status).toBe(201);
    expect(files.has("test-post.md")).toBe(true);

    const duplicate = await handleWriteApi(
      io,
      "POST",
      "/posts",
      JSON.stringify(makeDocument()),
    );
    expect(duplicate.status).toBe(409);
  });

  it("stores uploaded assets and rejects unsafe names", async () => {
    const { io, assets } = makeIo();
    const dataBase64 = Buffer.from("fake-image-bytes").toString("base64");

    const created = await handleWriteApi(
      io,
      "POST",
      "/assets",
      JSON.stringify({ name: "1752600000000-cover.png", dataBase64 }),
    );
    expect(created.status).toBe(201);
    expect(created.body.url).toBe("/uploads/1752600000000-cover.png");
    expect(assets.has("1752600000000-cover.png")).toBe(true);

    for (const name of ["../evil.png", ".hidden", "UPPER.png", "a/b.png"]) {
      const rejected = await handleWriteApi(
        io,
        "POST",
        "/assets",
        JSON.stringify({ name, dataBase64 }),
      );
      expect(rejected.status).toBe(400);
    }
  });

  it("rejects malformed JSON bodies and unknown routes", async () => {
    const { io } = makeIo();

    const badJson = await handleWriteApi(io, "PUT", "/posts/test-post", "{");
    expect(badJson.status).toBe(400);

    const unknown = await handleWriteApi(io, "GET", "/nope", "");
    expect(unknown.status).toBe(404);

    const badMethod = await handleWriteApi(io, "DELETE", "/posts/x", "");
    expect(badMethod.status).toBe(405);
  });
});
