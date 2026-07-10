export type LeaderboardItem = {
  id: string;
  name: string;
  photoUrl?: string | null;
  rank: number;
  posts: number;
  answers: number;
  upvotes: number;
  score: number;
};
