import { getCollection, type CollectionEntry } from "astro:content";

import {
  calculateReadingMinutes,
  selectHomepagePosts,
  sortPostsNewestFirst,
} from "./posts";

export type BlogPost = CollectionEntry<"blog"> & {
  readingMinutes: number;
};

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  const posts = entries.map((entry) => ({
    ...entry,
    readingMinutes: calculateReadingMinutes(entry.body ?? ""),
  }));

  return sortPostsNewestFirst(posts);
}

export async function getHomepagePosts(): Promise<{
  featured: BlogPost;
  recent: BlogPost[];
}> {
  const posts = await getPublishedPosts();
  return selectHomepagePosts(posts, 4);
}
