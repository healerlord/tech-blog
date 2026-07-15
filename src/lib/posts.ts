type DatedPost = {
  data: {
    publishedAt: Date;
  };
};

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
