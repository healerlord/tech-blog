import { describe, expect, it } from "vitest";

import {
  createGithubWriteClient,
  decodeBase64Utf8,
  encodeBase64Utf8,
  GithubWriteError,
  type GithubWriteConfig,
} from "../src/lib/write-github";

const CONFIG: GithubWriteConfig = {
  apiBase: "https://api.example.com",
  repo: "healerlord/tech-blog",
  branch: "main",
  blogDir: "src/data/blog",
  uploadsDir: "public/uploads",
};

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function makeFetch(
  routes: Record<string, { status: number; body: unknown } | undefined>,
) {
  const requests: RecordedRequest[] = [];
  const fetchImpl = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => {
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: init?.headers ?? {},
      body: init?.body ? JSON.parse(init.body) : undefined,
    });
    const route = routes[`${init?.method ?? "GET"} ${url}`];
    if (!route) {
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => "",
      };
    }
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => route.body,
      text: async () => String(route.body),
    };
  };
  return { fetchImpl, requests };
}

describe("github write client", () => {
  it("round-trips UTF-8 content through base64", () => {
    const text = '---\ntitle: "编排的边界"\n---\n\n正文 **加粗**。\n';
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text);
  });

  it("lists markdown files with raw content and caches blob shas", async () => {
    const { fetchImpl, requests } = makeFetch({
      "GET https://api.example.com/repos/healerlord/tech-blog/contents/src/data/blog?ref=main":
        {
          status: 200,
          body: [
            { name: "a.md", sha: "sha-a", type: "file" },
            { name: "note.txt", sha: "sha-t", type: "file" },
          ],
        },
      "GET https://api.example.com/repos/healerlord/tech-blog/contents/src/data/blog/a.md?ref=main":
        { status: 200, body: "raw-content-a" },
    });
    const client = createGithubWriteClient(fetchImpl, CONFIG, "token-1");

    const files = await client.listMarkdownFiles();

    expect(files).toEqual([{ name: "a.md", raw: "raw-content-a" }]);
    const rawRequest = requests.find((request) =>
      request.url.includes("a.md"),
    );
    expect(rawRequest?.headers.Accept).toBe("application/vnd.github.raw+json");
    expect(rawRequest?.headers.Authorization).toBe("Bearer token-1");
  });

  it("saves an existing file with the cached sha and updates it", async () => {
    const path = "src/data/blog/a.md";
    const { fetchImpl, requests } = makeFetch({
      [`GET https://api.example.com/repos/healerlord/tech-blog/contents/${path}?ref=main`]:
        {
          status: 200,
          body: { sha: "sha-old", content: encodeBase64Utf8("old") },
        },
      [`PUT https://api.example.com/repos/healerlord/tech-blog/contents/${path}`]:
        { status: 200, body: { content: { sha: "sha-new" } } },
    });
    const client = createGithubWriteClient(fetchImpl, CONFIG, "token-1");

    await client.saveFile(path, "新内容\n", "content: update a");

    const put = requests.find((request) => request.method === "PUT");
    expect(put?.body).toMatchObject({
      message: "content: update a",
      branch: "main",
      sha: "sha-old",
      content: encodeBase64Utf8("新内容\n"),
    });
  });

  it("maps a 409 response to a conflict error", async () => {
    const path = "src/data/blog/a.md";
    const { fetchImpl } = makeFetch({
      [`GET https://api.example.com/repos/healerlord/tech-blog/contents/${path}?ref=main`]:
        {
          status: 200,
          body: { sha: "sha-old", content: encodeBase64Utf8("old") },
        },
      [`PUT https://api.example.com/repos/healerlord/tech-blog/contents/${path}`]:
        { status: 409, body: {} },
    });
    const client = createGithubWriteClient(fetchImpl, CONFIG, "token-1");

    await expect(
      client.saveFile(path, "x", "content: update a"),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  it("creates a new file without a sha and maps 422 to exists", async () => {
    const path = "src/data/blog/new.md";
    const { fetchImpl, requests } = makeFetch({
      [`PUT https://api.example.com/repos/healerlord/tech-blog/contents/${path}`]:
        { status: 201, body: { content: { sha: "sha-1" } } },
    });
    const client = createGithubWriteClient(fetchImpl, CONFIG, "token-1");

    await client.createFile(path, "内容", "content: create new");
    const put = requests.find((request) => request.method === "PUT");
    expect(put?.body).not.toHaveProperty("sha");

    const { fetchImpl: conflictFetch } = makeFetch({
      [`PUT https://api.example.com/repos/healerlord/tech-blog/contents/${path}`]:
        { status: 422, body: {} },
    });
    const conflictClient = createGithubWriteClient(
      conflictFetch,
      CONFIG,
      "token-1",
    );
    await expect(
      conflictClient.createFile(path, "内容", "content: create new"),
    ).rejects.toMatchObject({ kind: "exists" });
  });

  it("maps auth failures and network failures to typed errors", async () => {
    const { fetchImpl } = makeFetch({
      "GET https://api.example.com/repos/healerlord/tech-blog": {
        status: 401,
        body: {},
      },
    });
    const client = createGithubWriteClient(fetchImpl, CONFIG, "bad-token");
    await expect(client.verifyAccess()).rejects.toMatchObject({
      kind: "auth",
    });

    const failingFetch = async () => {
      throw new Error("offline");
    };
    const offline = createGithubWriteClient(
      failingFetch as never,
      CONFIG,
      "token",
    );
    await expect(offline.verifyAccess()).rejects.toMatchObject({
      kind: "network",
    });
    await expect(offline.verifyAccess()).rejects.toBeInstanceOf(
      GithubWriteError,
    );
  });
});
