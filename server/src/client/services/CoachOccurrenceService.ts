import mongoose from "mongoose";
import { BookingDelivery } from "../models/Booking";
import { Coach } from "../models/Coach";
import { Venue } from "../models/Venue";
import { CoachOffering, CoachOfferingDocument } from "../models/CoachOffering";
import { CoachEnrollment } from "../models/CoachEnrollment";
import {
  CoachOccurrenceRosterEntry,
  CoachSessionOccurrence,
  CoachSessionOccurrenceDocument,
} from "../models/CoachSessionOccurrence";
import {
  addDaysKey,
  parseHHmm,
  toDateKey,
  weekdayOfDateKey,
  zonedToUtc,
} from "../../utils/zonedTime";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachOccurrences");

/**
 * Materialising a coach offering's weekly pattern into dated sessions.
 *
 * The pattern is NOT the schedule: it is a rule, and occurrences are the facts
 * generated from it. They are materialised into a ROLLING WINDOW rather than
 * generated to infinity, so that editing next month's pattern cannot rewrite
 * sessions that already carry attendance, credits and payouts.
 *
 * Occurrences are stored as instants. A repeating weekly time stored as
 * wall-clock could not be reinterpreted later without rewriting history, and
 * the moment there is a student in another timezone it would be wrong for them.
 */

/** How far ahead sessions are materialised. */
export const GENERATION_WINDOW_DAYS = 56; // 8 weeks

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Where an offering's sessions happen, as a delivery snapshot.
 *
 * Same shape as a booking's delivery (Phase 0), so an occurrence and a booking
 * answer "where does this happen" in exactly one vocabulary.
 */
export const resolveOfferingDelivery = async (
  offering: CoachOfferingDocument,
  options: {
    enrollmentDeliveryAddress?: { addressSnapshot?: string; coordinates?: [number, number] } | null;
  } = {}
): Promise<BookingDelivery | undefined> => {
  switch (offering.deliveryKind) {
    case "ONLINE": {
      const delivery: BookingDelivery = { kind: "ONLINE" };
      if (offering.onlinePlatform) delivery.platform = offering.onlinePlatform;
      // Copied per occurrence rather than read live, so changing the standing
      // room link later cannot rewrite the link a student was given for a
      // session that has already happened.
      if (offering.defaultMeetingLink) {
        delivery.meetingLink = offering.defaultMeetingLink;
      }
      return delivery;
    }

    case "PLATFORM_VENUE": {
      if (!offering.venueId) return undefined;
      const venue: any = await Venue.findById(offering.venueId)
        .select("_id name address location")
        .lean();
      const delivery: BookingDelivery = {
        kind: "PLATFORM_VENUE",
        venueId: offering.venueId,
      };
      if (venue?.name) delivery.nameSnapshot = venue.name;
      if (venue?.address) delivery.addressSnapshot = venue.address;
      const coords = venue?.location?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        delivery.coordinates = [coords[0], coords[1]];
      }
      return delivery;
    }

    case "PROVIDER_VENUE": {
      const coach: any = await Coach.findById(offering.coachId)
        .select("_id ownVenueDetails")
        .lean();
      const delivery: BookingDelivery = { kind: "PROVIDER_VENUE" };
      if (coach?.ownVenueDetails?.name) {
        delivery.nameSnapshot = coach.ownVenueDetails.name;
      }
      if (coach?.ownVenueDetails?.address) {
        delivery.addressSnapshot = coach.ownVenueDetails.address;
      }
      const coords = coach?.ownVenueDetails?.location?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        delivery.coordinates = [coords[0], coords[1]];
      }
      return delivery;
    }

    case "STUDENT_LOCATION": {
      // Only reachable at capacity 1 — the model rejects a batch at a student's
      // location — so there is exactly one address to use.
      const address = options.enrollmentDeliveryAddress;
      if (!address) return undefined;
      const delivery: BookingDelivery = { kind: "STUDENT_LOCATION" };
      if (address.addressSnapshot) {
        delivery.addressSnapshot = address.addressSnapshot;
      }
      if (address.coordinates) delivery.coordinates = address.coordinates;
      return delivery;
    }

    default:
      return undefined;
  }
};

/** Active enrollments as roster entries, for a session at `at`. */
export const buildRosterForOffering = async (
  offeringId: mongoose.Types.ObjectId,
  at: Date
): Promise<CoachOccurrenceRosterEntry[]> => {
  const enrollments = await CoachEnrollment.find({
    offeringId,
    status: { $in: ["ACTIVE", "PENDING"] },
    joinedAt: { $lte: at },
    $or: [{ leftAt: null }, { leftAt: { $gt: at } }],
  })
    .select("_id userId playerId studentName")
    .lean();

  return enrollments.map((enrollment: any) => ({
    enrollmentId: enrollment._id,
    userId: enrollment.userId,
    playerId: enrollment.playerId ?? null,
    studentName: enrollment.studentName,
    attendance: "PENDING" as const,
  }));
};

interface RosterCandidate {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  studentName: string;
  joinedAt: Date;
  leftAt?: Date | null;
}

/**
 * The ACTIVE/PENDING enrollment candidates for an offering, unfiltered by
 * any specific instant. Membership at a given instant only depends on
 * `joinedAt`/`leftAt`, both already on each candidate, so fetching this once
 * and windowing it in memory (`rosterAtFromCandidates`) replaces what would
 * otherwise be one `buildRosterForOffering` query per occurrence — the
 * generation window can hold dozens of occurrences per offering, all asking
 * the same underlying question.
 */
const fetchRosterCandidates = async (
  offeringId: mongoose.Types.ObjectId
): Promise<RosterCandidate[]> =>
  CoachEnrollment.find({
    offeringId,
    status: { $in: ["ACTIVE", "PENDING"] },
  })
    .select("_id userId playerId studentName joinedAt leftAt")
    .lean();

/** Same membership window as buildRosterForOffering's query, applied
 *  in-memory against an already-fetched candidate set. */
const rosterAtFromCandidates = (
  candidates: RosterCandidate[],
  at: Date
): CoachOccurrenceRosterEntry[] =>
  candidates
    .filter(
      (candidate) => candidate.joinedAt <= at && (candidate.leftAt == null || candidate.leftAt > at)
    )
    .map((candidate) => ({
      enrollmentId: candidate._id,
      userId: candidate.userId,
      playerId: candidate.playerId ?? null,
      studentName: candidate.studentName,
      attendance: "PENDING" as const,
    }));

/**
 * The instants an offering's pattern lands on between two dates.
 *
 * Pure and exported so the arithmetic can be tested without a database — the
 * timezone conversion here is the part most likely to be quietly wrong.
 */
export const scheduledInstantsBetween = (
  offering: Pick<CoachOfferingDocument, "schedule" | "timezone" | "startDate" | "endDate">,
  from: Date,
  through: Date
): Array<{ scheduledAt: Date; durationMinutes: number }> => {
  const results: Array<{ scheduledAt: Date; durationMinutes: number }> = [];
  if (through <= from) return results;

  const effectiveFrom = offering.startDate > from ? offering.startDate : from;
  const effectiveThrough =
    offering.endDate && offering.endDate < through ? offering.endDate : through;
  if (effectiveThrough <= effectiveFrom) return results;

  const tz = offering.timezone || "Asia/Kolkata";

  // Walk calendar days from one day before the start (a zone west of UTC can
  // pull a local day's session back across the UTC date boundary) to one after.
  let dateKey = toDateKey(new Date(effectiveFrom.getTime() - dayMs));
  const lastKey = toDateKey(new Date(effectiveThrough.getTime() + dayMs));

  let guard = 0;
  while (dateKey <= lastKey && guard < 800) {
    guard += 1;
    const weekday = weekdayOfDateKey(dateKey);

    for (const slot of offering.schedule) {
      if (slot.dayOfWeek !== weekday) continue;
      const scheduledAt = zonedToUtc(dateKey, parseHHmm(slot.startTime), tz);
      if (scheduledAt < effectiveFrom) continue;
      if (scheduledAt > effectiveThrough) continue;
      results.push({ scheduledAt, durationMinutes: slot.durationMinutes });
    }

    dateKey = addDaysKey(dateKey, 1);
  }

  results.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return results;
};

/**
 * Materialise an offering's sessions up to `through`.
 *
 * Idempotent: the (offeringId, scheduledAt) unique index means a re-run cannot
 * duplicate a session even if two generators race, and duplicate-key errors are
 * treated as "already generated" rather than failures.
 *
 * Never touches an occurrence that already exists — a session whose time was
 * changed by an edit to the pattern is left alone, because it may already carry
 * attendance. Rescheduling an existing session is a deliberate act, not a side
 * effect of editing the rule.
 */
export const generateOccurrences = async (params: {
  offering: CoachOfferingDocument;
  through?: Date;
  now?: Date;
}): Promise<{ created: number; skipped: number; through: Date }> => {
  const { offering } = params;
  const now = params.now ?? new Date();
  const through = params.through ?? new Date(now.getTime() + GENERATION_WINDOW_DAYS * dayMs);

  if (offering.status !== "ACTIVE") {
    return { created: 0, skipped: 0, through: offering.generatedThrough ?? now };
  }

  // Resume from wherever generation last reached, so a re-run is cheap.
  const from =
    offering.generatedThrough && offering.generatedThrough > now ? offering.generatedThrough : now;

  const instants = scheduledInstantsBetween(offering, from, through);

  let created = 0;
  let skipped = 0;

  // Both of these are identical for every instant of this offering — where
  // it happens and who's enrolled don't vary per-session, only who's
  // *present* at a given instant does (handled by rosterAtFromCandidates
  // below). Resolving them once instead of per-instant turns what was
  // O(instants) venue/coach/enrollment lookups into O(1).
  const delivery = await resolveOfferingDelivery(offering, {
    enrollmentDeliveryAddress:
      offering.deliveryKind === "STUDENT_LOCATION"
        ? await singleEnrollmentAddress(offering._id as mongoose.Types.ObjectId)
        : null,
  });
  const rosterCandidates = await fetchRosterCandidates(offering._id as mongoose.Types.ObjectId);

  for (const instant of instants) {
    const roster = rosterAtFromCandidates(rosterCandidates, instant.scheduledAt);

    try {
      await CoachSessionOccurrence.create({
        offeringId: offering._id,
        coachId: offering.coachId,
        sport: offering.sport,
        scheduledAt: instant.scheduledAt,
        durationMinutes: instant.durationMinutes,
        status: "SCHEDULED",
        ...(delivery ? { delivery } : {}),
        roster,
        isMakeup: false,
        payout: { status: "PENDING", amountPaise: 0 },
      });
      created += 1;
    } catch (error: any) {
      // 11000 = duplicate key: this slot is already materialised.
      if (error?.code === 11000) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  await CoachOffering.findByIdAndUpdate(offering._id, {
    generatedThrough: through,
  });

  if (created > 0) {
    log.info(
      `generateOccurrences: offering ${offering._id.toString()} created ${created}, skipped ${skipped}`
    );
  }

  return { created, skipped, through };
};

const singleEnrollmentAddress = async (
  offeringId: mongoose.Types.ObjectId
): Promise<{ addressSnapshot?: string; coordinates?: [number, number] } | null> => {
  const enrollment: any = await CoachEnrollment.findOne({
    offeringId,
    status: { $in: ["ACTIVE", "PENDING"] },
  })
    .select("deliveryAddress")
    .lean();

  return enrollment?.deliveryAddress ?? null;
};

/**
 * Re-sync the roster of an offering's FUTURE scheduled sessions.
 *
 * Called when someone enrolls or leaves. Only sessions that have not happened
 * are touched: a completed session's roster is a historical record of who was
 * actually there and must never be rewritten by a later roster change.
 */
export const syncRostersForFutureOccurrences = async (params: {
  offeringId: mongoose.Types.ObjectId;
  now?: Date;
}): Promise<number> => {
  const now = params.now ?? new Date();

  const upcoming = await CoachSessionOccurrence.find({
    offeringId: params.offeringId,
    status: "SCHEDULED",
    scheduledAt: { $gt: now },
  })
    .select("_id scheduledAt roster")
    .lean();

  if (!upcoming.length) {
    return 0;
  }

  // Same candidate set serves every occurrence being re-synced — one query
  // instead of one buildRosterForOffering call per occurrence.
  const rosterCandidates = await fetchRosterCandidates(params.offeringId);

  const ops = upcoming.map((occurrence: any) => {
    const roster = rosterAtFromCandidates(rosterCandidates, occurrence.scheduledAt);

    // Preserve any attendance already marked on a seat that is still present.
    const previous = new Map<string, any>(
      (occurrence.roster || []).map((entry: any) => [entry.enrollmentId.toString(), entry])
    );
    const mergedRoster = roster.map((entry) => {
      const prior = previous.get(entry.enrollmentId.toString());
      return prior ? { ...entry, attendance: prior.attendance } : entry;
    });

    return {
      updateOne: {
        filter: { _id: occurrence._id },
        update: { $set: { roster: mergedRoster } },
      },
    };
  });

  await CoachSessionOccurrence.bulkWrite(ops);
  return ops.length;
};

/**
 * Sweep every active offering. Intended for a scheduled job so the window keeps
 * rolling forward without anyone touching the offering.
 */
export const generateForAllActiveOfferings = async (
  params: {
    now?: Date;
  } = {}
): Promise<{ offerings: number; created: number }> => {
  const now = params.now ?? new Date();
  const horizon = new Date(now.getTime() + GENERATION_WINDOW_DAYS * dayMs);

  const offerings = await CoachOffering.find({
    status: "ACTIVE",
    $or: [{ generatedThrough: null }, { generatedThrough: { $lt: horizon } }],
  }).exec();

  let created = 0;
  for (const offering of offerings) {
    const result = await generateOccurrences({ offering, now });
    created += result.created;
  }

  return { offerings: offerings.length, created };
};

// ───────────────── online sessions ─────────────────

/**
 * Set the meeting link for one session.
 *
 * Only a session that has not happened can have its link changed: rewriting the
 * link on a delivered session would falsify the record of what students were
 * actually told to join.
 */
export const setOccurrenceMeetingLink = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  meetingLink: string;
}): Promise<CoachSessionOccurrenceDocument> => {
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.delivery?.kind !== "ONLINE") {
    throw new Error("Only an online session has a meeting link");
  }
  if (occurrence.status !== "SCHEDULED") {
    throw new Error("The link can only be changed on a session that has not happened yet");
  }

  occurrence.delivery.meetingLink = params.meetingLink;
  // A link is now present, so a pending nudge is moot — clear the dedup so a
  // later removal can nudge again.
  occurrence.meetingLinkNudgeSentAt = null;
  await occurrence.save();
  return occurrence;
};

/**
 * Change an offering's standing room link, and roll it forward onto sessions
 * that have not happened yet.
 *
 * Past sessions keep the link they were delivered with, for the same reason
 * their delivery is a snapshot in the first place.
 */
export const setOfferingMeetingLink = async (params: {
  offeringId: mongoose.Types.ObjectId;
  meetingLink: string;
  now?: Date;
}): Promise<{ offering: CoachOfferingDocument; updatedSessions: number }> => {
  const now = params.now ?? new Date();
  const offering = await CoachOffering.findById(params.offeringId);
  if (!offering) throw new Error("Offering not found");

  if (offering.deliveryKind !== "ONLINE") {
    throw new Error("Only an online programme has a meeting link");
  }

  offering.defaultMeetingLink = params.meetingLink;
  await offering.save();

  const result = await CoachSessionOccurrence.updateMany(
    {
      offeringId: offering._id,
      status: "SCHEDULED",
      scheduledAt: { $gt: now },
    },
    {
      $set: {
        "delivery.meetingLink": params.meetingLink,
        meetingLinkNudgeSentAt: null,
      },
    }
  );

  return { offering, updatedSessions: result.modifiedCount ?? 0 };
};

export type { CoachSessionOccurrenceDocument };
