# Topic Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the topic index concise while providing stable, paginated topic archives that remain usable as article counts grow.

**Architecture:** A central topic catalog owns display names, stable slugs, and descriptions. Pure helpers group already-sorted posts and paginate them; the overview and generated topic routes consume the same groups. Astro's rest-parameter route produces `/topics/<slug>/` and `/topics/<slug>/<page>/` without runtime code.

**Tech Stack:** Astro 7, TypeScript, Vitest, static content collections

---

## Task 1: Topic Catalog And Pure Pagination

**Files:**
- Create: `src/data/topics.ts`
- Create: `src/lib/topics.ts`
- Create: `tests/topics.test.ts`

- [ ] **Step 1: Write failing grouping and pagination tests**

```ts
expect(buildTopicGroups(posts, definitions)[0]).toMatchObject({
  name: "Java",
  slug: "java",
  posts: [{ id: "new" }, { id: "old" }],
});
expect(paginateTopic(group, 1)).toHaveLength(2);
```

- [ ] **Step 2: Run `pnpm exec vitest run tests/topics.test.ts`**

Expected: FAIL because `src/lib/topics.ts` does not exist.

- [ ] **Step 3: Add the catalog and minimal pure helpers**

```ts
export function buildTopicGroups<T extends TaggedPost>(posts: readonly T[], definitions: readonly TopicDefinition[]) {
  return definitions
    .map((definition) => ({ ...definition, posts: posts.filter((post) => post.data.tags.includes(definition.name)) }))
    .filter((topic) => topic.posts.length > 0);
}

export function paginateTopic<T>(topic: TopicGroup<T>, pageSize: number) {
  return Array.from({ length: Math.ceil(topic.posts.length / pageSize) }, (_, index) => ({
    ...topic,
    page: index + 1,
    pageCount: Math.ceil(topic.posts.length / pageSize),
    posts: topic.posts.slice(index * pageSize, (index + 1) * pageSize),
  }));
}
```

- [ ] **Step 4: Run tests and commit**

Expected: topic tests pass without mutating post order.

## Task 2: Concise Overview And Generated Topic Pages

**Files:**
- Modify: `src/pages/topics/index.astro`
- Create: `src/pages/topics/[...path].astro`
- Create: `src/components/Pagination.astro`
- Modify: `src/components/PostList.astro`
- Modify: `tests/site-output.test.ts`

- [ ] **Step 1: Add failing output assertions**

```ts
expect(await readFile("dist/topics/java/index.html", "utf8")).toContain("Java");
expect(await readFile("dist/topics/index.html", "utf8")).toContain("查看全部");
```

- [ ] **Step 2: Run `pnpm test:site`**

Expected: FAIL because the Java topic archive does not exist.

- [ ] **Step 3: Limit overview previews**

Render at most four recent article links per topic, retain the total count, and link the topic heading plus `查看全部 N 篇` to its stable archive URL.

- [ ] **Step 4: Generate topic archive pages**

Use `[...path].astro` static paths. Page one uses `java`; later pages use `java/2`, `java/3`, and so on. Each page renders `PostList` and a pagination navigation when `pageCount > 1`.

- [ ] **Step 5: Add overflow protection**

Apply `overflow-wrap: anywhere` to topic preview links and article-row titles so long unbroken English identifiers cannot create horizontal scrolling.

- [ ] **Step 6: Run `pnpm test:site`, `pnpm test:github`, and `pnpm check`**

Expected: all output tests pass and Astro reports zero diagnostics.

## Task 3: Documentation And Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-technical-blog-homepage-design.md`
- Modify: `README.md`

- [ ] **Step 1: Document topic behavior**

Specify four overview previews, stable slugs, twenty posts per archive page, and generated pagination routes.

- [ ] **Step 2: Run full verification**

```bash
pnpm test
pnpm check
git diff --check
```

Expected: all unit and build-output tests pass, Astro has zero diagnostics, and Git reports no whitespace errors.
