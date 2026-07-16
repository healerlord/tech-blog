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

  it.each([
    "dist/articles/index.html",
    "dist/articles/agent-systems/index.html",
    "dist/topics/index.html",
    "dist/projects/index.html",
    "dist/about/index.html",
    "dist/rss.xml",
  ])("builds %s", async (path) => {
    await expect(readFile(path, "utf8")).resolves.toBeTruthy();
  });

  it("builds concise topic previews and stable topic archives", async () => {
    const overview = await readFile("dist/topics/index.html", "utf8");
    const javaTopic = await readFile("dist/topics/java/index.html", "utf8");

    expect(overview).toContain("查看全部");
    expect(overview).toContain('href="/topics/java/"');
    expect(javaTopic).toContain("JVM、Spring 与服务端工程边界");
  });

  it("builds a bundled no-index writing admin", async () => {
    const html = await readFile("dist/admin/index.html", "utf8");
    const config = await readFile("dist/admin/config.yml", "utf8");

    expect(html).toContain('content="noindex, nofollow"');
    expect(html).toContain("Content-Security-Policy");
    expect(html).not.toContain("unpkg.com");
    expect(config).toContain("auth_methods:");
    expect(config).toContain("- token");
  });
});
