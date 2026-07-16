import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";

import { topicNames } from "../src/data/topics";
import { createCmsConfig } from "../src/lib/cms-config";

describe("CMS configuration", () => {
  it("uses OAuth and the configured repository in production", () => {
    const config = createCmsConfig({
      siteUrl: "https://healerlord.github.io/tech-blog/",
      authUrl: "https://cms-auth.example.workers.dev",
    });

    expect(config.backend).toMatchObject({
      name: "github",
      repo: "healerlord/tech-blog",
      branch: "main",
      auth_methods: ["oauth"],
      base_url: "https://cms-auth.example.workers.dev",
    });
  });

  it("allows token auth only for a local build without an auth URL", () => {
    const config = createCmsConfig({ siteUrl: "http://localhost:4321/" });

    expect(config.backend.auth_methods).toEqual(["token"]);
    expect(config.backend).not.toHaveProperty("base_url");
  });

  it("keeps CMS tags synchronized with the topic catalog", () => {
    const config = createCmsConfig({ siteUrl: "http://localhost:4321/" });
    const blog = config.collections[0];
    const tags = blog.fields.find((field) => field.name === "tags");

    expect(tags?.options).toEqual(topicNames);
    expect(blog.slug).toBe("{{fields.slug}}");
    expect(blog.delete).toBe(false);
  });

  it("round-trips through YAML without losing the content model", () => {
    const original = createCmsConfig({ siteUrl: "http://localhost:4321/" });
    const parsed = parse(stringify(original));

    expect(parsed.collections[0].folder).toBe("src/data/blog");
    expect(parsed.collections[0].fields.at(-1).name).toBe("body");
  });
});
