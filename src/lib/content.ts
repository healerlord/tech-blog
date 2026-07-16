import { getCollection, type CollectionEntry } from "astro:content";

import {
  assertPostIdentity,
  calculateReadingMinutes,
  filterPublishedPosts,
  selectHomepagePosts,
  sortPostsNewestFirst,
} from "./posts";

export type BlogPost = CollectionEntry<"blog"> & {
  readingMinutes: number;
};

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

export async function getHomepagePosts(): Promise<{
  featured: BlogPost;
  recent: BlogPost[];
}> {
  const posts = await getPublishedPosts();
  return selectHomepagePosts(posts, 4);
}
