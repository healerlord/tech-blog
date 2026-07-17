import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("GitHub Pages workflow", () => {
  it("warns when the CMS OAuth Worker URL is missing instead of failing", async () => {
    const workflow = await readFile(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("CMS_AUTH_URL: ${{ vars.CMS_AUTH_URL }}");
    expect(workflow).toContain("::warning::CMS_AUTH_URL is not set");
    expect(workflow).not.toContain("exit 1");
  });

  it("uses a Worker compatibility date supported by pinned Wrangler", async () => {
    const config = await readFile(
      "workers/cms-auth/wrangler.jsonc",
      "utf8",
    );

    expect(config).toContain('"compatibility_date": "2026-07-15"');
  });
});
