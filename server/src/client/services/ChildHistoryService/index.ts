import {
  CHILD_HISTORY_LIMITS,
  type ChildEventDatePrecision,
  type ChildHistoryView,
} from "@powermysport/shared-types";
import mongoose from "mongoose";
import { AppError } from "../../../utils/AppError";
import { ChildAcademicProfile } from "../../models/ChildAcademicProfile";
import { ChildEvent } from "../../models/ChildEvent";
import { Player } from "../../models/Player";
import { SeasonPlan } from "../../models/SeasonPlan";
import { RankingClaimService } from "../RankingClaimService";
import type { CreateChildEventInput, SaveAcademicsInput, UpdateChildEventInput } from "./schemas";
import { buildStats, buildTimeline, presentStoredEvent, type StoredEvent } from "./timeline";
import { cleanResultUrl, plainText } from "./text";
import { hasCurrentVideoConsent, listVideosFor } from "./videos";

/**
 * A child's sporting history: what the parent recorded, and the timeline built from it.
 *
 * Every call starts by proving the child belongs to the caller, and nothing the request says
 * (a user id, a child id in the body) is trusted over that. Text is cleaned here, once. The
 * limits come from `shared-types`, so the screens and the server cannot disagree about them.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day, as UTC midnight. Rejects 2026-02-31, which `Date` would roll forward. */
const parseDay = (value: string): Date => {
  const match = DAY.exec(value);
  const date = match ? new Date(`${value}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError("That date does not exist. Use a date like 2026-03-15.", 400);
  }
  return date;
};

/** A month or a year is stored as its first day, so sorting stays simple and nothing is invented. */
const atPrecision = (date: Date, precision: ChildEventDatePrecision): Date => {
  if (precision === "year") return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  if (precision === "month")
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return date;
};

const assertNotFuture = (date: Date): void => {
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new AppError(
      "This is a record of what has happened, so the date cannot be in the future.",
      400
    );
  }
};

export const assertOwnedChild = async (userId: string, childId: string) => {
  if (!mongoose.isValidObjectId(childId))
    throw new AppError("Choose which child this is for.", 400);
  const child = await Player.findOne({ _id: childId, userId })
    .select("name chosenSport chosenSportAt sportsFocus experienceLevel yearsPlaying")
    .lean();
  if (!child) throw new AppError("Child profile not found.", 404);
  return child;
};

/** One child holds a bounded number of entries, so a typo or a script cannot grow it forever. */
const assertRoom = async (childId: string): Promise<void> => {
  const count = await ChildEvent.countDocuments({ childId });
  if (count >= CHILD_HISTORY_LIMITS.eventsPerChild) {
    throw new AppError(
      `A child's history holds up to ${CHILD_HISTORY_LIMITS.eventsPerChild} entries. Remove one before adding another.`,
      400
    );
  }
};

const assertOwnedEventId = (eventId: string): void => {
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("That entry was not found.", 404);
};

interface Prepared {
  occurredOn: Date;
  datePrecision: ChildEventDatePrecision;
  endedOn?: Date;
}

const prepareDates = (
  kind: string,
  date: string,
  precision: ChildEventDatePrecision,
  endedOn: string | null | undefined
): Prepared => {
  const occurredOn = atPrecision(parseDay(date), precision);
  assertNotFuture(occurredOn);
  if (endedOn === undefined || endedOn === null) return { occurredOn, datePrecision: precision };
  if (kind !== "coaching_period") {
    throw new AppError("Only a coaching spell has an end date.", 400);
  }
  const ended = atPrecision(parseDay(endedOn), precision);
  assertNotFuture(ended);
  if (ended.getTime() < occurredOn.getTime()) {
    throw new AppError("The end date cannot be before the start date.", 400);
  }
  return { occurredOn, datePrecision: precision, endedOn: ended };
};

/** What a write hands back: the row as the timeline shows it, never the raw document. */
const toStored = (doc: { toObject(): unknown }) =>
  presentStoredEvent(doc.toObject() as StoredEvent);

export const ChildHistoryService = {
  /** The whole page: header, tiles, academics and the timeline, built from live data. */
  async get(userId: string, childId: string): Promise<ChildHistoryView> {
    const child = await assertOwnedChild(userId, childId);

    const [stored, plan, academics, claims, videos, videoConsent] = await Promise.all([
      ChildEvent.find({ childId }).sort({ occurredOn: -1 }).lean(),
      SeasonPlan.findOne({ userId, dependentId: childId }).select("entries").lean(),
      ChildAcademicProfile.findOne({ childId }).lean(),
      RankingClaimService.list(userId),
      listVideosFor(childId),
      hasCurrentVideoConsent(userId),
    ]);

    const input = {
      stored: stored as unknown as StoredEvent[],
      played: (plan?.entries ?? [])
        .filter((entry) => entry.status === "played")
        .map((entry) => ({
          editionSlug: entry.editionSlug,
          name: entry.name,
          startDate: entry.startDate,
        })),
      chosenSport:
        child.chosenSport && child.chosenSportAt
          ? { name: child.chosenSport, at: child.chosenSportAt }
          : undefined,
      standings: claims
        .filter((claim) => claim.dependentId === childId)
        .flatMap((claim) => claim.standings),
    };

    const currentYear = new Date().getUTCFullYear();
    const sport = child.chosenSport ?? child.sportsFocus?.[0] ?? null;

    return {
      child: {
        id: childId,
        name: child.name,
        sport,
        level: child.experienceLevel ?? null,
        sinceYear: typeof child.yearsPlaying === "number" ? currentYear - child.yearsPlaying : null,
      },
      stats: buildStats(input, child.yearsPlaying),
      academics: academics
        ? {
            ...(academics.board ? { board: academics.board } : {}),
            ...(academics.graduationYear ? { graduationYear: academics.graduationYear } : {}),
            ...(academics.school ? { school: academics.school } : {}),
            ...(academics.intendedField ? { intendedField: academics.intendedField } : {}),
          }
        : null,
      timeline: buildTimeline(input),
      videos,
      videoConsent,
      usage: { events: stored.length, limit: CHILD_HISTORY_LIMITS.eventsPerChild },
    };
  },

  async createEvent(userId: string, childId: string, input: CreateChildEventInput) {
    await assertOwnedChild(userId, childId);

    const title = plainText(input.title, CHILD_HISTORY_LIMITS.titleChars);
    if (!title) throw new AppError("Give this entry a title.", 400);

    const dates = prepareDates(input.kind, input.date, input.datePrecision, input.endedOn);
    const resultUrl = cleanResultUrl(input.resultUrl);
    const detail = plainText(input.detail, CHILD_HISTORY_LIMITS.detailChars);
    const resultLabel = plainText(input.resultLabel, CHILD_HISTORY_LIMITS.resultLabelChars);
    const sportSlug = plainText(input.sportSlug, 60);
    const editionSlug = plainText(input.editionSlug, 120)?.toLowerCase();

    if (editionSlug && input.kind !== "tournament_result") {
      throw new AppError("Only a tournament result can belong to a tournament.", 400);
    }

    const fields = {
      kind: input.kind,
      title,
      ...(detail ? { detail } : {}),
      ...(resultLabel ? { resultLabel } : {}),
      ...(resultUrl ? { resultUrl } : {}),
      ...(sportSlug ? { sportSlug } : {}),
      ...dates,
    };

    if (editionSlug) {
      // A result for a tournament the child played. The planner is the proof that it was played,
      // and there is one stored result per tournament, so adding it again edits it.
      const played = await SeasonPlan.exists({
        userId,
        dependentId: childId,
        entries: { $elemMatch: { editionSlug, status: "played" } },
      });
      if (!played) {
        throw new AppError("Mark that tournament as played in the planner first.", 400);
      }
      const existing = await ChildEvent.exists({ childId, editionSlug });
      if (!existing) await assertRoom(childId);
      const unset = noUnset(fields);
      const saved = await ChildEvent.findOneAndUpdate(
        { childId, editionSlug },
        { $set: { ...fields, userId }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return toStored(saved);
    }

    await assertRoom(childId);
    const created = await ChildEvent.create({ ...fields, childId, userId });
    return toStored(created);
  },

  async updateEvent(
    userId: string,
    childId: string,
    eventId: string,
    input: UpdateChildEventInput
  ) {
    await assertOwnedChild(userId, childId);
    assertOwnedEventId(eventId);

    const event = await ChildEvent.findOne({ _id: eventId, childId, userId });
    if (!event) throw new AppError("That entry was not found.", 404);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};

    if (input.title !== undefined) {
      const title = plainText(input.title, CHILD_HISTORY_LIMITS.titleChars);
      if (!title) throw new AppError("Give this entry a title.", 400);
      set.title = title;
    }
    const optionalText: Array<["detail" | "resultLabel", number]> = [
      ["detail", CHILD_HISTORY_LIMITS.detailChars],
      ["resultLabel", CHILD_HISTORY_LIMITS.resultLabelChars],
    ];
    for (const [field, max] of optionalText) {
      if (input[field] === undefined) continue;
      const value = plainText(input[field], max);
      if (value) set[field] = value;
      else unset[field] = "";
    }
    if (input.resultUrl !== undefined) {
      const url = cleanResultUrl(input.resultUrl);
      if (url) set.resultUrl = url;
      else unset.resultUrl = "";
    }

    if (
      input.date !== undefined ||
      input.datePrecision !== undefined ||
      input.endedOn !== undefined
    ) {
      const precision = input.datePrecision ?? event.datePrecision;
      const date = input.date ?? event.occurredOn.toISOString().slice(0, 10);
      const endedOn =
        input.endedOn === undefined
          ? event.endedOn
            ? event.endedOn.toISOString().slice(0, 10)
            : null
          : input.endedOn;
      const dates = prepareDates(event.kind, date, precision, endedOn);
      set.occurredOn = dates.occurredOn;
      set.datePrecision = dates.datePrecision;
      if (dates.endedOn) set.endedOn = dates.endedOn;
      else unset.endedOn = "";
    }

    const updated = await ChildEvent.findOneAndUpdate(
      { _id: eventId, childId, userId },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true }
    );
    if (!updated) throw new AppError("That entry was not found.", 404);
    return toStored(updated);
  },

  async deleteEvent(userId: string, childId: string, eventId: string): Promise<void> {
    await assertOwnedChild(userId, childId);
    assertOwnedEventId(eventId);
    const result = await ChildEvent.deleteOne({ _id: eventId, childId, userId });
    if (result.deletedCount === 0) throw new AppError("That entry was not found.", 404);
  },

  async saveAcademics(userId: string, childId: string, input: SaveAcademicsInput) {
    await assertOwnedChild(userId, childId);

    const currentYear = new Date().getUTCFullYear();
    if (
      typeof input.graduationYear === "number" &&
      (input.graduationYear < currentYear - 1 || input.graduationYear > currentYear + 14)
    ) {
      throw new AppError(
        `The year a child finishes school should be between ${currentYear - 1} and ${currentYear + 14}.`,
        400
      );
    }

    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    if (input.board !== undefined) {
      if (input.board) set.board = input.board;
      else unset.board = "";
    }
    if (input.graduationYear !== undefined) {
      if (input.graduationYear !== null) set.graduationYear = input.graduationYear;
      else unset.graduationYear = "";
    }
    for (const field of ["school", "intendedField"] as const) {
      if (input[field] === undefined) continue;
      const value = plainText(input[field], 120);
      if (value) set[field] = value;
      else unset[field] = "";
    }

    const saved = await ChildAcademicProfile.findOneAndUpdate(
      { childId },
      {
        $set: { ...set, userId },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return saved;
  },
};

/**
 * When a result is saved again, an optional field the parent left empty this time is removed, so
 * the stored entry always says what the form said last. Fields present in `fields` are never unset.
 */
function noUnset(fields: Record<string, unknown>): Record<string, ""> {
  const optional = ["detail", "resultLabel", "resultUrl", "sportSlug", "endedOn"];
  return Object.fromEntries(optional.filter((key) => !(key in fields)).map((key) => [key, ""]));
}
