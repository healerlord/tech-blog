import type { TopicDefinition } from "../data/topics";

export const TOPIC_PAGE_SIZE = 20;

interface TaggedPost {
  data: {
    tags: readonly string[];
  };
}

export interface TopicGroup<T> extends TopicDefinition {
  posts: T[];
}

export interface TopicPage<T> extends TopicGroup<T> {
  page: number;
  pageCount: number;
  totalPosts: number;
}

export function topicPagePath(slug: string, page: number): string {
  if (!Number.isInteger(page) || page <= 0) {
    throw new Error("Topic page must be greater than zero");
  }

  return page === 1 ? slug : `${slug}/${page}`;
}

export function buildTopicGroups<T extends TaggedPost>(
  posts: readonly T[],
  definitions: readonly TopicDefinition[],
): TopicGroup<T>[] {
  return definitions
    .map((definition) => ({
      ...definition,
      posts: posts.filter((post) => post.data.tags.includes(definition.name)),
    }))
    .filter((topic) => topic.posts.length > 0);
}

export function paginateTopic<T>(
  topic: TopicGroup<T>,
  pageSize: number,
): TopicPage<T>[] {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("Topic page size must be greater than zero");
  }

  const pageCount = Math.ceil(topic.posts.length / pageSize);

  return Array.from({ length: pageCount }, (_, index) => ({
    ...topic,
    page: index + 1,
    pageCount,
    totalPosts: topic.posts.length,
    posts: topic.posts.slice(index * pageSize, (index + 1) * pageSize),
  }));
}
