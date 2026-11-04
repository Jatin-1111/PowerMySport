import api from "@/lib/api/client";

/**
 * The client app's second call into the community API (see community.ts for
 * the first). Reads only — this app never writes an Experience, it only
 * shows a summary of what parents have written on the community side and
 * links out to the community app to write one.
 */

export type ExperienceSubjectKind =
  "TOURNAMENT" | "TOURNAMENT_EDITION" | "VENUE" | "ACADEMY" | "COACH" | "EXPERT";

export interface ExperienceSubjectSummary {
  count: number;
  signals: Partial<Record<string, { good: number; okay: number; poor: number }>>;
  recent: Array<{ id: string; excerpt: string; createdAt: string; authorName: string | null }>;
}

export const experiencesApi = {
  /**
   * The "Parent experiences" band's data. Public on the server
   * (optionalAuthMiddleware) — no gating here either.
   */
  async getSubjectSummary(
    kind: ExperienceSubjectKind,
    refId: string
  ): Promise<ExperienceSubjectSummary> {
    const response = await api.get("/community/experiences/subjects/summary", {
      params: { kind, refId },
    });
    return response.data.data;
  },
};
