import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("GitHub Pages output", () => {
  it("prefixes internal links and assets with the repository base path", async () => {
    const html = await readFile("dist/index.html", "utf8");

    expect(html).toContain('href="/tech-blog/articles/"');
    expect(html).toContain('href="/tech-blog/_astro/');
  });

  it("publishes absolute RSS article URLs under the repository path", async () => {
    const xml = await readFile("dist/rss.xml", "utf8");

    expect(xml).toContain(
      "https://healerlord.github.io/tech-blog/articles/agent-systems/",
    );
  });

  it("builds the writing studio under the Pages base path", async () => {
    const html = await readFile("dist/write/index.html", "utf8");

    expect(html).toContain('src="/tech-blog/_astro/');
    expect(html).not.toMatch(/client[_-]?secret/i);
  });

  it("builds the admin for the Pages base path with OAuth only", async () => {
    const html = await readFile("dist/admin/index.html", "utf8");
    const config = await readFile("dist/admin/config.yml", "utf8");

    expect(html).toContain('src="/tech-blog/_astro/');
    expect(config).toContain("https://healerlord.github.io/tech-blog/");
    expect(config).toContain("https://cms-auth.example.workers.dev");
    expect(config).toContain("- oauth");
    expect(config).not.toContain("GITHUB_CLIENT_SECRET");
    expect(config).not.toMatch(/client[_-]?secret/i);
    expect(config).not.toMatch(/github_pat_/i);
    expect(html).not.toMatch(/client[_-]?secret/i);
  });
});
