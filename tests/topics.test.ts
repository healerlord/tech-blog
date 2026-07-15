import { describe, expect, it } from "vitest";

import {
  buildTopicGroups,
  paginateTopic,
  topicPagePath,
} from "../src/lib/topics";

const definitions = [
  { name: "Java", slug: "java", description: "JVM 与服务端实践" },
  { name: "AI", slug: "ai", description: "AI 工程实践" },
] as const;

describe("topic helpers", () => {
  it("groups posts by stable topic definitions without changing post order", () => {
    const posts = [
      { id: "new", data: { tags: ["Java", "AI"] } },
      { id: "old", data: { tags: ["Java"] } },
    ];

    const groups = buildTopicGroups(posts, definitions);

    expect(groups[0]).toMatchObject({
      name: "Java",
      slug: "java",
      posts: [{ id: "new" }, { id: "old" }],
    });
    expect(groups[1]).toMatchObject({
      name: "AI",
      slug: "ai",
      posts: [{ id: "new" }],
    });
    expect(posts.map((post) => post.id)).toEqual(["new", "old"]);
  });

  it("omits catalog topics that have no published posts", () => {
    const groups = buildTopicGroups(
      [{ id: "post", data: { tags: ["Java"] } }],
      definitions,
    );

    expect(groups.map((group) => group.slug)).toEqual(["java"]);
  });

  it("paginates a topic and reports stable page metadata", () => {
    const topic = {
      ...definitions[0],
      posts: [
        { id: "one", data: { tags: ["Java"] } },
        { id: "two", data: { tags: ["Java"] } },
        { id: "three", data: { tags: ["Java"] } },
      ],
    };

    const pages = paginateTopic(topic, 2);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ page: 1, pageCount: 2 });
    expect(pages[0].posts.map((post) => post.id)).toEqual(["one", "two"]);
    expect(pages[1]).toMatchObject({ page: 2, pageCount: 2 });
    expect(pages[1].posts.map((post) => post.id)).toEqual(["three"]);
  });

  it("rejects an invalid page size", () => {
    const topic = { ...definitions[0], posts: [] };

    expect(() => paginateTopic(topic, 0)).toThrow(
      "Topic page size must be greater than zero",
    );
  });

  it("builds stable first and later page paths", () => {
    expect(topicPagePath("java", 1)).toBe("java");
    expect(topicPagePath("java", 2)).toBe("java/2");
  });
});
