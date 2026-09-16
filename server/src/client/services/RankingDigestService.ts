import mongoose from "mongoose";
import { RankingEntry } from "../../shared/models/RankingEntry";
import { RankingSnapshot } from "../../shared/models/RankingSnapshot";
import {
  projectRanking,
  type RankingProjection,
} from "../../shared/services/ranking/rankingProjection";
import { log as __rootLog } from "../../utils/logger";
import { Player } from "../models/Player";
import { PlayerRankingLink } from "../models/PlayerRankingLink";
import { ScheduledNotification } from "../models/ScheduledNotification";
import { User } from "../models/User";

const log = __rootLog.child("rankingDigest");

/**
 * Telling a parent what this week's list did to their child's standing.
 *
 * ── Why this is event-driven and not a Monday cron ───────────────────────────
 * A weekly cron is the obvious design and it is the wrong one here. The lists
 * are dated Mondays, but the *upload* lands whenever the federation gets to it:
 * on 8 August 2026 the newest published list was still dated 27 July, twelve
 * days behind, and gaps of a fortnight are common (the same fact that shaped
 * `aitaRankingScheduler`). A Monday send would mail "no change" on the weeks
 * nothing was published and stay silent on the Wednesday one finally arrived.
 *
 * So the trigger is the data, not the calendar: a link is due a digest when a
 * published list exists whose as-on date is newer than the one we last told this
 * account about. `lastNotifiedAsOnDate` on the link makes that exact and makes
 * the sweep idempotent — running it twice sends one email, and running it after
 * a three-week silence sends one email rather than three.
 *
 * ── One email per account, not per child ─────────────────────────────────────
 * A parent with two children in three lists between them gets one message. The
 * sweep therefore groups by user before it writes anything, which is also why it
 * cannot simply be a hook on `publish()`: that runs once per combo, and hooking
 * it would mail the same parent once per list their children appear in.
 *
 * ── What the email is allowed to say ─────────────────────────────────────────
 * Movement is exact and is stated plainly. Points at risk is a ceiling and is
 * always written as "up to" (see `rankingProjection.ts`). Nothing here predicts
 * a rank, and nothing addresses the child: these go to the account holder, who
 * is usually a parent, about a minor who did not sign up for email.
 */

/** A player's standing in one list, as the digest needs it. */
interface DigestStanding {
  listLabel: string;
  rank: number;
  previousRank: number | null;
  totalPoints: number;
  asOnDate: Date;
  projection: RankingProjection | null;
}

interface DigestPlayer {
  name: string;
  regNo: string;
  sportSlug: string;
  standings: DigestStanding[];
}

export interface DigestPayload {
  players: DigestPlayer[];
  /** The newest as-on date across everything in this digest. */
  asOnDate: Date;
}

const listLabelOf = (entry: { category: string; subcategory: string }): string =>
  `${entry.category} ${entry.subcategory}`;

/**
 * The headline sentence.
 *
 * Written as one line because it is also the push/in-app body and the email
 * subject's companion, and because a parent reading it on a lock screen should
 * get the whole fact without opening anything.
 */
export const digestSummary = (payload: DigestPayload): { title: string; body: string } => {
  const [player] = payload.players;
  const standing = player?.standings[0];

  if (!player || !standing) {
    return { title: "New ranking list published", body: "A new list has been published." };
  }

  const moved = standing.previousRank === null ? null : standing.previousRank - standing.rank;

  const movement =
    moved === null || moved === 0
      ? `is ${moved === 0 ? "still" : "now"} ranked ${standing.rank}`
      : `moved ${moved > 0 ? "up" : "down"} ${Math.abs(moved)} ${
          Math.abs(moved) === 1 ? "place" : "places"
        } to ${standing.rank}`;

  const others = payload.players.length - 1;
  const tail = others > 0 ? ` (and ${others} more ${others === 1 ? "player" : "players"})` : "";

  return {
    title: "This week's ranking",
    body: `${player.name} ${movement} on the ${standing.listLabel} list${tail}.`,
  };
};

export const RankingDigestService = {
  /**
   * Find every link with an unseen published list, build one digest per account,
   * and queue it. Delivery is the existing reminder sweep's job.
   *
   * Returns counts rather than the digests themselves so the scheduler can log a
   * single line, matching `ExperienceNudgeService.sweep`.
   */
  async sweep(): Promise<{ queued: number; linksCovered: number }> {
    const links = await PlayerRankingLink.find({}).lean();
    if (links.length === 0) return { queued: 0, linksCovered: 0 };

    // Every current standing for every linked player, in one query. The list is
    // bounded by how many claims exist, not by how many players are ranked.
    const entries = await RankingEntry.find({
      isLatest: true,
      $or: links.map(({ sportSlug, regNo }) => ({ sportSlug, regNo })),
    })
      .select("sportSlug regNo category subcategory rank prevRank totalPoints asOnDate")
      .lean();

    const entriesByPlayer = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = `${entry.sportSlug}:${entry.regNo}`;
      entriesByPlayer.set(key, [...(entriesByPlayer.get(key) ?? []), entry]);
    }

    // Links whose newest published list is newer than what we last sent.
    const due = links.filter((link) => {
      const standings = entriesByPlayer.get(`${link.sportSlug}:${link.regNo}`) ?? [];
      const newest = standings.reduce<number | null>(
        (max, entry) => Math.max(max ?? 0, new Date(entry.asOnDate).getTime()),
        null
      );
      if (newest === null) return false;
      const lastSent = link.lastNotifiedAsOnDate
        ? new Date(link.lastNotifiedAsOnDate).getTime()
        : null;
      return lastSent === null || newest > lastSent;
    });

    if (due.length === 0) return { queued: 0, linksCovered: 0 };

    const byUser = new Map<string, typeof due>();
    for (const link of due) {
      const key = String(link.userId);
      byUser.set(key, [...(byUser.get(key) ?? []), link]);
    }

    const [users, players] = await Promise.all([
      User.find({ _id: { $in: [...byUser.keys()] }, isActive: true })
        .select("notificationPreferences pendingDeletion")
        .lean(),
      Player.find({ _id: { $in: due.map((link) => link.dependentId) } })
        .select("name")
        .lean(),
    ]);

    const nameById = new Map(players.map((player) => [String(player._id), player.name as string]));
    const userById = new Map(users.map((user) => [String(user._id), user]));

    let queued = 0;
    let linksCovered = 0;

    for (const [userId, userLinks] of byUser) {
      const user = userById.get(userId);
      // An account being wound down still owns its links until the grace period
      // finalises. Mailing it about a ranking in the meantime would be the one
      // thing it has explicitly asked us to stop doing.
      if (!user || user.pendingDeletion) continue;

      const preferences = (user.notificationPreferences ?? {}) as Record<
        string,
        Record<string, boolean> | undefined
      >;
      const wantsEmail = preferences.email?.rankingUpdates ?? true;
      const wantsInApp = preferences.inApp?.rankingUpdates ?? true;
      const wantsPush = preferences.push?.rankingUpdates ?? true;

      // Every channel off is a real answer, and the digest is still marked as
      // seen: a parent who turned this off should not receive a backlog of
      // three weeks' updates the day they turn it back on.
      const payload = await this.buildPayload(userLinks, entriesByPlayer, nameById);
      linksCovered += userLinks.length;

      if (payload && (wantsEmail || wantsInApp || wantsPush)) {
        const { title, body } = digestSummary(payload);
        await ScheduledNotification.create({
          userId: new mongoose.Types.ObjectId(userId),
          type: "RANKING_DIGEST",
          // Nothing to count down to: this fires because a list appeared, not
          // because an event is approaching.
          interval: "CUSTOM",
          scheduledFor: new Date(),
          title,
          body,
          data: {
            asOnDate: payload.asOnDate,
            players: payload.players.map((player) => ({
              name: player.name,
              regNo: player.regNo,
              sportSlug: player.sportSlug,
              standings: player.standings.map((standing) => ({
                listLabel: standing.listLabel,
                rank: standing.rank,
                previousRank: standing.previousRank,
                totalPoints: standing.totalPoints,
                atRiskNextTwelveWeeks: standing.projection?.atRisk?.nextTwelveWeeks ?? null,
                weeksSinceLastRise: standing.projection?.activity.weeksSinceLastRise ?? null,
              })),
            })),
          },
          channels: { email: wantsEmail, inApp: wantsInApp, push: wantsPush },
        });
        queued += 1;
      }

      // Stamped whether or not anything was queued, for the reason above.
      await PlayerRankingLink.updateMany(
        { _id: { $in: userLinks.map((link) => link._id) } },
        { $set: { lastNotifiedAsOnDate: payload?.asOnDate ?? new Date() } }
      );
    }

    return { queued, linksCovered };
  },

  /** The per-account body: every claimed player, every list they sit in. */
  async buildPayload(
    links: Array<{
      dependentId: unknown;
      sportSlug: string;
      regNo: string;
    }>,
    entriesByPlayer: Map<
      string,
      Array<{
        category: string;
        subcategory: string;
        rank: number;
        prevRank?: number;
        totalPoints: number;
        asOnDate: Date;
      }>
    >,
    nameById: Map<string, string>
  ): Promise<DigestPayload | null> {
    const players: DigestPlayer[] = [];
    let newest = 0;

    for (const link of links) {
      const standings = entriesByPlayer.get(`${link.sportSlug}:${link.regNo}`) ?? [];
      if (standings.length === 0) continue;

      const built: DigestStanding[] = [];
      for (const entry of standings) {
        newest = Math.max(newest, new Date(entry.asOnDate).getTime());
        built.push({
          listLabel: listLabelOf(entry),
          rank: entry.rank,
          previousRank: entry.prevRank ?? null,
          totalPoints: entry.totalPoints,
          asOnDate: entry.asOnDate,
          projection: await projectionFor(link.sportSlug, link.regNo, entry),
        });
      }

      // The list a player belongs to first, so the headline sentence is about
      // their own age group rather than whichever list sorted first.
      built.sort((a, b) => a.rank - b.rank);

      players.push({
        name: nameById.get(String(link.dependentId)) ?? "Your player",
        regNo: link.regNo,
        sportSlug: link.sportSlug,
        standings: built,
      });
    }

    if (players.length === 0) return null;
    return { players, asOnDate: new Date(newest) };
  },
};

/**
 * The same projection the player page shows, for one list.
 *
 * Read per player rather than in one sweep-wide query on purpose: the digest
 * runs for the handful of accounts that have claimed a ranking, not for every
 * ranked player, so this is a few dozen reads a week rather than twelve thousand.
 * If claims ever reach a scale where that stops being true, this is the line to
 * change, and the comment is here so the next person does not have to find out
 * by watching the cluster.
 */
async function projectionFor(
  sportSlug: string,
  regNo: string,
  entry: { category: string; subcategory: string }
): Promise<RankingProjection | null> {
  try {
    const [history, snapshot] = await Promise.all([
      RankingEntry.find({
        sportSlug,
        regNo,
        category: entry.category,
        subcategory: entry.subcategory,
      })
        .sort({ asOnDate: -1 })
        .limit(120)
        .select("asOnDate rank totalPoints")
        .lean(),
      RankingSnapshot.findOne({
        sportSlug,
        category: entry.category,
        subcategory: entry.subcategory,
        status: "published",
        isLatestForCombo: true,
      })
        .select("benchmarks")
        .lean(),
    ]);

    return projectRanking({
      history: history.map((point) => ({
        asOnDate: point.asOnDate,
        rank: point.rank,
        totalPoints: point.totalPoints,
      })),
      benchmarks: snapshot?.benchmarks,
    });
  } catch (error) {
    // A digest without the forward-looking half is still worth sending: the
    // movement is the part the parent opened the email for.
    log.error(`Failed to project ${sportSlug}/${regNo}:`, error);
    return null;
  }
}
