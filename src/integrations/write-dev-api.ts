import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { handleWriteApi, type WriteApiIo } from "../lib/write-api";

export const WRITE_API_PREFIX = "/__write/api";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// Saving an article rewrites a content file, which normally makes the dev
// server broadcast a full page reload — wiping the editor state and cursor
// mid-typing. Writes through this API briefly suppress that broadcast; the
// content store still syncs, so other pages pick the change up on their
// next load.
const RELOAD_SUPPRESS_WINDOW_MS = 3000;

interface HotChannelLike {
  send: (...args: unknown[]) => void;
}

function suppressFullReloads(
  channels: HotChannelLike[],
  isSuppressed: () => boolean,
) {
  for (const channel of channels) {
    const originalSend = channel.send.bind(channel);
    channel.send = (...args: unknown[]) => {
      const payload = args[0] as { type?: string } | undefined;
      if (
        isSuppressed() &&
        typeof payload === "object" &&
        payload?.type === "full-reload"
      ) {
        return;
      }
      originalSend(...args);
    };
  }
}

function createFsIo(projectRoot: string, onWrite: () => void): WriteApiIo {
  const blogDir = join(projectRoot, "src", "data", "blog");
  const uploadsDir = join(projectRoot, "public", "uploads");

  return {
    async listPosts() {
      const names = await readdir(blogDir);
      return Promise.all(
        names
          .filter((name) => name.endsWith(".md"))
          .map(async (name) => ({
            name,
            raw: await readFile(join(blogDir, name), "utf8"),
          })),
      );
    },
    async readPost(slug) {
      try {
        return await readFile(join(blogDir, `${slug}.md`), "utf8");
      } catch {
        return null;
      }
    },
    async writePost(slug, content) {
      onWrite();
      await writeFile(join(blogDir, `${slug}.md`), content, "utf8");
    },
    async writeAsset(name, data) {
      onWrite();
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(join(uploadsDir, name), data);
    },
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function writeDevApi(): AstroIntegration {
  return {
    name: "write-dev-api",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
        let suppressUntil = 0;
        const io = createFsIo(projectRoot, () => {
          suppressUntil = Date.now() + RELOAD_SUPPRESS_WINDOW_MS;
        });

        const devServer = server as unknown as {
          hot?: HotChannelLike;
          ws?: HotChannelLike;
          environments?: Record<string, { hot?: HotChannelLike }>;
        };
        const channels: HotChannelLike[] = [];
        if (devServer.hot?.send) {
          channels.push(devServer.hot);
        }
        if (devServer.ws?.send && devServer.ws !== devServer.hot) {
          channels.push(devServer.ws);
        }
        for (const environment of Object.values(
          devServer.environments ?? {},
        )) {
          if (environment.hot?.send && !channels.includes(environment.hot)) {
            channels.push(environment.hot);
          }
        }
        suppressFullReloads(channels, () => Date.now() < suppressUntil);

        server.middlewares.use(
          WRITE_API_PREFIX,
          (req: IncomingMessage, res: ServerResponse) => {
            void (async () => {
              const remote = req.socket.remoteAddress ?? "";
              if (!LOOPBACK_ADDRESSES.has(remote)) {
                res.statusCode = 403;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "local access only" }));
                return;
              }

              const subpath = (req.url ?? "/").split("?")[0];
              const rawBody = await readBody(req);
              const { status, body } = await handleWriteApi(
                io,
                req.method ?? "GET",
                subpath,
                rawBody,
              );

              res.statusCode = status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(body));
            })().catch((error: unknown) => {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: String(error) }));
            });
          },
        );
      },
    },
  };
}
