import api from "@/lib/api/client";

export interface CommunityInsightPost {
  id: string;
  title: string;
  answerCount: number;
  upvoteCount: number;
  sport?: string;
  city?: string;
  createdAt: string;
}

interface CommunityPostListResponse {
  items?: Array<{
    id: string;
    title: string;
    answerCount: number;
    upvoteCount: number;
    sport?: string;
    city?: string;
    createdAt: string;
  }>;
}

export const communityInsightsService = {
  async listTopInsights(params: {
    q?: string;
    sport?: string;
    city?: string;
    limit?: number;
  }): Promise<CommunityInsightPost[]> {
    const q = params.q?.trim();
    const sport = params.sport?.trim();
    const city = params.city?.trim();

    const response = await api.get("/community/posts", {
      params: {
        page: 1,
        limit: params.limit || 3,
        sort: "TOP",
        ...(q ? { q } : {}),
        ...(sport ? { sport } : {}),
        ...(city ? { city } : {}),
      },
    });

    const payload = response.data?.data as
      | CommunityPostListResponse
      | undefined;
    const items = Array.isArray(payload?.items) ? payload.items : [];

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      answerCount: item.answerCount || 0,
      upvoteCount: item.upvoteCount || 0,
      sport: item.sport,
      city: item.city,
      createdAt: item.createdAt,
    }));
  },
};
