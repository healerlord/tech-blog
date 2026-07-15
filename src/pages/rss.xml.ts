import rss from "@astrojs/rss";
import type { APIContext } from "astro";

import { getPublishedPosts } from "../lib/content";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: "KYRIE.DEV",
    description: "Java、AI 工程与系统设计实践。",
    site: context.site ?? new URL("http://localhost:4321"),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `articles/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
