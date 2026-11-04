import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { ExpertSession } from "../models/ExpertBooking";
import { Venue } from "../models/Venue";
import { Coach } from "../models/Coach";
import Academy from "../../admin/models/Academy";
import { Expert } from "../models/ExpertProfile";
import { User } from "../models/User";
import { ScheduledNotification } from "../models/ScheduledNotification";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("experienceNudge");

/**
 * "The nudge is what actually fills this — the button will not." The entity
 * bands (ParentExperiencesBand, client app) and the composer's subject
 * deep-link exist; this is the other half — reaching a parent a couple of
 * days after something actually happened, while it's still fresh.
 *
 * Deliberately scoped to what has a real attendance record. Booking covers
 * VENUE, ACADEMY and COACH (via providerType); ExpertBooking covers EXPERT.
 * TOURNAMENT / TOURNAMENT_EDITION have no registration or attendance model
 * anywhere in this codebase (confirmed in phase 3 and re-confirmed here) — a
 * tournament nudge is not built, and should not be promised in copy until one
 * exists. CoachEnrollment / CoachSessionOccurrence (recurring coaching) are
 * also left out for now: a one-off completed Booking is enough to prove the
 * mechanism, and nudging every occurrence of a recurring plan needs its own
 * "don't ask again this month" throttling this pass doesn't build.
 */

const COMMUNITY_APP_URL = (process.env.COMMUNITY_FRONTEND_URL || "https://community.powermysport.com").replace(/\/$/, ""); // prettier-ignore

const NUDGE_TITLE = "How did it go?";

interface NudgeTarget {
  userId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  subjectKind: "VENUE" | "ACADEMY" | "COACH" | "EXPERT";
  subjectRefId: mongoose.Types.ObjectId;
  subjectName: string;
  subjectSlug?: string | null;
}

/** [start, end) for the calendar day that was exactly `daysAgo` days ago. */
const dayWindow = (daysAgo: number): { start: Date; end: Date } => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const buildShareUrl = (target: NudgeTarget): string => {
  const params = new URLSearchParams({
    subjectKind: target.subjectKind,
    subjectRefId: String(target.subjectRefId),
    subjectName: target.subjectName,
  });
  if (target.subjectSlug) params.set("subjectSlug", target.subjectSlug);
  return `${COMMUNITY_APP_URL}/experiences/new?${params.toString()}`;
};

const nudgeBody = (target: NudgeTarget): string => {
  const noun =
    target.subjectKind === "COACH"
      ? "session"
      : target.subjectKind === "EXPERT"
        ? "session"
        : "visit";
  return `Help another parent decide — share how your ${noun} at ${target.subjectName} went. Two lines is enough.`;
};

export const ExperienceNudgeService = {
  /**
   * Bookings (VENUE/ACADEMY/COACH) completed exactly `daysAfter` days ago,
   * not already nudged.
   */
  async collectFromBookings(daysAfter: number): Promise<NudgeTarget[]> {
    const { start, end } = dayWindow(daysAfter);

    const bookings = await Booking.find({
      status: "COMPLETED",
      providerType: { $in: ["VENUE", "ACADEMY", "COACH"] },
      completedAt: { $gte: start, $lt: end },
    })
      .select("_id userId providerType venueId academyId coachId")
      .lean();

    if (!bookings.length) return [];

    const alreadyNudged = await ScheduledNotification.find({
      type: "EXPERIENCE_NUDGE",
      bookingId: { $in: bookings.map((b) => b._id) },
    })
      .select("bookingId")
      .lean();
    const nudgedIds = new Set(alreadyNudged.map((n) => String(n.bookingId)));
    const pending = bookings.filter((b) => !nudgedIds.has(String(b._id)));
    if (!pending.length) return [];

    const isId = (id: unknown): id is mongoose.Types.ObjectId => Boolean(id);
    const venueIds = pending
      .filter((b) => b.providerType === "VENUE")
      .map((b) => b.venueId)
      .filter(isId);
    const academyIds = pending
      .filter((b) => b.providerType === "ACADEMY")
      .map((b) => b.academyId)
      .filter(isId);
    const coachIds = pending
      .filter((b) => b.providerType === "COACH")
      .map((b) => b.coachId)
      .filter(isId);

    const [venues, academies, coaches] = await Promise.all([
      venueIds.length ? Venue.find({ _id: { $in: venueIds } }).select("_id name").lean() : [], // prettier-ignore
      academyIds.length
        ? Academy.find({ _id: { $in: academyIds } })
            .select("_id name slug")
            .lean()
        : [],
      coachIds.length
        ? Coach.find({ _id: { $in: coachIds } })
            .select("_id userId")
            .populate("userId", "name")
            .lean()
        : [],
    ]);

    const venueMap = new Map(venues.map((v) => [String(v._id), v]));
    const academyMap = new Map(academies.map((a) => [String(a._id), a]));
    const coachMap = new Map(coaches.map((c) => [String(c._id), c]));

    const targets: NudgeTarget[] = [];
    for (const booking of pending) {
      if (booking.providerType === "VENUE" && booking.venueId) {
        const venue = venueMap.get(String(booking.venueId));
        if (!venue) continue;
        targets.push({
          userId: booking.userId,
          bookingId: booking._id,
          subjectKind: "VENUE",
          subjectRefId: booking.venueId,
          subjectName: venue.name,
        });
      } else if (booking.providerType === "ACADEMY" && booking.academyId) {
        const academy = academyMap.get(String(booking.academyId));
        if (!academy) continue;
        targets.push({
          userId: booking.userId,
          bookingId: booking._id,
          subjectKind: "ACADEMY",
          subjectRefId: booking.academyId,
          subjectName: academy.name,
          subjectSlug: academy.slug,
        });
      } else if (booking.providerType === "COACH" && booking.coachId) {
        const coach = coachMap.get(String(booking.coachId));
        const coachUser = coach?.userId as unknown as { name?: string } | undefined;
        if (!coach || !coachUser?.name) continue;
        targets.push({
          userId: booking.userId,
          bookingId: booking._id,
          subjectKind: "COACH",
          subjectRefId: booking.coachId,
          subjectName: coachUser.name,
        });
      }
    }
    return targets;
  },

  /** ExpertBooking sessions completed exactly `daysAfter` days ago. */
  async collectFromExpertBookings(daysAfter: number): Promise<NudgeTarget[]> {
    const { start, end } = dayWindow(daysAfter);

    const sessions = await ExpertSession.find({
      status: "COMPLETED",
      completedAt: { $gte: start, $lt: end },
    })
      .select("_id userId expertId")
      .lean();
    if (!sessions.length) return [];

    const alreadyNudged = await ScheduledNotification.find({
      type: "EXPERIENCE_NUDGE",
      bookingId: { $in: sessions.map((s) => s._id) },
    })
      .select("bookingId")
      .lean();
    const nudgedIds = new Set(alreadyNudged.map((n) => String(n.bookingId)));
    const pending = sessions.filter((s) => !nudgedIds.has(String(s._id)));
    if (!pending.length) return [];

    const experts = await Expert.find({ _id: { $in: pending.map((s) => s.expertId) } })
      .select("_id userId")
      .populate("userId", "name")
      .lean();
    const expertMap = new Map(experts.map((e) => [String(e._id), e]));

    const targets: NudgeTarget[] = [];
    for (const session of pending) {
      const expert = expertMap.get(String(session.expertId));
      const expertUser = expert?.userId as unknown as { name?: string } | undefined;
      if (!expert || !expertUser?.name) continue;
      targets.push({
        userId: session.userId,
        bookingId: session._id,
        subjectKind: "EXPERT",
        subjectRefId: session.expertId,
        subjectName: expertUser.name,
      });
    }
    return targets;
  },

  /**
   * Create the ScheduledNotification rows. `scheduledFor` is "now" rather
   * than some future time — by construction, this only runs once a day and
   * only picks up events that already happened `daysAfter` days ago, so
   * there is nothing left to wait for; the existing reminder-processing
   * sweep (every minute in dev, every 5 in prod) picks these up on its next
   * tick.
   */
  async createNudges(targets: NudgeTarget[]): Promise<number> {
    if (!targets.length) return 0;

    // No dedicated "experience nudge" preference exists yet — this only sends
    // in-app, so the closest real signal a user has already given is their
    // in-app booking-reminders toggle.
    const userIds = [...new Set(targets.map((t) => String(t.userId)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id notificationPreferences")
      .lean();
    const optedOut = new Set(
      users
        .filter(
          (u) =>
            (u as { notificationPreferences?: { inApp?: { bookingReminders?: boolean } } })
              .notificationPreferences?.inApp?.bookingReminders === false
        )
        .map((u) => String(u._id))
    );

    const docs = targets
      .filter((target) => !optedOut.has(String(target.userId)))
      .map((target) => ({
        userId: target.userId,
        type: "EXPERIENCE_NUDGE" as const,
        interval: "CUSTOM" as const,
        scheduledFor: new Date(),
        status: "PENDING" as const,
        bookingId: target.bookingId,
        title: NUDGE_TITLE,
        body: nudgeBody(target),
        data: {
          subjectKind: target.subjectKind,
          subjectRefId: String(target.subjectRefId),
          subjectName: target.subjectName,
          subjectSlug: target.subjectSlug || undefined,
          url: buildShareUrl(target),
        },
        channels: { inApp: true, push: false, email: false },
      }));

    if (!docs.length) return 0;
    await ScheduledNotification.insertMany(docs, { ordered: false });
    return docs.length;
  },

  /**
   * The daily sweep. `daysAfter` defaults to 2: soon enough that the visit is
   * still fresh, far enough that "was there a follow-up, a delivery, an
   * invoice" has had a chance to happen too.
   */
  async sweep(daysAfter = 2): Promise<{ created: number }> {
    const [bookingTargets, expertTargets] = await Promise.all([
      this.collectFromBookings(daysAfter).catch((error) => {
        log.error("Failed to collect booking nudge targets:", error);
        return [] as NudgeTarget[];
      }),
      this.collectFromExpertBookings(daysAfter).catch((error) => {
        log.error("Failed to collect expert booking nudge targets:", error);
        return [] as NudgeTarget[];
      }),
    ]);

    const created = await this.createNudges([...bookingTargets, ...expertTargets]);
    if (created > 0) {
      log.info(`Created ${created} experience nudge(s) for events ${daysAfter} day(s) ago`);
    }
    return { created };
  },
};
