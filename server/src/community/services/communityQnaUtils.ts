export const normalizeTags = (tags: string[] = []): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of tags) {
    const tag = item.trim().toLowerCase();
    if (!tag || tag.length > 40 || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length >= 8) {
      break;
    }
  }

  return normalized;
};

export const getVoteTransitionDeltas = (
  previousVote: 1 | -1 | null,
  nextVote: 1 | -1 | null,
) => {
  let upvoteCount = 0;
  let downvoteCount = 0;

  if (previousVote === 1) {
    upvoteCount -= 1;
  } else if (previousVote === -1) {
    downvoteCount -= 1;
  }

  if (nextVote === 1) {
    upvoteCount += 1;
  } else if (nextVote === -1) {
    downvoteCount += 1;
  }

  return {
    upvoteCount,
    downvoteCount,
    voteScore: upvoteCount - downvoteCount,
  };
};
