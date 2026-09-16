import mongoose from "mongoose";
import redis from "../../config/redis";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";
import { RankingEntry } from "../../shared/models/RankingEntry";
import { Player } from "../models/Player";
import { PlayerRankingLink, PlayerRankingLinkDocument } from "../models/PlayerRankingLink";

const log = __rootLog.child("rankingClaim");

/**
 * Linking a profile on this platform to a row in a federation ranking list.
 *
 * ── The threat this service is written against ───────────────────────────────
 * The ranking mirror is a searchable database of children: full name, home
 * state, age category and registration number, all of it already public. The
 * one field we hold that is *not* public is the date of birth, which is why it
 * is `select: false` on `RankingEntry`.
 *
 * A claim flow turns that dataset into something new — a way to receive alerts
 * about a specific named child — so the question "who is allowed to claim this
 * row?" is the whole design. The answer here is proof of possession of the one
 * fact a stranger does not have: the exact date of birth.
 *
 * That makes this endpoint an oracle for DOB unless three things are true, and
 * all three are enforced below rather than left to the caller:
 *
 *   1. **One failure message.** "No such registration number" and "wrong date
 *      of birth" are the same response, byte for byte. Distinguishing them
 *      would let an attacker confirm a regNo exists, then walk the DOB space
 *      against a known-good target.
 *   2. **A per-regNo lockout that spans accounts.** A per-user rate limit is
 *      not enough, because the attacker chooses how many accounts to use. The
 *      counter is keyed on the thing being attacked, not on who is attacking.
 *   3. **The DOB is never stored or echoed.** It arrives, it is compared in
 *      memory, it is discarded. Nothing in the response, the link document or
 *      the logs contains it.
 *
 * ── Fail-open, deliberately ──────────────────────────────────────────────────
 * The lockout counter lives in Redis and fails open, matching `middleware/
 * rateLimit.ts` and the auth middleware's caches. A Redis outage should not
 * stop a parent linking their child; the route-level limiter is the second
 * layer, and an attacker who needs Redis to be down to get their attempts is
 * not the attacker this is for.
 */

/** Same shape the ranking API validates, so a claim cannot reach rows a list cannot. */
const REG_NO_PATTERN = /^\d{4,8}$/;

/**
 * Failed attempts allowed against ONE registration number before it is locked,
 * and for how long.
 *
 * Ten is chosen against the size of the space being guessed rather than as a
 * round number: a junior's date of birth is confined to roughly four years by
 * the age category printed next to their name, so the search space is ~1,500
 * days. Ten attempts a day is a ~150-day expected search for a single target,
 * which is well past the point where the alerting on it fires.
 */
const MAX_FAILURES_PER_REG_NO = 10;
const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

const failureKey = (sportSlug: string, regNo: string) => `rankclaim:fail:${sportSlug}:${regNo}`;

/**
 * The single message every failed match returns. Phrased to describe the pair
 * rather than either half, so it stays true and uninformative whether the regNo
 * is unknown, the DOB is wrong, or both.
 */
const NO_MATCH_MESSAGE =
  "That registration number and date of birth do not match a ranked player. " +
  "Check both against the federation's own record and try again.";

/** Calendar-date equality in UTC. Both sides are midnight-UTC dates in practice,
 * but a list parsed from a source with a time component would otherwise never
 * match, and that failure would look exactly like a wrong answer. */
const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

const isLocked = async (sportSlug: string, regNo: string): Promise<boolean> => {
  try {
    const raw = await redis.get(failureKey(sportSlug, regNo));
    return raw !== null && Number(raw) >= MAX_FAILURES_PER_REG_NO;
  } catch (error) {
    log.error("Redis error reading claim lockout:", error);
    return false; // fail open
  }
};

const recordFailure = async (sportSlug: string, regNo: string): Promise<void> => {
  try {
    const key = failureKey(sportSlug, regNo);
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, FAILURE_WINDOW_MS);
    if (count >= MAX_FAILURES_PER_REG_NO) {
      // Worth an explicit line: a locked registration number is either a parent
      // who genuinely does not know the date on file, or the attack this guard
      // exists for, and the two are told apart by how many regNos appear here.
      log.warn(`Ranking claim locked out for ${sportSlug}/${regNo} after ${count} failures`);
    }
  } catch (error) {
    log.error("Redis error recording claim failure:", error);
  }
};

const clearFailures = async (sportSlug: string, regNo: string): Promise<void> => {
  try {
    await redis.del(failureKey(sportSlug, regNo));
  } catch (error) {
    log.error("Redis error clearing claim failures:", error);
  }
};

/** The public-safe standing shown next to a link. Deliberately enumerated, and
 * deliberately the same fields the public ranking list already prints. */
const PUBLIC_STANDING_FIELDS =
  // `sportSlug` is not rendered anywhere — it is here because `standingsFor`
  // keys its result map on it, and a projection that omits it silently files
  // every standing under `undefined` and hands back an empty list.
  "sportSlug rank regNo fullName birthYear state category subcategory totalPoints asOnDate prevRank";

export interface RankingStanding {
  rank: number;
  regNo: string;
  fullName: string;
  birthYear: number | null;
  state: string | null;
  category: string;
  subcategory: string;
  totalPoints: number;
  asOnDate: Date;
  /** Positive means the player moved up since the previous published list. */
  rankDelta: number | null;
}

export interface RankingClaim {
  id: string;
  dependentId: string;
  dependentName: string | null;
  sportSlug: string;
  federationCode: string;
  regNo: string;
  verifiedAt: Date;
  /** Every list this player currently appears in. Empty if they have dropped off. */
  standings: RankingStanding[];
}

const toStanding = (entry: {
  rank: number;
  regNo: string;
  fullName: string;
  birthYear?: number;
  state?: string;
  category: string;
  subcategory: string;
  totalPoints: number;
  asOnDate: Date;
  prevRank?: number;
}): RankingStanding => ({
  rank: entry.rank,
  regNo: entry.regNo,
  fullName: entry.fullName,
  birthYear: entry.birthYear ?? null,
  state: entry.state ?? null,
  category: entry.category,
  subcategory: entry.subcategory,
  totalPoints: entry.totalPoints,
  asOnDate: entry.asOnDate,
  rankDelta: typeof entry.prevRank === "number" ? entry.prevRank - entry.rank : null,
});

/** Current standings for a set of links, in one query rather than one per link. */
const standingsFor = async (
  links: Array<{ sportSlug: string; regNo: string }>
): Promise<Map<string, RankingStanding[]>> => {
  const byRegNo = new Map<string, RankingStanding[]>();
  if (links.length === 0) return byRegNo;

  const entries = await RankingEntry.find({
    isLatest: true,
    $or: links.map(({ sportSlug, regNo }) => ({ sportSlug, regNo })),
  })
    .select(PUBLIC_STANDING_FIELDS)
    .sort({ rank: 1 })
    .lean();

  for (const entry of entries as Array<Parameters<typeof toStanding>[0] & { sportSlug: string }>) {
    const key = `${entry.sportSlug}:${entry.regNo}`;
    const list = byRegNo.get(key) ?? [];
    list.push(toStanding(entry));
    byRegNo.set(key, list);
  }
  return byRegNo;
};

const present = (
  link: PlayerRankingLinkDocument | (PlayerRankingLinkDocument & { toObject(): unknown }),
  dependentName: string | null,
  standings: RankingStanding[]
): RankingClaim => ({
  id: String(link._id),
  dependentId: String(link.dependentId),
  dependentName,
  sportSlug: link.sportSlug,
  federationCode: link.federationCode,
  regNo: link.regNo,
  verifiedAt: link.verifiedAt,
  standings,
});

export class RankingClaimService {
  /**
   * Verify possession of a ranked player's date of birth and record the link.
   *
   * The DOB argument is the only place in this codebase a caller supplies one
   * for comparison against `RankingEntry.dob`, and this is the only place that
   * field is selected. Both facts are load-bearing: grep for `+dob` and this
   * method should be the entire result set.
   */
  static async claim(params: {
    userId: string;
    dependentId: string;
    regNo: string;
    /** As typed by the parent, `YYYY-MM-DD`. Never stored. */
    dob: string;
    sportSlug?: string;
  }): Promise<RankingClaim> {
    const sportSlug = (params.sportSlug ?? "tennis").trim().toLowerCase() || "tennis";
    const regNo = String(params.regNo ?? "").trim();

    if (!REG_NO_PATTERN.test(regNo)) {
      throw new AppError("Enter a registration number of 4 to 8 digits.", 400);
    }
    if (!mongoose.isValidObjectId(params.dependentId)) {
      throw new AppError("Choose which player this ranking belongs to.", 400);
    }

    const challengeDob = new Date(`${String(params.dob ?? "").trim()}T00:00:00.000Z`);
    if (Number.isNaN(challengeDob.getTime())) {
      throw new AppError("Enter the date of birth as it appears on the federation's record.", 400);
    }

    // The profile must be one this account owns. Checked before anything reads
    // the ranking data, so a caller cannot use someone else's profile id as a
    // probe and learn from the timing which regNos exist.
    const dependent = await Player.findOne({
      _id: params.dependentId,
      userId: params.userId,
    })
      .select("name dob")
      .lean();
    if (!dependent) {
      throw new AppError("Player profile not found.", 404);
    }

    if (await isLocked(sportSlug, regNo)) {
      throw new AppError(
        "Too many failed attempts for this registration number. Try again tomorrow, " +
          "or contact support if this is your child.",
        429
      );
    }

    // `+dob` is the opt-in the model is built around. Nothing downstream of this
    // line may put the value into a response, a document or a log line.
    const entry = await RankingEntry.findOne({ sportSlug, regNo })
      .select("+dob fullName")
      .sort({ asOnDate: -1 })
      .lean();

    const matches = entry?.dob ? sameCalendarDay(new Date(entry.dob), challengeDob) : false;
    if (!matches) {
      await recordFailure(sportSlug, regNo);
      throw new AppError(NO_MATCH_MESSAGE, 400);
    }

    /**
     * The profile's own date of birth, when it has one, has to agree too.
     *
     * Knowing a child's date of birth is not the same as being their parent, and
     * this catches the case the DOB challenge alone cannot: someone who knows a
     * classmate's details attaching them to a profile that says something else.
     * It costs a parent nothing — their own child's profile already carries the
     * right date — and it is their own data on both sides, so saying which half
     * disagreed leaks nothing.
     */
    if (dependent.dob && !sameCalendarDay(new Date(dependent.dob), challengeDob)) {
      throw new AppError(
        "That date of birth does not match the one saved on this player's profile. " +
          "Fix the profile first if the saved date is wrong.",
        400
      );
    }

    const existing = await PlayerRankingLink.findOne({ sportSlug, regNo }).lean();
    if (existing) {
      if (String(existing.userId) === String(params.userId)) {
        throw new AppError("This ranking is already linked to one of your players.", 409);
      }
      // Another account got there first. Said without naming them: a claim
      // conflict must not become a way to discover who else is on the platform.
      throw new AppError(
        "This registration number is already linked to another account. " +
          "Contact support if it should be yours.",
        409
      );
    }

    let link: PlayerRankingLinkDocument;
    try {
      link = await PlayerRankingLink.create({
        userId: params.userId,
        dependentId: params.dependentId,
        sportSlug,
        federationCode: (entry?.federationCode as string | undefined) ?? "AITA",
        regNo,
        verificationMethod: "DOB_CHALLENGE",
        verifiedAt: new Date(),
      });
    } catch (error) {
      // The unique indexes are the real guard; the findOne above is only there
      // to produce a better message. Two simultaneous claims land here.
      if ((error as { code?: number }).code === 11000) {
        throw new AppError(
          "That ranking is already linked. Refresh the page to see the current links.",
          409
        );
      }
      throw error;
    }

    await clearFailures(sportSlug, regNo);
    log.info(`Ranking claim verified: ${sportSlug}/${regNo} -> player ${params.dependentId}`);

    const standings = await standingsFor([{ sportSlug, regNo }]);
    return present(link, dependent.name ?? null, standings.get(`${sportSlug}:${regNo}`) ?? []);
  }

  /** Every link this account owns, with each player's current standing attached. */
  static async list(userId: string): Promise<RankingClaim[]> {
    const links = await PlayerRankingLink.find({ userId }).sort({ createdAt: -1 });
    if (links.length === 0) return [];

    const [standings, dependents] = await Promise.all([
      standingsFor(links.map((l) => ({ sportSlug: l.sportSlug, regNo: l.regNo }))),
      Player.find({ _id: { $in: links.map((l) => l.dependentId) } })
        .select("name")
        .lean(),
    ]);

    const nameById = new Map(dependents.map((d) => [String(d._id), d.name as string]));
    return links.map((link) =>
      present(
        link,
        nameById.get(String(link.dependentId)) ?? null,
        standings.get(`${link.sportSlug}:${link.regNo}`) ?? []
      )
    );
  }

  /**
   * Remove a link.
   *
   * A hard delete rather than a revoked flag. A soft-deleted claim would keep a
   * child's registration number attached to an account that has explicitly said
   * it should not be, which is the opposite of what the parent asked for, and
   * it would hold the unique index against a legitimate re-claim later.
   */
  static async remove(userId: string, linkId: string): Promise<void> {
    if (!mongoose.isValidObjectId(linkId)) {
      throw new AppError("Link not found.", 404);
    }
    const result = await PlayerRankingLink.deleteOne({ _id: linkId, userId });
    if (result.deletedCount === 0) {
      throw new AppError("Link not found.", 404);
    }
  }

  /** Cascade for profile deletion — see `AuthService/dependents.ts`. */
  static async removeForDependent(dependentId: string): Promise<void> {
    await PlayerRankingLink.deleteMany({ dependentId });
  }
}
