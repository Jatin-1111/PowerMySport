import {
  BlogPost,
} from "../models/BlogPost";
import {
  CommunityPost,
} from "../models/CommunityPost";
import {
  clampForSnippet,
  stripHtml,
} from "./communityShared";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("communitySearch");

/**
 * One text search across questions and published stories.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communitySearchService = {
  /**
   * One search across questions and stories.
   *
   * Both collections carry a text index, so this is `$text` with a relevance
   * score rather than a regex scan — the two are not interchangeable: text
   * search matches whole stemmed words ("coaching" finds "coach"), while a
   * regex matches substrings but reads every document.
   *
   * Scores from two separate text indexes are not on a comparable scale, so
   * they are normalized per collection before merging. Without that the side
   * with longer documents wins every time regardless of relevance.
   */
  async searchCommunity(
    userId: string | undefined,
    query: string,
    options?: { type?: "ALL" | "POST" | "BLOG"; limit?: number },
  ) {
    const term = (query || "").trim();
    if (term.length < 2) {
      return { items: [], query: term };
    }

    const type = options?.type || "ALL";
    const safeLimit = Math.min(50, Math.max(1, options?.limit || 20));
    // Over-fetch each side so the merge has something to choose between; the
    // combined list is trimmed back to safeLimit at the end.
    const perSide = safeLimit;

    const wantPosts = type === "ALL" || type === "POST";
    const wantBlogs = type === "ALL" || type === "BLOG";

    /**
     * A `$text` query against a collection with no text index does not degrade
     * to a scan — MongoDB rejects it outright. Both halves run in one
     * Promise.all, so an unbuilt or mid-rebuild index on either collection
     * would take down the whole search endpoint rather than the half that
     * cannot answer. Each side therefore fails to an empty result and says so
     * in the log, which is the difference between "no stories matched" and a
     * 500.
     */
    const searchSide = async <T>(
      label: string,
      run: () => Promise<T[]>,
    ): Promise<T[]> => {
      try {
        return await run();
      } catch (error) {
        log.error(`Community search: ${label} half failed`, error);
        return [];
      }
    };

    const [posts, blogs] = await Promise.all([
      wantPosts
        ? searchSide("questions", () =>
            CommunityPost.find(
              {
                $text: { $search: term },
                isDeleted: false,
                status: { $in: ["OPEN", "CLOSED"] },
              },
              { score: { $meta: "textScore" } },
            )
              .sort({ score: { $meta: "textScore" } })
              .limit(perSide)
              .lean(),
          )
        : Promise.resolve([]),
      wantBlogs
        ? searchSide("stories", () =>
            BlogPost.find(
              {
                $text: { $search: term },
                isDeleted: false,
                status: "PUBLISHED",
              },
              { score: { $meta: "textScore" } },
            )
              .sort({ score: { $meta: "textScore" } })
              .limit(perSide)
              .lean(),
          )
        : Promise.resolve([]),
    ]);

    // Lean() results do not carry the projected `score` in their type, so it is
    // read through a narrow cast rather than widening the row types.
    const scoreOf = (row: unknown): number =>
      (row as { score?: number })?.score || 0;

    const normalize = <T>(rows: T[]): { row: T; relevance: number }[] => {
      const top = scoreOf(rows[0]);
      return rows.map((row) => ({
        row,
        relevance: top > 0 ? scoreOf(row) / top : 0,
      }));
    };

    const postItems = normalize(posts).map(({ row, relevance }) => ({
      kind: "POST" as const,
      id: String(row._id),
      title: row.title,
      snippet: clampForSnippet(row.body),
      href: `/questions/${String(row._id)}`,
      sport: row.sport || "",
      tags: row.tags || [],
      answerCount: row.answerCount || 0,
      isSolved: Boolean(row.acceptedAnswerId),
      createdAt: row.createdAt,
      relevance,
    }));

    const blogItems = normalize(blogs).map(({ row, relevance }) => ({
      kind: "BLOG" as const,
      id: String(row._id),
      title: row.title,
      snippet: clampForSnippet(row.excerpt || stripHtml(row.content || "")),
      href: `/blog/${String(row._id)}`,
      sport: "",
      tags: row.tags || [],
      answerCount: 0,
      isSolved: false,
      createdAt: row.createdAt,
      relevance,
    }));

    const items = [...postItems, ...blogItems]
      .sort((a, b) => {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
        // Equally relevant: the fresher one first.
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(0, safeLimit);

    return { items, query: term };
  },

  // ─── Follows ────────────────────────────────────────────────────────────────
  // Replaces a localStorage-only store, so these are deliberately forgiving:
  // the same follow arriving twice is a no-op rather than an error, and a
  // follow whose group has since been deleted is cleaned up on read instead of
  // being surfaced as a broken row.,
};
