import mongoose from "mongoose";

import { ScheduledNotification } from "../../client/models/ScheduledNotification";
import { User } from "../../client/models/User";
import { log as __rootLog } from "../../utils/logger";
import { Opportunity } from "../models/Opportunity";
import { OpportunityFollow } from "../models/OpportunityFollow";
import { todayInIndia, type OpportunityTrack } from "../validation/opportunityFormat";

const log = __rootLog.child("opportunityAlerts");

// ─── Telling a parent that a window they follow has moved ───────────────────
//
// Deterministic, and nothing here asks a model anything: it reads the dates a
// published entry already carries against today's date, for the parents who
// chose to follow that entry. Two moments are worth an alert, and only two:
//
//   opened   the window opened in the last two weeks, and the parent followed
//            the entry before it did. Someone who followed an entry that was
//            already open has seen it open; telling them again is noise.
//   closing  the window closes within the next week. This one also reaches a
//            parent who followed late, because "closes on Friday" is the one
//            message that is useful whenever it arrives.
//
// The dates are the ones an editor last verified, so the copy says "our page
// shows" and sends the parent to the official source rather than asserting them.

export const OPENED_WITHIN_DAYS = 14;
export const CLOSING_WITHIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (value: string | null | undefined): value is string =>
  typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Negative when `to` is earlier. */
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export type AlertKind = "opened" | "closing";

export interface AlertMoment {
  kind: AlertKind;
  /** The date the alert is about; also what is stamped so it is not sent twice. */
  date: string;
  /** Days from today: 0 is today. For "opened" this is how long ago, as a negative. */
  days: number;
}

interface FollowState {
  createdAt: Date;
  alerted?: { opened?: string | null; closing?: string | null } | null;
}

/** What, if anything, a follower of this entry should be told today. Pure. */
export function alertsFor(
  cycle: { opensOn?: string | null; closesOn?: string | null } | null | undefined,
  follow: FollowState,
  today: string
): AlertMoment[] {
  const moments: AlertMoment[] = [];
  const opensOn = validDate(cycle?.opensOn) ? cycle?.opensOn : undefined;
  const closesOn = validDate(cycle?.closesOn) ? cycle?.closesOn : undefined;

  if (opensOn && opensOn <= today && follow.alerted?.opened !== opensOn) {
    const ago = daysBetween(opensOn, today);
    const stillOpen = !closesOn || closesOn >= today;
    // Followed on or before opening day: they were waiting for it.
    const wasWaiting = todayInIndia(follow.createdAt) <= opensOn;
    if (ago <= OPENED_WITHIN_DAYS && stillOpen && wasWaiting) {
      moments.push({ kind: "opened", date: opensOn, days: -ago });
    }
  }

  if (closesOn && follow.alerted?.closing !== closesOn) {
    const left = daysBetween(today, closesOn);
    if (left >= 0 && left <= CLOSING_WITHIN_DAYS) {
      moments.push({ kind: "closing", date: closesOn, days: left });
    }
  }

  return moments;
}

export interface AlertItem extends AlertMoment {
  slug: string;
  title: string;
  track: OpportunityTrack;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-20" as "20 October 2026". */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** One line about one item, in words a parent can act on. */
export function describeItem(item: AlertItem): string {
  if (item.kind === "opened") {
    return `Applications for ${item.title} opened on ${longDate(item.date)}.`;
  }
  const when = item.days === 0 ? "today" : item.days === 1 ? "tomorrow" : `in ${item.days} days`;
  return `Applications for ${item.title} close ${when}, on ${longDate(item.date)}.`;
}

/** The notification's headline and body for everything one parent is due. */
export function alertSummary(items: AlertItem[]): { title: string; body: string } {
  const [first] = items;
  if (!first) return { title: "Update on an entry you follow", body: "" };
  if (items.length === 1) {
    return {
      title:
        first.kind === "opened" ? "A window you follow has opened" : "A window is closing soon",
      body: `${describeItem(first)} Check the official page before you apply.`,
    };
  }
  return {
    title: `${items.length} updates on entries you follow`,
    body: `${describeItem(first)} And ${items.length - 1} more. Check the official pages before you apply.`,
  };
}

/** Where an entry lives on the public site, from its track and slug. */
export const entryPath = (track: OpportunityTrack, slug: string): string =>
  `/${track === "admission" ? "admissions" : "scholarships"}/${slug}`;

export const OpportunityAlertService = {
  /**
   * Find every follow with something new to say, build one notification per
   * parent, and queue it. Delivery is the existing reminder sweep's job.
   *
   * Idempotent: each follow records the dates it has been told about, so running
   * this twice in a day, or after a missed day, never repeats an alert.
   */
  async sweep(now: Date = new Date()): Promise<{ queued: number; followsCovered: number }> {
    const today = todayInIndia(now);
    const openedSince = addDays(today, -OPENED_WITHIN_DAYS);
    const closingBy = addDays(today, CLOSING_WITHIN_DAYS);

    // Only entries with a date near enough to matter. Dates are ISO strings, so
    // string comparison orders them correctly.
    const entries = await Opportunity.find({
      status: "published",
      $or: [
        { "cycle.opensOn": { $gte: openedSince, $lte: today } },
        { "cycle.closesOn": { $gte: today, $lte: closingBy } },
      ],
    })
      .select("slug title track cycle")
      .lean();
    if (entries.length === 0) return { queued: 0, followsCovered: 0 };

    const entryBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    const follows = await OpportunityFollow.find({ slug: { $in: [...entryBySlug.keys()] } }).lean();
    if (follows.length === 0) return { queued: 0, followsCovered: 0 };

    const dueByUser = new Map<
      string,
      Array<{ followId: mongoose.Types.ObjectId; item: AlertItem }>
    >();
    for (const follow of follows) {
      const entry = entryBySlug.get(follow.slug);
      if (!entry) continue;
      for (const moment of alertsFor(entry.cycle, follow, today)) {
        const key = String(follow.userId);
        dueByUser.set(key, [
          ...(dueByUser.get(key) ?? []),
          {
            followId: follow._id as mongoose.Types.ObjectId,
            item: { ...moment, slug: entry.slug, title: entry.title, track: entry.track },
          },
        ]);
      }
    }
    if (dueByUser.size === 0) return { queued: 0, followsCovered: 0 };

    // An account being wound down still owns its follows until the grace period
    // finalises; mailing it in the meantime is what it asked us to stop doing.
    const users = await User.find({ _id: { $in: [...dueByUser.keys()] }, isActive: true })
      .select("pendingDeletion")
      .lean();
    const live = new Set(
      users.filter((user) => !user.pendingDeletion).map((user) => String(user._id))
    );

    let queued = 0;
    let followsCovered = 0;

    for (const [userId, due] of dueByUser) {
      if (!live.has(userId)) continue;

      // Closing soonest first, so the headline is the most urgent thing.
      const items = due
        .map(({ item }) => item)
        .sort((a, b) => (a.kind === b.kind ? a.days - b.days : a.kind === "closing" ? -1 : 1));
      const { title, body } = alertSummary(items);

      await ScheduledNotification.create({
        userId: new mongoose.Types.ObjectId(userId),
        type: "OPPORTUNITY_ALERT",
        interval: "CUSTOM",
        scheduledFor: now,
        title,
        body,
        data: {
          items: items.map((item) => ({
            slug: item.slug,
            title: item.title,
            kind: item.kind,
            date: item.date,
            days: item.days,
            path: entryPath(item.track, item.slug),
            text: describeItem(item),
          })),
        },
        // Following is the opt-in; unfollowing is the off switch.
        channels: { email: true, inApp: true, push: true },
      });
      queued += 1;

      await OpportunityFollow.bulkWrite(
        due.map(({ followId, item }) => ({
          updateOne: {
            filter: { _id: followId },
            update: { $set: { [`alerted.${item.kind}`]: item.date } },
          },
        }))
      );
      followsCovered += due.length;
    }

    if (queued > 0) log.info(`Queued ${queued} alert(s) covering ${followsCovered} follow(s)`);
    return { queued, followsCovered };
  },
};
