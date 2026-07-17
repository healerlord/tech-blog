import {
  isValidSlug,
  parsePostFile,
  serializePostFile,
  summarizePosts,
  validatePost,
  type PostDocument,
  type PostFrontmatter,
} from "./write-store";

export interface WriteApiIo {
  listPosts(): Promise<{ name: string; raw: string }[]>;
  readPost(slug: string): Promise<string | null>;
  writePost(slug: string, content: string): Promise<void>;
  writeAsset(name: string, data: Uint8Array): Promise<void>;
}

export interface WriteApiResponse {
  status: number;
  body: Record<string, unknown>;
}

export const ASSET_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

function json(status: number, body: Record<string, unknown>): WriteApiResponse {
  return { status, body };
}

function errors(
  status: number,
  issues: { field: string; message: string }[],
): WriteApiResponse {
  return json(status, { errors: issues });
}

function parseDocumentPayload(rawBody: string): PostDocument | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const { frontmatter, body } = payload as {
    frontmatter?: unknown;
    body?: unknown;
  };
  if (typeof frontmatter !== "object" || frontmatter === null) {
    return null;
  }
  return {
    frontmatter: frontmatter as PostFrontmatter,
    body: typeof body === "string" ? body : "",
  };
}

async function savePost(
  io: WriteApiIo,
  slug: string,
  document: PostDocument,
  { mustExist }: { mustExist: boolean },
): Promise<WriteApiResponse> {
  if (!isValidSlug(slug)) {
    return errors(400, [
      { field: "slug", message: "Slug 只能使用小写英文、数字和单个连字符" },
    ]);
  }
  if (document.frontmatter.slug !== slug) {
    return errors(400, [
      { field: "slug", message: "发布后 slug 不可修改" },
    ]);
  }

  const existing = await io.readPost(slug);
  if (mustExist && existing === null) {
    return json(404, { error: "post not found" });
  }
  if (!mustExist && existing !== null) {
    return json(409, { error: "post already exists" });
  }

  const issues = validatePost(document);
  if (issues.length > 0) {
    return errors(400, issues);
  }

  const content = serializePostFile(document);
  await io.writePost(slug, content);
  return json(mustExist ? 200 : 201, { post: parsePostFile(content) });
}

async function saveAsset(
  io: WriteApiIo,
  rawBody: string,
): Promise<WriteApiResponse> {
  let payload: { name?: unknown; dataBase64?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid json body" });
  }

  const name = typeof payload.name === "string" ? payload.name : "";
  if (!ASSET_NAME_PATTERN.test(name) || name.includes("..")) {
    return errors(400, [
      { field: "name", message: "文件名只能使用小写英文、数字、点、连字符" },
    ]);
  }

  const dataBase64 =
    typeof payload.dataBase64 === "string" ? payload.dataBase64 : "";
  let data: Uint8Array;
  try {
    data = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
  } catch {
    return json(400, { error: "invalid base64 data" });
  }
  if (data.length === 0 || data.length > MAX_ASSET_BYTES) {
    return errors(400, [
      { field: "dataBase64", message: "文件为空或超过 8MB 上限" },
    ]);
  }

  await io.writeAsset(name, data);
  return json(201, { url: `/uploads/${name}` });
}

export async function handleWriteApi(
  io: WriteApiIo,
  method: string,
  subpath: string,
  rawBody: string,
): Promise<WriteApiResponse> {
  const segments = subpath.replace(/^\/+|\/+$/g, "").split("/");

  if (segments[0] === "posts" && segments.length === 1) {
    if (method === "GET") {
      return json(200, { posts: summarizePosts(await io.listPosts()) });
    }
    if (method === "POST") {
      const document = parseDocumentPayload(rawBody);
      if (!document) {
        return json(400, { error: "invalid json body" });
      }
      return savePost(io, document.frontmatter.slug ?? "", document, {
        mustExist: false,
      });
    }
    return json(405, { error: "method not allowed" });
  }

  if (segments[0] === "posts" && segments.length === 2) {
    const slug = segments[1];
    if (!isValidSlug(slug)) {
      return json(404, { error: "post not found" });
    }
    if (method === "GET") {
      const raw = await io.readPost(slug);
      if (raw === null) {
        return json(404, { error: "post not found" });
      }
      return json(200, { post: parsePostFile(raw) });
    }
    if (method === "PUT") {
      const document = parseDocumentPayload(rawBody);
      if (!document) {
        return json(400, { error: "invalid json body" });
      }
      return savePost(io, slug, document, { mustExist: true });
    }
    return json(405, { error: "method not allowed" });
  }

  if (segments[0] === "assets" && segments.length === 1) {
    if (method === "POST") {
      return saveAsset(io, rawBody);
    }
    return json(405, { error: "method not allowed" });
  }

  return json(404, { error: "not found" });
}
