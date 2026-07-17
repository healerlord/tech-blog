import { describe, expect, it } from "vitest";

import {
  parsePostFile,
  serializePostFile,
  suggestSlug,
  summarizePosts,
  validatePost,
} from "../src/lib/write-store";

const SAMPLE = `---
title: "Agent 系统真正难的，不是调用模型"
slug: "agent-systems"
description: "从一次线上超时开始。"
publishedAt: 2026-07-12
tags: ["Agent", "Architecture"]
featured: true
draft: false
visualAlt: "追踪图。"
---

正文第一段。

## 小节

正文第二段。
`;

describe("write store", () => {
  it("parses frontmatter and body from an article file", () => {
    const { frontmatter, body } = parsePostFile(SAMPLE);

    expect(frontmatter.title).toBe("Agent 系统真正难的，不是调用模型");
    expect(frontmatter.slug).toBe("agent-systems");
    expect(frontmatter.publishedAt).toBe("2026-07-12");
    expect(frontmatter.tags).toEqual(["Agent", "Architecture"]);
    expect(frontmatter.featured).toBe(true);
    expect(frontmatter.draft).toBe(false);
    expect(body).toBe("正文第一段。\n\n## 小节\n\n正文第二段。\n");
  });

  it("round-trips an article through parse and serialize", () => {
    const document = parsePostFile(SAMPLE);
    const serialized = serializePostFile(document);

    expect(serialized).toBe(SAMPLE);
    expect(parsePostFile(serialized)).toEqual(document);
  });

  it("rejects a file without a frontmatter block", () => {
    expect(() => parsePostFile("正文而已")).toThrow();
  });

  it("validates schema rules from the shared blog schema", () => {
    const document = parsePostFile(SAMPLE);

    expect(validatePost(document)).toEqual([]);

    const badSlug = structuredClone(document);
    badSlug.frontmatter.slug = "Bad Slug";
    expect(validatePost(badSlug).map((issue) => issue.field)).toContain(
      "slug",
    );

    const unknownTag = structuredClone(document);
    unknownTag.frontmatter.tags = ["NotATopic"];
    expect(validatePost(unknownTag).length).toBeGreaterThan(0);

    const emptyTags = structuredClone(document);
    emptyTags.frontmatter.tags = [];
    expect(validatePost(emptyTags).length).toBeGreaterThan(0);

    const featuredNoAlt = structuredClone(document);
    featuredNoAlt.frontmatter.visualAlt = " ";
    expect(validatePost(featuredNoAlt).map((issue) => issue.field)).toContain(
      "visualAlt",
    );
  });

  it("summarizes and sorts posts newest first", () => {
    const older = SAMPLE.replace("2026-07-12", "2026-07-01").replace(
      '"agent-systems"',
      '"older-post"',
    );
    const summaries = summarizePosts([
      { name: "older-post.md", raw: older },
      { name: "agent-systems.md", raw: SAMPLE },
      { name: "notes.txt", raw: "ignored" },
    ]);

    expect(summaries.map((summary) => summary.slug)).toEqual([
      "agent-systems",
      "older-post",
    ]);
    expect(summaries[0]?.draft).toBe(false);
  });

  it("suggests slugs from ASCII title fragments", () => {
    expect(suggestSlug("Agent Runtime 的三个边界")).toBe("agent-runtime");
    expect(suggestSlug("纯中文标题")).toBe("");
  });
});
