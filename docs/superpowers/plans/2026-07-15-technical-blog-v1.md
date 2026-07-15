# KYRIE.DEV Technical Blog V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, responsive, statically generated first version of the approved KYRIE.DEV technical blog and make it ready for GitHub Pages deployment.

**Architecture:** Astro generates every route at build time from validated Markdown content. Page-level composition loads structured content through a small content library; presentational Astro components receive data through props. A small amount of framework-free browser JavaScript powers the menu, search dialog, and persisted light/dark theme.

**Tech Stack:** Astro 7, TypeScript, Markdown content collections, Astro Sitemap, Lucide Astro icons, Vitest, pnpm, GitHub Actions

---

## File Map

- `package.json`: scripts and dependency manifest.
- `astro.config.mjs`: static output and canonical site configuration.
- `tsconfig.json`: strict Astro TypeScript configuration.
- `src/content.config.ts`: validated blog content schema.
- `src/data/blog/*.md`: sample technical posts.
- `src/data/projects.ts`: selected project records.
- `src/lib/posts.ts`: pure sorting, selection, and reading-time helpers.
- `src/lib/content.ts`: Astro content-collection queries.
- `src/layouts/BaseLayout.astro`: global metadata, header, search, theme initialization, and footer.
- `src/layouts/ArticleLayout.astro`: focused long-form article presentation.
- `src/components/SiteHeader.astro`: desktop navigation and mobile menu.
- `src/components/SearchDialog.astro`: client-side local search dialog.
- `src/components/HeroIntro.astro`: brand and profile introduction.
- `src/components/WritingStatus.astro`: current topic strip.
- `src/components/FeaturedPost.astro`: lead article and architecture trace visual.
- `src/components/PostList.astro`: recent/article archive rows.
- `src/components/ProjectList.astro`: selected projects band.
- `src/styles/global.css`: tokens, resets, typography, shared interaction states, and responsive foundations.
- `src/pages/index.astro`: minimal global-layout fixture, then approved homepage composition.
- `src/pages/articles/index.astro`: chronological article archive.
- `src/pages/articles/[id].astro`: generated article routes.
- `src/pages/topics/index.astro`: topic index.
- `src/pages/projects.astro`: project index.
- `src/pages/about.astro`: author page.
- `src/pages/rss.xml.ts`: RSS endpoint.
- `tests/posts.test.ts`: pure content-helper tests.
- `tests/site-output.test.ts`: production HTML smoke tests.
- `.github/workflows/deploy.yml`: GitHub Pages build and deploy workflow.

## Task 1: Project Foundation And Test Harness

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `tests/posts.test.ts`
- Create: `src/lib/posts.ts`

- [ ] **Step 1: Add the failing post-helper test**

```ts
import { describe, expect, it } from "vitest";
import { calculateReadingMinutes, sortPostsNewestFirst } from "../src/lib/posts";

describe("post helpers", () => {
  it("sorts posts newest first without mutating the input", () => {
    const posts = [
      { data: { publishedAt: new Date("2026-01-01") } },
      { data: { publishedAt: new Date("2026-07-01") } },
    ];
    expect(sortPostsNewestFirst(posts)[0].data.publishedAt.toISOString()).toContain("2026-07-01");
    expect(posts[0].data.publishedAt.toISOString()).toContain("2026-01-01");
  });

  it("returns at least one reading minute", () => {
    expect(calculateReadingMinutes("短文")).toBe(1);
  });
});
```

- [ ] **Step 2: Install the Astro and test dependencies**

Run:

```bash
pnpm add astro @astrojs/rss @astrojs/sitemap @lucide/astro
pnpm add --save-dev @astrojs/check typescript vitest
```

Expected: dependencies resolve successfully and `pnpm-lock.yaml` is created.

- [ ] **Step 3: Run the test and verify the missing module failure**

Run: `pnpm exec vitest run tests/posts.test.ts`

Expected: FAIL because `src/lib/posts.ts` does not exist.

- [ ] **Step 4: Implement the pure helpers**

```ts
type DatedPost = { data: { publishedAt: Date } };

export function sortPostsNewestFirst<T extends DatedPost>(posts: readonly T[]): T[] {
  return [...posts].sort((left, right) =>
    right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function calculateReadingMinutes(body: string): number {
  const chineseCharacters = body.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = body.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return Math.max(1, Math.ceil(chineseCharacters / 400 + latinWords / 220));
}
```

- [ ] **Step 5: Add project scripts and configuration**

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:site": "pnpm build && vitest run tests/site-output.test.ts"
  }
}
```

`astro.config.mjs`:

```js
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: process.env.SITE_URL ?? "http://localhost:4321",
  integrations: [sitemap()],
});
```

`tsconfig.json`:

```json
{ "extends": "astro/tsconfigs/strict" }
```

- [ ] **Step 6: Run the helper tests**

Run: `pnpm test`

Expected: 2 tests pass.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs tsconfig.json .gitignore tests/posts.test.ts src/lib/posts.ts
git commit -m "chore: initialize Astro blog"
```

## Task 2: Validated Content And Sample Posts

**Files:**
- Create: `src/content.config.ts`
- Create: `src/data/blog/agent-systems.md`
- Create: `src/data/blog/task-orchestration.md`
- Create: `src/data/blog/vector-database-decisions.md`
- Create: `src/data/blog/spring-transaction-chain.md`
- Create: `src/data/blog/observability-first-step.md`
- Create: `src/data/projects.ts`
- Create: `src/lib/content.ts`
- Modify: `tests/posts.test.ts`

- [ ] **Step 1: Add failing helper coverage for featured and recent selection**

```ts
it("selects one featured post and excludes it from recent posts", () => {
  const posts = [
    { id: "featured", data: { featured: true, publishedAt: new Date("2026-07-10") } },
    { id: "recent", data: { featured: false, publishedAt: new Date("2026-07-12") } },
  ];
  const result = selectHomepagePosts(posts, 4);
  expect(result.featured.id).toBe("featured");
  expect(result.recent.map((post) => post.id)).toEqual(["recent"]);
});
```

- [ ] **Step 2: Verify the new test fails**

Run: `pnpm test`

Expected: FAIL because `selectHomepagePosts` is not exported.

- [ ] **Step 3: Implement deterministic homepage selection**

```ts
type HomepagePost = DatedPost & { id: string; data: { featured: boolean; publishedAt: Date } };

export function selectHomepagePosts<T extends HomepagePost>(posts: readonly T[], recentCount: number) {
  const sorted = sortPostsNewestFirst(posts);
  const featured = sorted.find((post) => post.data.featured);
  if (!featured) throw new Error("At least one published post must be featured");
  return { featured, recent: sorted.filter((post) => post.id !== featured.id).slice(0, recentCount) };
}
```

- [ ] **Step 4: Define and populate the content collection**

Use Astro's `glob()` loader over `src/data/blog`, with a Zod schema containing `title`, `description`, `publishedAt`, `tags`, `featured`, `draft`, and `visualAlt`. Add five substantive sample Markdown posts using the approved homepage titles and unique publication dates.

- [ ] **Step 5: Add content queries and project data**

`src/lib/content.ts` exposes `getPublishedPosts()` and `getHomepagePosts()`. It filters drafts, sorts newest first, calculates reading time from `entry.body`, and delegates featured selection to the pure helper. `src/data/projects.ts` exports three named project records used in the visual design.

- [ ] **Step 6: Verify content and tests**

Run:

```bash
pnpm test
pnpm check
```

Expected: helper tests pass and Astro reports no content-schema errors.

- [ ] **Step 7: Commit validated content**

```bash
git add src/content.config.ts src/data src/lib tests/posts.test.ts
git commit -m "feat: add validated technical content"
```

## Task 3: Global Layout, Theme, Header, Search, And Footer

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SearchDialog.astro`
- Create: `src/pages/index.astro`

- [ ] **Step 1: Add production-output assertions for global structure**

```ts
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
});
```

- [ ] **Step 2: Build and verify the output test cannot pass yet**

Run: `pnpm test:site`

Expected: FAIL because the homepage and layout do not exist.

- [ ] **Step 3: Implement global tokens and foundations**

Define the approved light/dark tokens, system sans/monospace stacks, visible focus states, 1120 px content width, responsive gutters, dialog behavior, and reduced-motion handling in `src/styles/global.css`.

- [ ] **Step 4: Implement the header and mobile menu**

Use Lucide `Menu`, `X`, `Search`, `Sun`, and `Moon` icons. Every icon button receives an accessible name and stable square dimensions. The mobile menu exposes all four navigation routes and closes on link activation or `Escape`.

- [ ] **Step 5: Implement local search**

`SearchDialog.astro` receives a JSON-safe list of post title, description, tags, and URL. Browser JavaScript performs normalized substring search, renders matching links, displays a no-results state, and returns focus to the trigger after closing.

- [ ] **Step 6: Implement BaseLayout metadata and persisted theme**

`BaseLayout.astro` renders canonical metadata, description, Open Graph basics, header, search dialog, main slot, and footer. An inline initialization script applies the saved theme before paint and falls back to `prefers-color-scheme`.

- [ ] **Step 7: Add the minimum homepage and turn the output test green**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="KYRIE.DEV" description="Java、AI 工程与系统设计实践。">
  <h1>KYRIE.DEV</h1>
</BaseLayout>
```

Run: `pnpm test:site`

Expected: the production build completes and the global structure assertion passes.

- [ ] **Step 8: Commit the global experience**

```bash
git add src/styles src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/components/SearchDialog.astro src/pages/index.astro tests/site-output.test.ts
git commit -m "feat: add global blog experience"
```

## Task 4: Approved Editorial Homepage

**Files:**
- Create: `src/components/HeroIntro.astro`
- Create: `src/components/WritingStatus.astro`
- Create: `src/components/FeaturedPost.astro`
- Create: `src/components/PostList.astro`
- Create: `src/components/ProjectList.astro`
- Modify: `src/pages/index.astro`
- Modify: `tests/site-output.test.ts`

- [ ] **Step 1: Add failing homepage content assertions**

```ts
it("renders the approved homepage sections and featured technical visual", async () => {
  const html = await readFile("dist/index.html", "utf8");
  expect(html).toContain("把复杂系统讲清楚");
  expect(html).toContain("data-writing-status");
  expect(html).toContain("data-technical-visual");
  expect(html).toContain("最新文章");
  expect(html).toContain("精选项目");
});
```

- [ ] **Step 2: Run the site test and verify the new assertions fail**

Run: `pnpm test:site`

Expected: FAIL because the approved homepage sections are absent.

- [ ] **Step 3: Build the homepage components**

Implement each component as a focused Astro file using structured props. Use rule-separated sections instead of decorative cards. `FeaturedPost` includes the meaningful agent request-flow and latency visual from the approved mockup with a text alternative.

- [ ] **Step 4: Compose the homepage**

`src/pages/index.astro` loads one featured post, four recent posts, and three selected projects, then renders the components inside `BaseLayout` in the exact approved order.

- [ ] **Step 5: Verify homepage output**

Run:

```bash
pnpm test
pnpm test:site
pnpm check
```

Expected: all helper and output tests pass; Astro check reports zero errors.

- [ ] **Step 6: Commit the homepage**

```bash
git add src/components src/pages/index.astro tests/site-output.test.ts
git commit -m "feat: build editorial blog homepage"
```

## Task 5: Working Navigation Routes And RSS

**Files:**
- Create: `src/layouts/ArticleLayout.astro`
- Create: `src/pages/articles/index.astro`
- Create: `src/pages/articles/[id].astro`
- Create: `src/pages/topics/index.astro`
- Create: `src/pages/projects.astro`
- Create: `src/pages/about.astro`
- Create: `src/pages/rss.xml.ts`
- Modify: `tests/site-output.test.ts`

- [ ] **Step 1: Add failing route-output assertions**

```ts
it.each([
  "dist/articles/index.html",
  "dist/topics/index.html",
  "dist/projects/index.html",
  "dist/about/index.html",
  "dist/rss.xml",
])("builds %s", async (path) => {
  await expect(readFile(path, "utf8")).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Verify the route test fails**

Run: `pnpm test:site`

Expected: FAIL because the secondary routes are missing.

- [ ] **Step 3: Implement archive, topics, projects, and about pages**

Reuse `PostList` and `ProjectList`; do not duplicate homepage markup. Each page has one literal `h1`, concise supporting copy, canonical metadata, and working internal links.

- [ ] **Step 4: Implement generated article pages**

`[id].astro` uses `getStaticPaths()` from published posts, renders Markdown through Astro's content API, and passes title, date, tags, and reading time to `ArticleLayout`.

- [ ] **Step 5: Implement RSS**

Generate `/rss.xml` from the same published-post query, with absolute article URLs based on `Astro.site`.

- [ ] **Step 6: Verify every route**

Run:

```bash
pnpm test:site
pnpm check
```

Expected: every required output exists and Astro reports no errors.

- [ ] **Step 7: Commit working routes**

```bash
git add src/layouts/ArticleLayout.astro src/pages tests/site-output.test.ts
git commit -m "feat: add blog routes and RSS"
```

## Task 6: GitHub Pages Deployment And Final Verification

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [ ] **Step 1: Add the official Astro Pages workflow**

Use `actions/checkout@v7`, `withastro/action@v6`, and `actions/deploy-pages@v5`, matching the current official Astro workflow. Grant only `contents: read`, `pages: write`, and `id-token: write`, and deploy through the `github-pages` environment.

- [ ] **Step 2: Document local and deployment commands**

`README.md` includes `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm check`, `pnpm build`, the `SITE_URL` production variable, and the GitHub Pages settings step.

- [ ] **Step 3: Run the complete verification suite**

Run:

```bash
pnpm test
pnpm check
pnpm build
pnpm exec vitest run tests/site-output.test.ts
```

Expected: all tests pass, type/content checks report zero errors, and the production build completes.

- [ ] **Step 4: Inspect generated assets and repository state**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended V1 files are pending.

- [ ] **Step 5: Commit deployment readiness**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: add GitHub Pages deployment"
```
