import { describe, expect, it } from "vitest";

import { topicNames } from "../src/data/topics";
import { blogSchema } from "../src/lib/blog-schema";
import {
  assertPostIdentity,
  filterPublishedPosts,
} from "../src/lib/posts";

const validPost = {
  title: "可靠的发布流程",
  slug: "reliable-publishing",
  description: "验证在线写作需要遵守的内容边界。",
  publishedAt: "2026-07-16",
  tags: ["Architecture"],
  featured: false,
  draft: true,
};

describe("authoring content contract", () => {
  it("accepts a normal draft without visual metadata", () => {
    const result = blogSchema.parse(validPost);

    expect(result.slug).toBe("reliable-publishing");
    expect(result.visualAlt).toBe("");
  });

  it("requires visual metadata for featured posts", () => {
    const result = blogSchema.safeParse({ ...validPost, featured: true });

    expect(result.success).toBe(false);
  });

  it.each(["Bad Slug", "中文-slug", "double--dash", "trailing-"])(
    "rejects invalid slug %s",
    (slug) => {
      expect(blogSchema.safeParse({ ...validPost, slug }).success).toBe(false);
    },
  );

  it("rejects tags outside the topic catalog", () => {
    expect(
      blogSchema.safeParse({ ...validPost, tags: ["Unknown"] }).success,
    ).toBe(false);
    expect(topicNames).toContain("Architecture");
  });

  it("keeps drafts out of published collections", () => {
    const posts = [
      { id: "draft", data: { draft: true } },
      { id: "published", data: { draft: false } },
    ];

    expect(filterPublishedPosts(posts).map((post) => post.id)).toEqual([
      "published",
    ]);
  });

  it("rejects a filename and slug mismatch", () => {
    expect(() =>
      assertPostIdentity({
        id: "old-path",
        data: { slug: "new-path" },
      }),
    ).toThrow('Post filename "old-path" must match slug "new-path"');
  });
});
