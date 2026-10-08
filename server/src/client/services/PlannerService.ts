import {
  annualEntryCap,
  buildShortlist,
  placeInAgeGroup,
  type PlannerEdition,
  type PlannerOfficialDetails,
  type Shortlist,
} from "@powermysport/shared-types";
import { TournamentEdition } from "../../shared/models/TournamentEdition";
import { Player } from "../models/Player";
import { RankingClaimService } from "./RankingClaimService";
import { SeasonPlanService } from "./SeasonPlanService";

/**
 * One child's planner: the events they can enter, judged by the shared rules,
 * next to the plan they have already made.
 *
 * ── Why this exists as one function ─────────────────────────────────────────
 * The planner page and the assistant chat must tell a parent the same thing. If
 * each assembled its own list, the page would say an event is closed to a child
 * while the chat recommended it, which is the failure this feature was scoped to
 * prevent. So there is exactly one place that turns (parent, child) into a set
 * of verdicts, and both surfaces call it.
 *
 * The verdicts themselves come from `buildShortlist` in `shared-types`, the same
 * module the website runs. This file only gathers the inputs: which list the
 * child is ranked in, and which events are still ahead.
 *
 * ── What it does not do ─────────────────────────────────────────────────────
 * It does not rank or recommend. "Open to enter" is a rule result, not advice;
 * ordering and reasoning belong to a later layer that reads this output and may
 * only choose among the events returned here.
 */

export type PlannerLinkState =
  /** A verified ranking link with a junior standing: the verdicts are real. */
  | "ready"
  /** No link yet. The page offers to link one; there is nothing to judge. */
  | "not-linked"
  /** Linked, but on no junior list, so there is no bracket or rank to judge against. */
  | "no-junior-standing";

export interface PlannerStanding {
  category: string;
  /** The age group they play in, from their birth year. */
  subcategory: string;
  /** Their rank in that age group's own list. Null if they are not ranked there yet. */
  rank: number | null;
  totalPoints: number | null;
  /** The other junior lists they are ranked in (a child who plays up), youngest first. */
  alsoRanked: Array<{ subcategory: string; rank: number }>;
  /** The state the player is registered in, when the list records one. */
  state: string | null;
  asOnDate: Date;
}

export interface PlannerOverview {
  dependentId: string;
  dependentName: string;
  sportSlug: string;
  linkState: PlannerLinkState;
  standing: PlannerStanding | null;
  /** Yearly entry allowance for the bracket, or null where AITA states none. */
  annualEntryCap: number | null;
  /** Null until there is a standing to judge against. */
  shortlist: Shortlist | null;
  plan: Awaited<ReturnType<typeof SeasonPlanService.get>>;
  /** How many editions were judged, so "nothing open" can be told from "nothing published". */
  editionsConsidered: number;
}

/**
 * The calendar's horizon, not a page size. The whole upcoming tennis calendar is
 * under fifty rows, so one read holds it and the rules run in memory.
 */
const UPCOMING_LIMIT = 100;

const EDITION_FIELDS =
  "slug name startDate endDate city state venue registrationDeadlineDate ageGroups ladder grade kind " +
  "externalId detailUrl lastCheckedAt entryOpensDate withdrawalDeadlineDate freezeDeadlineDate " +
  "deadlineTimes feeSingles feeDoubles dailyAllowance surface qualifyingStartDate mainDrawStartDate " +
  "officialDetailsSource";

type EditionRow = {
  slug?: string;
  name: string;
  startDate: Date;
  endDate?: Date;
  city?: string;
  state?: string;
  venue?: string;
  registrationDeadlineDate?: Date;
  ageGroups?: string[];
  ladder?: string;
  grade?: number;
  kind?: string;
  externalId?: string;
  detailUrl?: string;
  lastCheckedAt?: Date;
  entryOpensDate?: Date;
  withdrawalDeadlineDate?: Date;
  freezeDeadlineDate?: Date;
  deadlineTimes?: { entryCloses?: string; withdrawal?: string; freeze?: string };
  feeSingles?: number;
  feeDoubles?: number;
  dailyAllowance?: number;
  surface?: string;
  qualifyingStartDate?: Date;
  mainDrawStartDate?: Date;
  officialDetailsSource?: "factSheet" | "rules";
};

/** The printed calendar day. Stored at midnight UTC, so the UTC date is the date. */
const day = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * What AITA's pages say, or nothing. Only events read from AITA's calendar carry an
 * `officialDetailsSource`, and only those get a page link: an older row's `detailUrl`
 * is a signed, expiring address on a platform AITA has since left.
 */
const officialOf = (row: EditionRow): PlannerOfficialDetails | undefined => {
  if (!row.officialDetailsSource) return undefined;
  const times = row.deadlineTimes;
  return {
    source: row.officialDetailsSource,
    ...(row.entryOpensDate ? { entryOpens: day(row.entryOpensDate) } : {}),
    ...(row.registrationDeadlineDate ? { entryCloses: day(row.registrationDeadlineDate) } : {}),
    ...(row.withdrawalDeadlineDate ? { withdrawalDeadline: day(row.withdrawalDeadlineDate) } : {}),
    ...(row.freezeDeadlineDate ? { freezeDeadline: day(row.freezeDeadlineDate) } : {}),
    ...(times && Object.keys(times).length > 0 ? { times } : {}),
    ...(typeof row.feeSingles === "number" ? { feeSingles: row.feeSingles } : {}),
    ...(typeof row.feeDoubles === "number" ? { feeDoubles: row.feeDoubles } : {}),
    ...(typeof row.dailyAllowance === "number" ? { dailyAllowance: row.dailyAllowance } : {}),
    ...(row.surface ? { surface: row.surface } : {}),
    ...(row.qualifyingStartDate ? { qualifyingStart: day(row.qualifyingStartDate) } : {}),
    ...(row.mainDrawStartDate ? { mainDrawStart: day(row.mainDrawStartDate) } : {}),
    ...(row.externalId && row.detailUrl ? { pageUrl: row.detailUrl } : {}),
    ...(row.lastCheckedAt ? { checkedAt: row.lastCheckedAt.toISOString() } : {}),
  };
};

const official = (row: EditionRow): { official?: PlannerOfficialDetails } => {
  const details = officialOf(row);
  return details ? { official: details } : {};
};

/**
 * Stored rows to the shape the rules read. Dates become ISO strings because the
 * rules are shared with a browser, and because the same objects are sent as JSON.
 * Absent fields stay absent rather than becoming null, so "the calendar does not
 * say" survives the trip.
 */
export const toPlannerEdition = (row: EditionRow): PlannerEdition => ({
  ...(row.slug ? { slug: row.slug } : {}),
  name: row.name,
  startDate: row.startDate.toISOString(),
  ...(row.endDate ? { endDate: row.endDate.toISOString() } : {}),
  ...(row.city ? { city: row.city } : {}),
  ...(row.state ? { state: row.state } : {}),
  ...(row.venue ? { venue: row.venue } : {}),
  ...(row.registrationDeadlineDate
    ? { registrationDeadlineDate: row.registrationDeadlineDate.toISOString() }
    : {}),
  ...(row.ageGroups?.length ? { ageGroups: row.ageGroups } : {}),
  ...(row.ladder ? { ladder: row.ladder } : {}),
  ...(typeof row.grade === "number" ? { grade: row.grade } : {}),
  ...(row.kind ? { kind: row.kind } : {}),
  ...official(row),
});

/** Editions still ahead, soonest first. Merged duplicates only redirect, so they are skipped. */
const loadUpcoming = async (sportSlug: string): Promise<PlannerEdition[]> => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const rows = await TournamentEdition.find({
    sportSlug,
    startDate: { $gte: startOfToday },
    status: { $ne: "cancelled" },
    mergedInto: { $in: [null, undefined] },
  })
    .select(EDITION_FIELDS)
    .sort({ startDate: 1 })
    .limit(UPCOMING_LIMIT)
    .lean<EditionRow[]>();
  return rows.map(toPlannerEdition);
};

export const PlannerService = {
  /**
   * Throws exactly as `SeasonPlanService.get` does when the child is not this
   * account's, which is the ownership check every route in this feature leans on.
   */
  async forDependent(userId: string, dependentId: string): Promise<PlannerOverview> {
    // Ownership first, and via the plan service so there is one definition of it.
    const plan = await SeasonPlanService.get(userId, dependentId);
    const dependent = await Player.findOne({ _id: dependentId, userId }).select("name").lean();

    const claims = await RankingClaimService.list(userId);
    const claim = claims.find((entry) => entry.dependentId === dependentId) ?? null;
    const sportSlug = claim?.sportSlug ?? plan.sportSlug;
    const base = {
      dependentId,
      dependentName: dependent?.name ?? "",
      sportSlug,
      plan,
    };

    if (!claim) {
      return {
        ...base,
        linkState: "not-linked",
        standing: null,
        annualEntryCap: null,
        shortlist: null,
        editionsConsidered: 0,
      };
    }

    const placement = placeInAgeGroup(claim.standings);
    if (!placement) {
      return {
        ...base,
        linkState: "no-junior-standing",
        standing: null,
        annualEntryCap: null,
        shortlist: null,
        editionsConsidered: 0,
      };
    }

    // Category, home state and list date come from their own list where they are on it,
    // and from the youngest list they are on where they are not.
    const { own, ageGroup, alsoRanked } = placement;
    const source = own ?? alsoRanked[0]!;
    const rank = own?.rank ?? null;

    const editions = await loadUpcoming(sportSlug);
    return {
      ...base,
      linkState: "ready",
      standing: {
        category: source.category,
        subcategory: ageGroup,
        rank,
        totalPoints: own?.totalPoints ?? null,
        alsoRanked: alsoRanked.map((other) => ({
          subcategory: other.subcategory,
          rank: other.rank,
        })),
        state: source.state,
        asOnDate: source.asOnDate,
      },
      annualEntryCap: annualEntryCap(ageGroup),
      shortlist: buildShortlist(editions, { bracket: ageGroup, rank }),
      editionsConsidered: editions.length,
    };
  },
};
