import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const site =
  process.env.SITE_URL ??
  (isGitHubActions ? "https://healerlord.github.io" : "http://localhost:4321");
const base =
  process.env.BASE_PATH ?? (isGitHubActions ? "/tech-blog" : "/");

export default defineConfig({
  output: "static",
  site,
  base,
  integrations: [sitemap()],
  // The self-contained CMS is isolated to /admin and is about 600 KB over gzip.
  vite: { build: { chunkSizeWarningLimit: 2000 } },
});
