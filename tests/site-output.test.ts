import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("production site", () => {
  it("renders global navigation, theme, search, and one homepage h1", async () => {
    const html = await readFile("dist/index.html", "utf8");

    expect(html).toContain("KYRIE / DEV");
    expect(html).toContain("data-theme-toggle");
    expect(html).toContain("data-search-dialog");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("renders the approved homepage sections and featured technical visual", async () => {
    const html = await readFile("dist/index.html", "utf8");

    expect(html).toContain("把复杂系统讲清楚");
    expect(html).toContain("data-writing-status");
    expect(html).toContain("data-technical-visual");
    expect(html).toContain("最新文章");
    expect(html).toContain("精选项目");
  });
});
