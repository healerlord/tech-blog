# Online Writing Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-author, mobile-friendly Sveltia CMS writing interface with GitHub OAuth, draft publishing, stable slugs, and a reproducible Cloudflare Worker authenticator.

**Architecture:** Astro statically builds the public blog, `/admin/`, and a generated CMS YAML configuration from the same content and topic contracts. Sveltia CMS commits Markdown directly to `healerlord/tech-blog`; a small Cloudflare Worker performs GitHub OAuth, restricts the caller domain and username, and stores no content or session state.

**Tech Stack:** Astro 7, TypeScript 6, Sveltia CMS 0.171.0, YAML 2.9.0, Vitest 4, Cloudflare Workers/Wrangler 4.111.0, GitHub Actions

---

## File Structure

- `src/content.config.ts`: Astro collection loader wired to the shared schema.
- `src/data/topics.ts`: topic catalog and the allowed CMS tag values.
- `src/lib/blog-schema.ts`: authoritative frontmatter schema shared by Astro and unit tests.
- `src/lib/posts.ts`: pure draft filtering and filename/slug validation.
- `src/lib/content.ts`: validates every collection entry before returning published posts.
- `src/lib/cms-config.ts`: creates the structured Sveltia configuration shared by tests and the YAML endpoint.
- `src/pages/admin/index.astro`: bundled, no-index Sveltia application shell.
- `src/pages/admin/config.yml.ts`: statically emits the CMS configuration with the current base path and auth URL.
- `workers/cms-auth/src/index.ts`: GitHub-only OAuth Worker with domain and username allowlists.
- `workers/cms-auth/wrangler.jsonc`: reproducible Worker name, compatibility date, and non-secret allowlists.
- `workers/cms-auth/README.md`: upstream attribution and deployment/secret contract.
- `tests/content-schema.test.ts`: content validation, draft filtering, and slug identity coverage.
- `tests/cms-config.test.ts`: CMS fields, tag catalog, auth modes, and YAML round-trip coverage.
- `tests/cms-auth.test.ts`: OAuth domain, CSRF, scope, and user allowlist coverage.
- `tests/site-output.test.ts`: local static admin artifact assertions.
- `tests/github-output.test.ts`: GitHub Pages base-path and production OAuth configuration assertions.
- `docs/online-writing-setup.md`: owner-facing Cloudflare, GitHub OAuth, and recovery runbook.

### Task 1: Enforce The Authoring Content Contract

**Files:**
- Modify: `src/data/topics.ts`
- Modify: `src/content.config.ts`
- Create: `src/lib/blog-schema.ts`
- Modify: `src/lib/posts.ts`
- Modify: `src/lib/content.ts`
- Modify: `src/data/blog/agent-systems.md`
- Modify: `src/data/blog/observability-first-step.md`
- Modify: `src/data/blog/spring-transaction-chain.md`
- Modify: `src/data/blog/task-orchestration.md`
- Modify: `src/data/blog/vector-database-decisions.md`
- Create: `tests/content-schema.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write failing schema, draft, and slug tests**

Create `tests/content-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { blogSchema } from "../src/lib/blog-schema";
import { topicNames } from "../src/data/topics";
import {
  assertPostIdentity,
  filterPublishedPosts,
} from "../src/lib/posts";

const validPost = {
  title: "可靠的发布流程",
  slug: "reliable-publishing",
  description: "验证在线写作需要遵守的内容边界。",
  publishedAt: "2026-07-16",
  tags: ["Architecture"],
  featured: false,
  draft: true,
};

describe("authoring content contract", () => {
  it("accepts a normal draft without visual metadata", () => {
    const result = blogSchema.parse(validPost);

    expect(result.slug).toBe("reliable-publishing");
    expect(result.visualAlt).toBe("");
  });

  it("requires visual metadata for featured posts", () => {
    const result = blogSchema.safeParse({ ...validPost, featured: true });

    expect(result.success).toBe(false);
  });

  it.each(["Bad Slug", "中文-slug", "double--dash", "trailing-"])(
    "rejects invalid slug %s",
    (slug) => {
      expect(blogSchema.safeParse({ ...validPost, slug }).success).toBe(false);
    },
  );

  it("rejects tags outside the topic catalog", () => {
    expect(
      blogSchema.safeParse({ ...validPost, tags: ["Unknown"] }).success,
    ).toBe(false);
    expect(topicNames).toContain("Architecture");
  });

  it("keeps drafts out of published collections", () => {
    const posts = [
      { id: "draft", data: { draft: true } },
      { id: "published", data: { draft: false } },
    ];

    expect(filterPublishedPosts(posts).map((post) => post.id)).toEqual([
      "published",
    ]);
  });

  it("rejects a filename and slug mismatch", () => {
    expect(() =>
      assertPostIdentity({
        id: "old-path",
        data: { slug: "new-path" },
      }),
    ).toThrow('Post filename "old-path" must match slug "new-path"');
  });
});
```

Add `tests/content-schema.test.ts` to `test:unit` in `package.json`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/content-schema.test.ts
```

Expected: FAIL because `src/lib/blog-schema.ts` and the new helper exports do not exist.

- [x] **Step 3: Export the topic names and implement the schema**

Keep `topicDefinitions` unchanged and add this export in `src/data/topics.ts`:

```ts
export const topicNames = topicDefinitions.map(({ name }) => name) as [
  string,
  ...string[],
];
```

Create `src/lib/blog-schema.ts`:

```ts
import { z } from "astro/zod";

import { topicNames } from "../data/topics";

export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogSchema = z
  .object({
    title: z.string().min(1),
    slug: z.string().regex(POST_SLUG_PATTERN),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    tags: z.array(z.enum(topicNames)).min(1),
    featured: z.boolean().default(false),
    draft: z.boolean().default(true),
    visualAlt: z.string().default(""),
  })
  .superRefine((data, context) => {
    if (data.featured && !data.visualAlt.trim()) {
      context.addIssue({
        code: "custom",
        path: ["visualAlt"],
        message: "Featured posts require visualAlt",
      });
    }
  });
```

Replace the local schema in `src/content.config.ts` with:

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { blogSchema } from "./lib/blog-schema";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/blog" }),
  schema: blogSchema,
});

export const collections = { blog };
```

- [x] **Step 4: Add pure publication and identity helpers**

Append to `src/lib/posts.ts`:

```ts
interface DraftPost {
  data: { draft: boolean };
}

interface IdentifiedPost {
  id: string;
  data: { slug: string };
}

export function filterPublishedPosts<T extends DraftPost>(
  posts: readonly T[],
): T[] {
  return posts.filter((post) => !post.data.draft);
}

export function assertPostIdentity<T extends IdentifiedPost>(post: T): T {
  if (post.id !== post.data.slug) {
    throw new Error(
      `Post filename "${post.id}" must match slug "${post.data.slug}"`,
    );
  }

  return post;
}
```

Update `getPublishedPosts` in `src/lib/content.ts` so all entries are validated before drafts are filtered:

```ts
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const entries = await getCollection("blog");
  const publishedEntries = filterPublishedPosts(
    entries.map((entry) => assertPostIdentity(entry)),
  );
  const posts = publishedEntries.map((entry) => ({
    ...entry,
    readingMinutes: calculateReadingMinutes(entry.body ?? ""),
  }));

  return sortPostsNewestFirst(posts);
}
```

Import `assertPostIdentity` and `filterPublishedPosts` from `./posts` in that file.

- [x] **Step 5: Migrate existing article slugs without changing URLs**

Add a `slug` field matching each current filename:

```yaml
# agent-systems.md
slug: "agent-systems"

# observability-first-step.md
slug: "observability-first-step"

# spring-transaction-chain.md
slug: "spring-transaction-chain"

# task-orchestration.md
slug: "task-orchestration"

# vector-database-decisions.md
slug: "vector-database-decisions"
```

- [x] **Step 6: Run focused and existing tests**

Run:

```bash
pnpm exec vitest run tests/content-schema.test.ts tests/posts.test.ts tests/topics.test.ts
pnpm check
```

Expected: all tests pass and Astro reports zero diagnostics.

- [x] **Step 7: Commit the content contract**

```bash
git add package.json src/content.config.ts src/data/topics.ts src/lib/blog-schema.ts src/lib/posts.ts src/lib/content.ts src/data/blog tests/content-schema.test.ts
git commit -m "feat: validate authored blog content"
```

### Task 2: Generate The Sveltia Admin From Shared Data

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/cms-config.ts`
- Create: `src/pages/admin/index.astro`
- Create: `src/pages/admin/config.yml.ts`
- Create: `tests/cms-config.test.ts`
- Modify: `tests/site-output.test.ts`
- Modify: `tests/github-output.test.ts`

- [ ] **Step 1: Install exact CMS and YAML versions**

Run:

```bash
pnpm add --save-exact @sveltia/cms@0.171.0 yaml@2.9.0
```

Expected: `package.json` contains exact versions without `^` or `~` and the lockfile records both packages.

- [ ] **Step 2: Write failing CMS configuration tests**

Create `tests/cms-config.test.ts`:

```ts
import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";

import { createCmsConfig } from "../src/lib/cms-config";
import { topicNames } from "../src/data/topics";

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
```

Add `tests/cms-config.test.ts` to `test:unit`.

- [ ] **Step 3: Run the CMS tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/cms-config.test.ts
```

Expected: FAIL because `src/lib/cms-config.ts` does not exist.

- [ ] **Step 4: Implement the structured CMS configuration**

Create `src/lib/cms-config.ts`:

```ts
import { topicNames } from "../data/topics";

interface CmsConfigOptions {
  siteUrl: string;
  authUrl?: string;
}

export interface CmsField {
  label: string;
  name: string;
  widget: string;
  options?: string[];
  [key: string]: unknown;
}

interface CmsBackend {
  name: string;
  repo: string;
  branch: string;
  auth_methods: string[];
  base_url?: string;
}

interface CmsCollection {
  name: string;
  label: string;
  label_singular: string;
  folder: string;
  create: boolean;
  delete: boolean;
  extension: string;
  format: string;
  slug: string;
  identifier_field: string;
  summary: string;
  fields: CmsField[];
}

interface CmsConfig {
  app_title: string;
  site_url: string;
  display_url: string;
  backend: CmsBackend;
  collections: CmsCollection[];
}

export function createCmsConfig({
  siteUrl,
  authUrl,
}: CmsConfigOptions): CmsConfig {
  const backend: CmsBackend = {
    name: "github",
    repo: "healerlord/tech-blog",
    branch: "main",
    auth_methods: authUrl ? ["oauth"] : ["token"],
    ...(authUrl ? { base_url: authUrl } : {}),
  };

  return {
    app_title: "KYRIE.DEV 写作后台",
    site_url: siteUrl,
    display_url: siteUrl,
    backend,
    collections: [
      {
        name: "blog",
        label: "文章",
        label_singular: "文章",
        folder: "src/data/blog",
        create: true,
        delete: false,
        extension: "md",
        format: "frontmatter",
        slug: "{{fields.slug}}",
        identifier_field: "slug",
        summary: "{{title}} · {{publishedAt}}",
        fields: [
          { label: "标题", name: "title", widget: "string" },
          {
            label: "URL Slug",
            name: "slug",
            widget: "string",
            pattern: [
              "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              "只能使用小写英文、数字和单个连字符",
            ],
            hint: "发布后不要修改，例如 agent-runtime-boundaries",
          },
          { label: "摘要", name: "description", widget: "text" },
          {
            label: "发布日期",
            name: "publishedAt",
            widget: "datetime",
            date_format: "YYYY-MM-DD",
            time_format: false,
            format: "YYYY-MM-DD",
          },
          {
            label: "专题",
            name: "tags",
            widget: "select",
            multiple: true,
            min: 1,
            options: [...topicNames],
          },
          {
            label: "首页推荐",
            name: "featured",
            widget: "boolean",
            default: false,
          },
          {
            label: "保存为草稿",
            name: "draft",
            widget: "boolean",
            default: true,
          },
          {
            label: "技术视觉说明",
            name: "visualAlt",
            widget: "text",
            required: false,
            default: "",
            hint: "仅首页推荐文章必填",
          },
          {
            label: "正文",
            name: "body",
            widget: "markdown",
            modes: ["raw", "rich_text"],
            sanitize_preview: true,
          },
        ],
      },
    ],
  };
}
```

- [ ] **Step 5: Add the static YAML endpoint**

Create `src/pages/admin/config.yml.ts`:

```ts
import type { APIRoute } from "astro";
import { stringify } from "yaml";

import { createCmsConfig } from "../../lib/cms-config";

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error("Astro site URL is required for the CMS configuration");
  }

  const authUrl = process.env.CMS_AUTH_URL?.trim();

  if (process.env.GITHUB_ACTIONS === "true" && !authUrl) {
    throw new Error("CMS_AUTH_URL is required for a GitHub Pages build");
  }

  const siteUrl = new URL(import.meta.env.BASE_URL, site).toString();
  const config = createCmsConfig({ siteUrl, authUrl });

  return new Response(stringify(config), {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
};
```

- [ ] **Step 6: Add the bundled no-index admin shell**

Create `src/pages/admin/index.astro`:

```astro
---
const authUrl = process.env.CMS_AUTH_URL?.trim();
const authOrigin = authUrl ? new URL(authUrl).origin : "";
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://api.github.com https://github.com ${authOrigin}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
].join("; ");
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta http-equiv="Content-Security-Policy" content={csp} />
    <title>KYRIE.DEV 写作后台</title>
  </head>
  <body>
    <script>
      import "@sveltia/cms";
    </script>
  </body>
</html>
```

- [ ] **Step 7: Add static output assertions**

Add to `tests/site-output.test.ts`:

```ts
it("builds a bundled no-index writing admin", async () => {
  const html = await readFile("dist/admin/index.html", "utf8");
  const config = await readFile("dist/admin/config.yml", "utf8");

  expect(html).toContain('content="noindex, nofollow"');
  expect(html).toContain("Content-Security-Policy");
  expect(html).not.toContain("unpkg.com");
  expect(config).toContain("auth_methods:");
  expect(config).toContain("- token");
});
```

Add to `tests/github-output.test.ts`:

```ts
it("builds the admin for the Pages base path with OAuth only", async () => {
  const html = await readFile("dist/admin/index.html", "utf8");
  const config = await readFile("dist/admin/config.yml", "utf8");

  expect(html).toContain('src="/tech-blog/_astro/');
  expect(config).toContain("https://healerlord.github.io/tech-blog/");
  expect(config).toContain("https://cms-auth.example.workers.dev");
  expect(config).toContain("- oauth");
  expect(config).not.toContain("GITHUB_CLIENT_SECRET");
});
```

Update `test:github` to provide a non-secret test auth URL:

```json
"test:github": "CMS_AUTH_URL=https://cms-auth.example.workers.dev GITHUB_ACTIONS=true astro build && vitest run tests/github-output.test.ts"
```

- [ ] **Step 8: Run admin unit and output tests**

Run:

```bash
pnpm exec vitest run tests/cms-config.test.ts
pnpm test:site
pnpm test:github
pnpm check
```

Expected: the CMS tests and both build modes pass; Astro reports zero diagnostics.

- [ ] **Step 9: Commit the static admin**

```bash
git add package.json pnpm-lock.yaml src/lib/cms-config.ts src/pages/admin tests/cms-config.test.ts tests/site-output.test.ts tests/github-output.test.ts
git commit -m "feat: add static writing admin"
```

### Task 3: Add The Restricted OAuth Worker

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `workers/cms-auth/src/index.ts`
- Create: `workers/cms-auth/wrangler.jsonc`
- Create: `workers/cms-auth/README.md`
- Create: `tests/cms-auth.test.ts`

- [ ] **Step 1: Install the exact Worker CLI and add scripts**

Run:

```bash
pnpm add --save-dev --save-exact wrangler@4.111.0
```

Add scripts to `package.json`:

```json
"cms:auth:dev": "wrangler dev --config workers/cms-auth/wrangler.jsonc",
"cms:auth:deploy": "wrangler deploy --config workers/cms-auth/wrangler.jsonc"
```

Add `tests/cms-auth.test.ts` to `test:unit`.

- [ ] **Step 2: Write failing Worker security tests**

Create `tests/cms-auth.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import worker, { type CmsAuthEnv } from "../workers/cms-auth/src/index";

const env: CmsAuthEnv = {
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAINS: "healerlord.github.io",
  ALLOWED_USERS: "healerlord",
};

function authRequest(domain = "healerlord.github.io") {
  return new Request(
    `https://cms-auth.example.workers.dev/auth?provider=github&site_id=${domain}`,
  );
}

async function beginAuth() {
  const response = await worker.fetch(authRequest(), env);
  const location = new URL(response.headers.get("location") ?? "");

  return {
    response,
    state: location.searchParams.get("state") ?? "",
    cookie: (response.headers.get("set-cookie") ?? "").split(";")[0],
    location,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("CMS OAuth Worker", () => {
  it("rejects an unapproved site domain", async () => {
    const response = await worker.fetch(authRequest("evil.example"), env);

    expect(await response.text()).toContain("UNSUPPORTED_DOMAIN");
  });

  it("starts OAuth with a least-privilege public repository scope", async () => {
    const { response, location } = await beginAuth();

    expect(response.status).toBe(302);
    expect(location.origin).toBe("https://github.com");
    expect(location.searchParams.get("scope")).toBe("public_repo read:user");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects a callback with a mismatched CSRF state", async () => {
    const { cookie } = await beginAuth();
    const request = new Request(
      "https://cms-auth.example.workers.dev/callback?code=code&state=wrong",
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);

    expect(await response.text()).toContain("CSRF_DETECTED");
  });

  it("does not return a token for another GitHub user", async () => {
    const { state, cookie } = await beginAuth();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "secret-token" }))
      .mockResolvedValueOnce(Response.json({ login: "intruder" }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request(
      `https://cms-auth.example.workers.dev/callback?code=code&state=${state}`,
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);
    const html = await response.text();

    expect(html).toContain("UNAUTHORIZED_USER");
    expect(html).not.toContain("secret-token");
  });

  it("returns the token only for healerlord", async () => {
    const { state, cookie } = await beginAuth();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: "secret-token" }))
        .mockResolvedValueOnce(Response.json({ login: "healerlord" })),
    );

    const request = new Request(
      `https://cms-auth.example.workers.dev/callback?code=code&state=${state}`,
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);

    expect(await response.text()).toContain("secret-token");
  });
});
```

- [ ] **Step 3: Run the Worker test and verify RED**

Run:

```bash
pnpm exec vitest run tests/cms-auth.test.ts
```

Expected: FAIL because the Worker module does not exist.

- [ ] **Step 4: Implement the GitHub-only OAuth Worker**

Create `workers/cms-auth/src/index.ts`:

```ts
export interface CmsAuthEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_DOMAINS: string;
  ALLOWED_USERS: string;
}

interface AuthMessage {
  token?: string;
  error?: string;
  errorCode?: string;
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const outputHtml = ({ token, error, errorCode }: AuthMessage) => {
  const state = error ? "error" : "success";
  const content = error
    ? { provider: "github", error, errorCode }
    : { provider: "github", token };

  return new Response(
    `<!doctype html><html><body><script>
      (() => {
        window.addEventListener('message', ({ data, origin }) => {
          if (data === 'authorizing:github') {
            window.opener?.postMessage(
              'authorization:github:${state}:${JSON.stringify(content)}',
              origin
            );
          }
        });
        window.opener?.postMessage('authorizing:github', '*');
      })();
    </script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie":
          "csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure",
      },
    },
  );
};

const fail = (errorCode: string, error: string) =>
  outputHtml({ errorCode, error });

function requireEnvironment(env: CmsAuthEnv) {
  if (
    !env.GITHUB_CLIENT_ID ||
    !env.GITHUB_CLIENT_SECRET ||
    !env.ALLOWED_DOMAINS ||
    !env.ALLOWED_USERS
  ) {
    return fail("MISCONFIGURED_CLIENT", "OAuth Worker configuration is incomplete.");
  }
}

export async function handleAuth(request: Request, env: CmsAuthEnv) {
  const invalidEnvironment = requireEnvironment(env);
  if (invalidEnvironment) return invalidEnvironment;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const domain = searchParams.get("site_id")?.toLowerCase();

  if (provider !== "github") {
    return fail("UNSUPPORTED_BACKEND", "Only GitHub is supported.");
  }

  if (!domain || !splitList(env.ALLOWED_DOMAINS).includes(domain)) {
    return fail("UNSUPPORTED_DOMAIN", "This domain is not allowed.");
  }

  const csrfToken = crypto.randomUUID().replaceAll("-", "");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: "public_repo read:user",
    state: csrfToken,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie":
        `csrf-token=github_${csrfToken}; ` +
        "HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure",
    },
  });
}

export async function handleCallback(request: Request, env: CmsAuthEnv) {
  const invalidEnvironment = requireEnvironment(env);
  if (invalidEnvironment) return invalidEnvironment;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookie = request.headers.get("Cookie") ?? "";
  const [, csrfToken] =
    cookie.match(/\bcsrf-token=github_([0-9a-f]{32})\b/) ?? [];

  if (!code || !state) {
    return fail("AUTH_CODE_REQUEST_FAILED", "GitHub returned no authorization code.");
  }

  if (!csrfToken || state !== csrfToken) {
    return fail("CSRF_DETECTED", "OAuth state validation failed.");
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
      }),
    });
  } catch {
    return fail("TOKEN_REQUEST_FAILED", "GitHub token request failed.");
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
  } | null;
  const token = tokenPayload?.access_token;

  if (!token) {
    return fail(
      "TOKEN_REQUEST_FAILED",
      tokenPayload?.error ?? "GitHub returned no access token.",
    );
  }

  let userResponse: Response;
  try {
    userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "kyrie-dev-cms-auth",
      },
    });
  } catch {
    return fail("USER_REQUEST_FAILED", "GitHub user lookup failed.");
  }

  const user = (await userResponse.json().catch(() => null)) as {
    login?: string;
  } | null;

  if (
    !user?.login ||
    !splitList(env.ALLOWED_USERS).includes(user.login.toLowerCase())
  ) {
    return fail("UNAUTHORIZED_USER", "This GitHub user is not allowed.");
  }

  return outputHtml({ token });
}

export default {
  async fetch(request: Request, env: CmsAuthEnv) {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/auth") {
      return handleAuth(request, env);
    }

    if (request.method === "GET" && pathname === "/callback") {
      return handleCallback(request, env);
    }

    return new Response(null, { status: 404 });
  },
};
```

- [ ] **Step 5: Add reproducible Worker configuration**

Create `workers/cms-auth/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "kyrie-dev-cms-auth",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-16",
  "vars": {
    "ALLOWED_DOMAINS": "healerlord.github.io",
    "ALLOWED_USERS": "healerlord"
  }
}
```

Create `workers/cms-auth/README.md` with this exact operational contract:

```markdown
# KYRIE.DEV CMS Auth

GitHub OAuth Worker for the private writing admin. The flow is derived from
Sveltia CMS Authenticator revision
`5de9b9785fd4fb1a58776dc4912aaf252ddc5f3d` (MIT), with GitHub-only routing,
least-privilege public-repository scopes, and a `healerlord` allowlist.

Required Worker secrets:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Set them with:

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config workers/cms-auth/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config workers/cms-auth/wrangler.jsonc
```

The GitHub OAuth App callback is the deployed Worker URL followed by `/callback`.
No OAuth value belongs in the repository or generated site.
```

- [ ] **Step 6: Run Worker tests and static analysis**

Run:

```bash
pnpm exec vitest run tests/cms-auth.test.ts
pnpm exec wrangler deploy --dry-run --config workers/cms-auth/wrangler.jsonc
pnpm check
```

Expected: all Worker tests pass, Wrangler bundles the Worker without deploying it, and Astro reports zero diagnostics.

- [ ] **Step 7: Commit the OAuth Worker**

```bash
git add package.json pnpm-lock.yaml workers/cms-auth tests/cms-auth.test.ts
git commit -m "feat: add restricted CMS OAuth worker"
```

### Task 4: Wire Deployment And Owner Operations

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`
- Create: `docs/online-writing-setup.md`
- Modify: `tests/github-output.test.ts`

- [ ] **Step 1: Make the Pages build require the Worker URL**

Add the environment and validation step to the `build` job in `.github/workflows/deploy.yml`:

```yaml
  build:
    runs-on: ubuntu-latest
    env:
      CMS_AUTH_URL: ${{ vars.CMS_AUTH_URL }}
    steps:
      - name: Verify CMS auth configuration
        run: |
          if [ -z "$CMS_AUTH_URL" ]; then
            echo "::error::Set the CMS_AUTH_URL repository variable before deploying."
            exit 1
          fi
      - name: Checkout repository
        uses: actions/checkout@v7
```

Keep the existing Astro build and Pages deploy steps after these lines.

- [ ] **Step 2: Add a credential-leak regression assertion**

Extend the GitHub admin output test:

```ts
expect(config).not.toMatch(/client[_-]?secret/i);
expect(config).not.toMatch(/github_pat_/i);
expect(html).not.toMatch(/client[_-]?secret/i);
```

- [ ] **Step 3: Write the external setup runbook**

Create `docs/online-writing-setup.md` with these sections and values:

```markdown
# 在线写作后台配置

## 1. 部署认证 Worker

1. 登录 Cloudflare，创建免费 Workers 账户。
2. 在本仓库执行 `pnpm exec wrangler login --use-keyring`。
3. 执行 `pnpm cms:auth:deploy`，记录输出的 `workers.dev` HTTPS 地址。

## 2. 创建 GitHub OAuth App

打开 `https://github.com/settings/applications/new`：

- Application name: `KYRIE.DEV Writing Admin`
- Homepage URL: `https://healerlord.github.io/tech-blog/admin/`
- Authorization callback URL: Worker HTTPS 地址后加 `/callback`

生成 Client Secret 后，不要把它写进本仓库。

## 3. 配置 Worker Secrets

执行：

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config workers/cms-auth/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config workers/cms-auth/wrangler.jsonc
pnpm cms:auth:deploy
```

## 4. 配置 GitHub Actions

在 `healerlord/tech-blog` 的 `Settings -> Secrets and variables -> Actions -> Variables`
中新建 `CMS_AUTH_URL`，值为 Worker HTTPS 地址，不带末尾 `/`。

## 5. 验证闭环

访问 `https://healerlord.github.io/tech-blog/admin/`，使用 `healerlord`
登录。新建文章时保持“保存为草稿”为开启状态；确认公开站点看不到草稿后，
关闭该开关并保存，等待 Pages 工作流完成。

## 故障恢复

- Worker 故障：使用 GitHub 网页编辑器修改 `src/data/blog`。
- OAuth 泄露：在 GitHub 删除 OAuth App Secret，并在 Cloudflare 删除对应 Secret。
- 发布失败：查看 Actions 日志，修复 Markdown frontmatter 后重新提交。
- 误发布：把对应文章的 `draft` 改回 `true` 并提交。
```

- [ ] **Step 4: Link the runbook from README**

Add an `在线写作` section after `管理专题`:

```markdown
## 在线写作

部署完成后，从 `/tech-blog/admin/` 登录写作后台。文章仍以 Markdown
保存在 GitHub；草稿使用 `draft: true`，发布会触发现有 Pages 工作流。

首次启用需要配置免费的 Cloudflare OAuth Worker，参见
[`docs/online-writing-setup.md`](docs/online-writing-setup.md)。
```

- [ ] **Step 5: Run deployment-facing tests**

Run:

```bash
pnpm test:github
pnpm exec vitest run tests/cms-auth.test.ts
git diff --check
```

Expected: the Pages build uses the repository base path and OAuth URL, Worker tests pass, and Git reports no whitespace errors.

- [ ] **Step 6: Commit deployment documentation**

```bash
git add .github/workflows/deploy.yml README.md docs/online-writing-setup.md tests/github-output.test.ts
git commit -m "docs: add writing admin deployment runbook"
```

### Task 5: End-To-End Verification

**Files:**
- Modify only if a verification failure exposes a defect in the files above.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
pnpm test
pnpm check
git diff --check
```

Expected: all unit, local-output, and GitHub-output tests pass; Astro reports zero errors, warnings, and hints; Git reports no whitespace errors.

- [ ] **Step 2: Start local admin and Worker previews**

In separate terminals run:

```bash
CMS_AUTH_URL=http://127.0.0.1:8787 pnpm dev
pnpm cms:auth:dev
```

Expected: the blog starts on `http://127.0.0.1:4321` and the Worker starts on `http://127.0.0.1:8787`.

- [ ] **Step 3: Verify the admin route visually**

Open `http://127.0.0.1:4321/admin/` at 1440 x 900, 390 x 844, and 320 x 568. Confirm:

- the CMS loads rather than a blank page;
- the login controls fit without horizontal scrolling;
- the page exposes no public-site header or navigation;
- the generated `config.yml` loads successfully;
- no console error indicates a blocked self-hosted script or missing base path.

- [ ] **Step 4: Verify the production static artifact**

Run:

```bash
CMS_AUTH_URL=https://cms-auth.example.workers.dev GITHUB_ACTIONS=true pnpm build
```

Inspect `dist/admin/index.html` and `dist/admin/config.yml`. Expected:

- asset URLs start with `/tech-blog/`;
- `site_url` is `https://healerlord.github.io/tech-blog/`;
- `base_url` is the test Worker URL;
- OAuth is the only production auth method;
- no token or client secret appears in `dist`.

- [ ] **Step 5: Confirm the branch is ready for external activation**

Run:

```bash
git status --short --branch
git log -5 --oneline
```

Expected: the worktree is clean on `feature/blog-v1`, and the content, admin, Worker, and runbook commits are present. OAuth login itself remains a documented manual verification until the owner creates the Cloudflare Worker and GitHub OAuth App.
