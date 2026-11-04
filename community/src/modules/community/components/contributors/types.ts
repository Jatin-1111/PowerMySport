import type { CommunityLeaderboardEntry } from "@/modules/community/types";

/** The leaderboard row shape is the server's response entry — kept as an alias
 *  so the components below do not each import from the API type module. */
export type LeaderboardItem = CommunityLeaderboardEntry;
