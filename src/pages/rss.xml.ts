import rss from "@astrojs/rss";
import type { APIContext } from "astro";

import { getPublishedPosts } from "../lib/content";
import { joinBase } from "../lib/urls";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const base = import.meta.env.BASE_URL;

  return rss({
    title: "KYRIE.DEV",
    description: "Java、AI 工程与系统设计实践。",
    site: context.site ?? new URL("http://localhost:4321"),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: joinBase(base, `articles/${post.id}/`),
      categories: post.data.tags,
    })),
  });
}
