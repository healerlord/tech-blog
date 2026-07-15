import { describe, expect, it } from "vitest";

import {
  calculateReadingMinutes,
  selectHomepagePosts,
  sortPostsNewestFirst,
} from "../src/lib/posts";

describe("post helpers", () => {
  it("sorts posts newest first without mutating the input", () => {
    const posts = [
      { data: { publishedAt: new Date("2026-01-01") } },
      { data: { publishedAt: new Date("2026-07-01") } },
    ];

    const sorted = sortPostsNewestFirst(posts);

    expect(sorted[0].data.publishedAt.toISOString()).toContain("2026-07-01");
    expect(posts[0].data.publishedAt.toISOString()).toContain("2026-01-01");
  });

  it("returns at least one reading minute", () => {
    expect(calculateReadingMinutes("短文")).toBe(1);
  });

  it("counts Chinese and Latin technical prose", () => {
    const chinese = "系统设计".repeat(400);
    const latin = Array.from({ length: 220 }, () => "architecture").join(" ");

    expect(calculateReadingMinutes(chinese)).toBe(4);
    expect(calculateReadingMinutes(latin)).toBe(1);
  });

  it("selects one featured post and excludes it from recent posts", () => {
    const posts = [
      {
        id: "featured",
        data: { featured: true, publishedAt: new Date("2026-07-10") },
      },
      {
        id: "recent",
        data: { featured: false, publishedAt: new Date("2026-07-12") },
      },
    ];

    const result = selectHomepagePosts(posts, 4);

    expect(result.featured.id).toBe("featured");
    expect(result.recent.map((post) => post.id)).toEqual(["recent"]);
  });

  it("fails clearly when no featured post exists", () => {
    const posts = [
      {
        id: "regular",
        data: { featured: false, publishedAt: new Date("2026-07-12") },
      },
    ];

    expect(() => selectHomepagePosts(posts, 4)).toThrow(
      "At least one published post must be featured",
    );
  });
});
