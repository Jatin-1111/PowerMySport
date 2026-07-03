import mongoose from "mongoose";
import { ExpertDocument } from "../models/ExpertProfile";
import { ExpertSession } from "../models/ExpertBooking";

/**
 * Availability + slot computation for expert sessions.
 *
 * Availability is stored as recurring weekly windows (local "HH:mm" in the
 * expert's timezone) plus blackout dates. Bookable slots are those windows
 * split into `sessionDurationMinutes` chunks, minus:
 *   - slots in the past,
 *   - blackout dates,
 *   - slots overlapping an existing non-cancelled session (or an unexpired
 *     PENDING_PAYMENT hold).
 *
 * India (Asia/Kolkata, the default) has no DST so the offset is stable; the
 * generic `Intl`-based offset lookup below keeps other timezones correct too.
 */

const MS_PER_MIN = 60_000;
const MAX_RANGE_DAYS = 62;

const pad = (n: number) => String(n).padStart(2, "0");

const toDateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const parseHHmm = (v: string): number => {
  const parts = v.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

/** Parse "YYYY-MM-DD" into a [year, month, day] number tuple (no undefined). */
const parseDateKey = (dateKey: string): [number, number, number] => {
  const p = dateKey.split("-").map(Number);
  return [p[0] ?? 1970, p[1] ?? 1, p[2] ?? 1];
};

/** Minutes that `tz` is ahead of UTC at the given instant. */
const tzOffsetMinutes = (tz: string, at: Date): number => {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(at).reduce<Record<string, string>>(
      (acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      },
      {},
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === "24" ? "0" : parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((asUtc - at.getTime()) / MS_PER_MIN);
  } catch {
    return 0; // treat unknown tz as UTC
  }
};

/** Convert a local "YYYY-MM-DD" + minutes-from-midnight in `tz` to a UTC Date. */
const zonedToUtc = (dateKey: string, minutesFromMidnight: number, tz: string): Date => {
  const [y, m, d] = parseDateKey(dateKey);
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(tz, new Date(utcGuess));
  return new Date(utcGuess - offset * MS_PER_MIN);
};

/** Weekday (0=Sun..6=Sat) of a calendar date, tz-independent. */
const weekdayOfDateKey = (dateKey: string): number => {
  const [y, m, d] = parseDateKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const addDaysKey = (dateKey: string, days: number): string => {
  const [y, m, d] = parseDateKey(dateKey);
  return toDateKey(new Date(Date.UTC(y, m - 1, d + days)));
};

interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

/** Busy intervals (booked or held) for an expert within [from,to]. */
const getBusyIntervals = async (
  expertId: mongoose.Types.ObjectId,
  from: Date,
  to: Date,
  excludeSessionId?: string,
): Promise<Interval[]> => {
  const now = new Date();
  const query: Record<string, unknown> = {
    expertId,
    scheduledAt: { $gte: new Date(from.getTime() - 12 * 60 * MS_PER_MIN), $lte: to },
    $or: [
      { status: { $in: ["PAID", "SCHEDULED", "COMPLETED"] } },
      // Unexpired holds still block the slot.
      { status: "PENDING_PAYMENT", holdExpiresAt: { $gt: now } },
    ],
  };
  if (excludeSessionId && mongoose.isValidObjectId(excludeSessionId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeSessionId) };
  }
  const sessions = await ExpertSession.find(query)
    .select("scheduledAt durationMinutes")
    .lean();
  return sessions
    .filter((s) => s.scheduledAt)
    .map((s) => {
      const start = new Date(s.scheduledAt as Date).getTime();
      return { start, end: start + (s.durationMinutes || 60) * MS_PER_MIN };
    });
};

const overlaps = (aStart: number, aEnd: number, list: Interval[]): boolean =>
  list.some((i) => aStart < i.end && aEnd > i.start);

export interface OpenSlot {
  start: string; // ISO
  end: string; // ISO
}

/**
 * Compute bookable slots for an expert across a date range (inclusive),
 * capped at MAX_RANGE_DAYS.
 */
export const computeOpenSlots = async (
  expert: ExpertDocument,
  fromISO?: string,
  toISO?: string,
): Promise<OpenSlot[]> => {
  const tz = expert.timezone || "Asia/Kolkata";
  const duration = expert.sessionDurationMinutes || 60;
  const windows = expert.weeklyAvailability || [];
  if (windows.length === 0) return [];

  const now = new Date();
  const from = fromISO ? new Date(fromISO) : now;
  let to = toISO ? new Date(toISO) : new Date(now.getTime() + 14 * 24 * 60 * MS_PER_MIN);
  const maxTo = new Date(from.getTime() + MAX_RANGE_DAYS * 24 * 60 * MS_PER_MIN);
  if (to > maxTo) to = maxTo;

  const busy = await getBusyIntervals(
    expert._id as mongoose.Types.ObjectId,
    from,
    to,
  );
  const blackout = new Set(expert.blackoutDates || []);

  const slots: OpenSlot[] = [];
  // Iterate calendar dates spanning [from, to] in the expert's tz vicinity.
  let dateKey = toDateKey(new Date(from.getTime() - 1 * 24 * 60 * MS_PER_MIN));
  const endKey = toDateKey(new Date(to.getTime() + 1 * 24 * 60 * MS_PER_MIN));

  let guard = 0;
  while (dateKey <= endKey && guard < MAX_RANGE_DAYS + 4) {
    guard += 1;
    if (!blackout.has(dateKey)) {
      const weekday = weekdayOfDateKey(dateKey);
      const dayWindows = windows.filter((w) => w.dayOfWeek === weekday);
      for (const w of dayWindows) {
        const startMin = parseHHmm(w.start);
        const endMin = parseHHmm(w.end);
        for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
          const slotStart = zonedToUtc(dateKey, cursor, tz);
          const slotEnd = new Date(slotStart.getTime() + duration * MS_PER_MIN);
          if (slotStart < from || slotStart <= now) continue;
          if (slotStart > to) continue;
          if (overlaps(slotStart.getTime(), slotEnd.getTime(), busy)) continue;
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
      }
    }
    dateKey = addDaysKey(dateKey, 1);
  }

  // De-dupe + sort (windows on adjacent iterations can produce the same slot).
  const seen = new Set<string>();
  return slots
    .filter((s) => (seen.has(s.start) ? false : (seen.add(s.start), true)))
    .sort((a, b) => a.start.localeCompare(b.start));
};

/**
 * Validate that `scheduledAt` is a bookable slot for the expert:
 * within an availability window, aligned to the duration grid, not in the past,
 * not on a blackout date, and not conflicting with another session.
 * Throws with a user-facing message when not bookable.
 */
export const assertSlotBookable = async (
  expert: ExpertDocument,
  scheduledAt: Date,
  excludeSessionId?: string,
): Promise<void> => {
  if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date/time");
  const now = new Date();
  if (scheduledAt <= now) throw new Error("Please choose a future time");

  const tz = expert.timezone || "Asia/Kolkata";
  const duration = expert.sessionDurationMinutes || 60;
  const windows = expert.weeklyAvailability || [];
  if (windows.length === 0) {
    throw new Error("This expert has not published any availability yet");
  }

  const dateKey = ((): string => {
    // Determine the expert-local calendar date of the instant.
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf.format(scheduledAt); // en-CA => YYYY-MM-DD
  })();

  if ((expert.blackoutDates || []).includes(dateKey)) {
    throw new Error("The expert is unavailable on this date");
  }

  const weekday = weekdayOfDateKey(dateKey);
  const dayWindows = windows.filter((w) => w.dayOfWeek === weekday);
  if (dayWindows.length === 0) {
    throw new Error("The chosen time is outside the expert's availability");
  }

  const aligned = dayWindows.some((w) => {
    const startMin = parseHHmm(w.start);
    const endMin = parseHHmm(w.end);
    for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
      const slotStart = zonedToUtc(dateKey, cursor, tz);
      if (Math.abs(slotStart.getTime() - scheduledAt.getTime()) < MS_PER_MIN) {
        return true;
      }
    }
    return false;
  });
  if (!aligned) {
    throw new Error("The chosen time is outside the expert's availability");
  }

  const slotEnd = new Date(scheduledAt.getTime() + duration * MS_PER_MIN);
  const busy = await getBusyIntervals(
    expert._id as mongoose.Types.ObjectId,
    scheduledAt,
    slotEnd,
    excludeSessionId,
  );
  if (overlaps(scheduledAt.getTime(), slotEnd.getTime(), busy)) {
    throw new Error("That slot has just been taken — please pick another time");
  }
};
