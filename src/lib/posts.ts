type DatedPost = {
  data: {
    publishedAt: Date;
  };
};

type HomepagePost = DatedPost & {
  id: string;
  data: {
    featured: boolean;
    publishedAt: Date;
  };
};

interface DraftPost {
  data: { draft: boolean };
}

interface IdentifiedPost {
  id: string;
  data: { slug: string };
}

export function sortPostsNewestFirst<T extends DatedPost>(
  posts: readonly T[],
): T[] {
  return [...posts].sort(
    (left, right) =>
      right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function calculateReadingMinutes(body: string): number {
  const chineseCharacters = body.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = body.match(/[A-Za-z0-9_]+/g)?.length ?? 0;

  return Math.max(
    1,
    Math.ceil(chineseCharacters / 400 + latinWords / 220),
  );
}

export function selectHomepagePosts<T extends HomepagePost>(
  posts: readonly T[],
  recentCount: number,
): { featured: T; recent: T[] } {
  const sorted = sortPostsNewestFirst(posts);
  const featured = sorted.find((post) => post.data.featured);

  if (!featured) {
    throw new Error("At least one published post must be featured");
  }

  return {
    featured,
    recent: sorted
      .filter((post) => post.id !== featured.id)
      .slice(0, recentCount),
  };
}

export function filterPublishedPosts<T extends DraftPost>(
  posts: readonly T[],
): T[] {
  return posts.filter((post) => !post.data.draft);
}

export function assertPostIdentity<T extends IdentifiedPost>(post: T): T {
  if (post.id !== post.data.slug) {
    throw new Error(
      `Post filename "${post.id}" must match slug "${post.data.slug}"`,
    );
  }

  return post;
}
