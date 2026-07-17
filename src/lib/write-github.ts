export interface GithubWriteConfig {
  apiBase: string;
  repo: string;
  branch: string;
  blogDir: string;
  uploadsDir: string;
}

export const DEFAULT_GITHUB_WRITE_CONFIG: GithubWriteConfig = {
  apiBase: "https://api.github.com",
  repo: "healerlord/tech-blog",
  branch: "main",
  blogDir: "src/data/blog",
  uploadsDir: "public/uploads",
};

export class GithubWriteError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "conflict" | "exists" | "network" | "other",
  ) {
    super(message);
  }
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export function encodeBase64Utf8(text: string): string {
  return encodeBase64Bytes(new TextEncoder().encode(text));
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface GithubWriteClient {
  verifyAccess(): Promise<void>;
  listMarkdownFiles(): Promise<{ name: string; raw: string }[]>;
  loadFile(path: string): Promise<string>;
  saveFile(path: string, content: string, message: string): Promise<void>;
  createFile(path: string, content: string, message: string): Promise<void>;
  uploadBinary(path: string, data: Uint8Array, message: string): Promise<void>;
  forgetSha(path: string): void;
}

export function createGithubWriteClient(
  fetchImpl: FetchLike,
  config: GithubWriteConfig,
  token: string,
): GithubWriteClient {
  const shaByPath = new Map<string, string>();

  const headers = (accept: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  });

  function contentsUrl(path: string, withRef: boolean): string {
    const base = `${config.apiBase}/repos/${config.repo}/contents/${path}`;
    return withRef ? `${base}?ref=${encodeURIComponent(config.branch)}` : base;
  }

  async function request(
    input: string,
    init?: Parameters<FetchLike>[1],
  ): ReturnType<FetchLike> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await fetchImpl(input, init);
    } catch {
      throw new GithubWriteError("无法连接 GitHub API", "network");
    }
    if (response.status === 401 || response.status === 403) {
      throw new GithubWriteError("GitHub Token 无效或权限不足", "auth");
    }
    return response;
  }

  async function putContent(
    path: string,
    contentBase64: string,
    message: string,
    { mustExist }: { mustExist: boolean },
  ): Promise<void> {
    const sha = shaByPath.get(path);
    if (mustExist && !sha) {
      await loadFileWithSha(path);
    }
    const body: Record<string, string> = {
      message,
      content: contentBase64,
      branch: config.branch,
    };
    const knownSha = shaByPath.get(path);
    if (mustExist && knownSha) {
      body.sha = knownSha;
    }
    const response = await request(contentsUrl(path, false), {
      method: "PUT",
      headers: headers("application/vnd.github+json"),
      body: JSON.stringify(body),
    });
    if (response.status === 409) {
      shaByPath.delete(path);
      throw new GithubWriteError(
        "远端已有更新的提交，请刷新页面后重试",
        "conflict",
      );
    }
    if (response.status === 422 && !mustExist) {
      throw new GithubWriteError("目标文件已存在", "exists");
    }
    if (!response.ok) {
      throw new GithubWriteError(
        `GitHub 保存失败（HTTP ${response.status}）`,
        "other",
      );
    }
    const data = (await response.json()) as { content?: { sha?: string } };
    if (data.content?.sha) {
      shaByPath.set(path, data.content.sha);
    }
  }

  async function loadFileWithSha(path: string): Promise<string> {
    const response = await request(contentsUrl(path, true), {
      headers: headers("application/vnd.github+json"),
    });
    if (!response.ok) {
      throw new GithubWriteError(
        `读取文件失败（HTTP ${response.status}）`,
        "other",
      );
    }
    const data = (await response.json()) as { sha: string; content: string };
    shaByPath.set(path, data.sha);
    return decodeBase64Utf8(data.content);
  }

  return {
    async verifyAccess() {
      const response = await request(
        `${config.apiBase}/repos/${config.repo}`,
        { headers: headers("application/vnd.github+json") },
      );
      if (!response.ok) {
        throw new GithubWriteError(
          `无法访问仓库 ${config.repo}（HTTP ${response.status}）`,
          "other",
        );
      }
    },

    async listMarkdownFiles() {
      const response = await request(contentsUrl(config.blogDir, true), {
        headers: headers("application/vnd.github+json"),
      });
      if (!response.ok) {
        throw new GithubWriteError(
          `读取文章目录失败（HTTP ${response.status}）`,
          "other",
        );
      }
      const entries = (await response.json()) as {
        name: string;
        sha: string;
        type: string;
      }[];
      const files = entries.filter(
        (entry) => entry.type === "file" && entry.name.endsWith(".md"),
      );
      for (const file of files) {
        shaByPath.set(`${config.blogDir}/${file.name}`, file.sha);
      }
      return Promise.all(
        files.map(async (file) => {
          const path = `${config.blogDir}/${file.name}`;
          const raw = await request(contentsUrl(path, true), {
            headers: headers("application/vnd.github.raw+json"),
          });
          if (!raw.ok) {
            throw new GithubWriteError(
              `读取 ${file.name} 失败（HTTP ${raw.status}）`,
              "other",
            );
          }
          return { name: file.name, raw: await raw.text() };
        }),
      );
    },

    loadFile: loadFileWithSha,

    async saveFile(path, content, message) {
      await putContent(path, encodeBase64Utf8(content), message, {
        mustExist: true,
      });
    },

    async createFile(path, content, message) {
      await putContent(path, encodeBase64Utf8(content), message, {
        mustExist: false,
      });
    },

    async uploadBinary(path, data, message) {
      await putContent(path, encodeBase64Bytes(data), message, {
        mustExist: false,
      });
    },

    forgetSha(path) {
      shaByPath.delete(path);
    },
  };
}
