import { describe, expect, it } from "vitest";

import { joinBase } from "../src/lib/urls";

describe("joinBase", () => {
  it("joins a repository base without a trailing slash", () => {
    expect(joinBase("/tech-blog", "/articles/")).toBe(
      "/tech-blog/articles/",
    );
  });

  it("keeps root deployments clean", () => {
    expect(joinBase("/", "articles/")).toBe("/articles/");
  });
});
