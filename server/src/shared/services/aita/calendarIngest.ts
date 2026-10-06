import { slugifyEditionName } from "../editionSlugText";
import { seriesFromEditionName } from "./editionSeries";
import {
  classifyLevel,
  type DateString,
  type FactSheet,
  type LevelClass,
  type MonthRow,
} from "./calendarParser";
import { deadlinesFor, entryFeeFor } from "./calendarRules";

/**
 * Deciding what to store from what AITA's calendar says. Pure: it takes the rows
 * read, the fact sheets read and the editions already stored, and returns the
 * writes that would bring the store in line. Nothing here touches a database or a
 * network, which is what lets the decisions be tested and then shown as a report
 * before a single row is written (`scripts/ingestAitaCalendar.ts`).
 *
 * ── Scope ───────────────────────────────────────────────────────────────────
 * Only the events a junior's season is built from: the AITA ladder and the ITF and
 * Asian junior events. The senior prize-money circuit, masters, pro tours and any
 * level this code has not been taught are counted and reported, never written, and
 * never retired either: they are not this reader's to maintain.
 *
 * ── Matching the old rows ───────────────────────────────────────────────────
 * Rows from the older calendar carry the Monday the event's main draw began on, not
 * its start date, and a short name such as "AITA CS7 (Delhi)". A row is the same
 * event when it has the same level, the same place and sits on the first Monday on
 * or after the start (a row not on a Monday must be within a day of it). A matched row is updated IN PLACE, keeping its name and slug, so
 * the pages already indexed under that slug keep working. Anything that does not
 * match becomes a new row. A row that matches nothing is only reported: retiring one
 * is a separate decision that needs more than one sweep's evidence.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const asDate = (value: DateString): Date => new Date(`${value}T00:00:00.000Z`);

/**
 * The Monday on or after a calendar day. Events start on a Saturday with qualifying
 * and the main draw begins on the Monday after, which is the day the older calendar
 * filed the event under (checked 2026-10-06: every old row that matched sat on the
 * Monday after its event's start).
 */
export function mondayOnOrAfter(value: DateString): DateString {
  const day = asDate(value);
  const forward = (8 - day.getUTCDay()) % 7;
  return new Date(day.getTime() + forward * DAY_MS).toISOString().slice(0, 10);
}

const norm = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

export interface StoredEdition {
  _id: unknown;
  name: string;
  slug?: string | null;
  startDate: Date;
  city?: string | null;
  state?: string | null;
  ladder?: string | null;
  kind?: string | null;
  externalId?: string | null;
  status?: string | null;
  lastCheckedAt?: Date | null;
  officialDetailsSource?: string | null;
}

const isJuniorKind = (kind: string): boolean =>
  kind === "junior-ladder" || kind === "international-junior";

/** Whether a stored row is one this reader maintains. */
export const isOurs = (stored: StoredEdition): boolean =>
  !!stored.externalId || (!!stored.kind && isJuniorKind(stored.kind));

// ─── Names ────────────────────────────────────────────────────────────────────

const PREFIX: Record<string, string> = {
  "Talent Series": "AITA TS",
  "Championship Series": "AITA CS",
  "Super Series": "AITA SS",
  "National Series": "AITA NS",
};

/**
 * The short name in the form the older calendar used, so rows read the same
 * whichever source made them: "AITA CS7 (Delhi)", "ITF Juniors (Pune)". The long
 * official title goes in `officialName`.
 */
export function shortName(row: MonthRow, level: LevelClass): string | null {
  const place = row.city ?? row.state;
  if (!place) return null;
  if (level.ladder === "Nationals") return `National Tennis Championship (${place})`;
  if (level.ladder) {
    const prefix = PREFIX[level.ladder]!;
    const hasLength = level.ladder === "Talent Series" || level.ladder === "Championship Series";
    return `${prefix}${hasLength && level.days ? level.days : ""} (${place})`;
  }
  return row.levelText ? `${row.levelText} (${place})` : null;
}

// ─── The writes ───────────────────────────────────────────────────────────────

/** The fields written for an event, whether it is created or updated. */
export interface EditionFields {
  federationSlug: "aita";
  officialName: string;
  editionYear: number;
  startDate: Date;
  endDate: Date;
  city?: string;
  state?: string;
  ageGroups: string[];
  category?: string;
  ladder?: string;
  grade?: number;
  circuit?: string;
  kind: string;
  externalId: string;
  detailUrl: string;
  sourceUrl: string;
  lastCheckedAt: Date;
  entryOpensDate?: Date;
  registrationDeadlineDate?: Date;
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
}

export interface CreateOp {
  externalId: string;
  doc: EditionFields & {
    sportSlug: "tennis";
    name: string;
    slug: string;
    status: "announced" | "ongoing";
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface UpdateOp {
  externalId: string;
  id: unknown;
  /** The stored name, which is kept. */
  name: string;
  /** How the row was matched, for the report. */
  matchedBy: "externalId" | "legacy";
  was: { startDate: string };
  set: EditionFields & { updatedAt: Date; status?: "announced" | "ongoing" };
}

export interface IngestPlan {
  creates: CreateOp[];
  updates: UpdateOp[];
  /** Events read but not written, with the reason. */
  skipped: Array<{ externalId: string; name: string; reason: string }>;
  /** Count of events outside this reader's scope, by kind. */
  outOfScope: Record<string, number>;
  /** Places where a fact sheet and the published rules disagree. Worth a human look. */
  warnings: string[];
  /** Stored rows this reader maintains that no AITA event matched. Reported only. */
  unmatched: StoredEdition[];
}

export interface IngestInput {
  rows: MonthRow[];
  sheets: Map<string, FactSheet>;
  stored: StoredEdition[];
  /** Slugs already in use, so new ones do not collide. */
  takenSlugs: Set<string>;
  sourceUrlFor: (row: MonthRow) => string;
  now: Date;
}

// ─── The details from the fact sheet, or from the rules ──────────────────────

type Details = Pick<
  EditionFields,
  | "entryOpensDate"
  | "registrationDeadlineDate"
  | "withdrawalDeadlineDate"
  | "freezeDeadlineDate"
  | "deadlineTimes"
  | "feeSingles"
  | "feeDoubles"
  | "dailyAllowance"
  | "surface"
  | "qualifyingStartDate"
  | "mainDrawStartDate"
  | "officialDetailsSource"
>;

/** Every field `detailsFor` can set. Listed once so "leave the stored details alone" cannot miss one. */
const DETAIL_KEYS: Array<keyof Details> = [
  "entryOpensDate",
  "registrationDeadlineDate",
  "withdrawalDeadlineDate",
  "freezeDeadlineDate",
  "deadlineTimes",
  "feeSingles",
  "feeDoubles",
  "dailyAllowance",
  "surface",
  "qualifyingStartDate",
  "mainDrawStartDate",
  "officialDetailsSource",
];

function detailsFor(
  row: MonthRow,
  level: LevelClass,
  sheet: FactSheet | undefined,
  warnings: string[]
): Details {
  const rulesDates = deadlinesFor(row.startDate, level.ladder, level.days);
  const rulesFee = entryFeeFor(level.ladder, level.days);
  const label = `${row.name} [${row.externalId}]`;
  const out: Details = {};

  if (sheet && (sheet.entryCloses || sheet.feeSingles !== null)) {
    if (sheet.entryOpens) out.entryOpensDate = asDate(sheet.entryOpens);
    if (sheet.entryCloses) out.registrationDeadlineDate = asDate(sheet.entryCloses.date);
    if (sheet.withdrawalDeadline)
      out.withdrawalDeadlineDate = asDate(sheet.withdrawalDeadline.date);
    if (sheet.freezeDeadline) out.freezeDeadlineDate = asDate(sheet.freezeDeadline.date);
    const times: NonNullable<Details["deadlineTimes"]> = {};
    if (sheet.entryCloses?.time) times.entryCloses = sheet.entryCloses.time;
    if (sheet.withdrawalDeadline?.time) times.withdrawal = sheet.withdrawalDeadline.time;
    if (sheet.freezeDeadline?.time) times.freeze = sheet.freezeDeadline.time;
    if (Object.keys(times).length > 0) out.deadlineTimes = times;
    if (sheet.feeSingles !== null) out.feeSingles = sheet.feeSingles;
    if (sheet.feeDoubles !== null) out.feeDoubles = sheet.feeDoubles;
    if (sheet.dailyAllowance !== null) out.dailyAllowance = sheet.dailyAllowance;
    if (sheet.surface) out.surface = sheet.surface;
    if (sheet.qualifyingFirstDay) out.qualifyingStartDate = asDate(sheet.qualifyingFirstDay);
    if (sheet.mainDrawFirstDay) out.mainDrawStartDate = asDate(sheet.mainDrawFirstDay);
    out.officialDetailsSource = "factSheet";

    // The sheet is the authority; where it parts from the rules, say so and keep the sheet.
    if (rulesDates) {
      if (sheet.entryCloses && sheet.entryCloses.date !== rulesDates.entryCloses) {
        warnings.push(
          `${label}: entries close ${sheet.entryCloses.date}, the rules give ${rulesDates.entryCloses}`
        );
      }
      if (sheet.withdrawalDeadline && sheet.withdrawalDeadline.date !== rulesDates.withdrawal) {
        warnings.push(
          `${label}: withdrawal ${sheet.withdrawalDeadline.date}, the rules give ${rulesDates.withdrawal}`
        );
      }
    }
    if (rulesFee && sheet.feeSingles !== null && sheet.feeSingles !== rulesFee.singles) {
      warnings.push(
        `${label}: singles fee ${sheet.feeSingles}, the rules give ${rulesFee.singles}`
      );
    }
    if (sheet.startDate && sheet.startDate !== row.startDate) {
      warnings.push(`${label}: the sheet starts ${sheet.startDate}, the calendar ${row.startDate}`);
    }
    return out;
  }

  // No readable sheet: state the rules, marked as the rules, or nothing.
  if (rulesDates || rulesFee) {
    if (rulesDates) {
      out.registrationDeadlineDate = asDate(rulesDates.entryCloses);
      out.withdrawalDeadlineDate = asDate(rulesDates.withdrawal);
      out.freezeDeadlineDate = asDate(rulesDates.freeze);
    }
    if (rulesFee) {
      out.feeSingles = rulesFee.singles;
      if (rulesFee.doubles !== null) out.feeDoubles = rulesFee.doubles;
    }
    out.officialDetailsSource = "rules";
  }
  return out;
}

// ─── The plan ─────────────────────────────────────────────────────────────────

const keyOf = (name: string, start: Date): string => `${name}|${start.toISOString()}`;

export function planIngest(input: IngestInput): IngestPlan {
  const plan: IngestPlan = {
    creates: [],
    updates: [],
    skipped: [],
    outOfScope: {},
    warnings: [],
    unmatched: [],
  };
  const todayIso = input.now.toISOString().slice(0, 10);

  // One entry per AITA event: a month-end event is listed in two months.
  const byId = new Map<string, MonthRow>();
  for (const row of input.rows) byId.set(row.externalId, row);
  const rows = [...byId.values()]
    .filter((row) => row.endDate >= todayIso)
    .sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.externalId.localeCompare(b.externalId)
    );

  const claimed = new Set<unknown>();
  const finalKeys = new Map<string, unknown>(); // name|start -> row id (or the string "new")
  for (const s of input.stored) finalKeys.set(keyOf(s.name, s.startDate), s._id);

  for (const row of rows) {
    const level = classifyLevel(row.levelText);
    if (!isJuniorKind(level.kind)) {
      plan.outOfScope[level.kind] = (plan.outOfScope[level.kind] ?? 0) + 1;
      continue;
    }

    // Every junior event lists an under-N group. One that lists none (a Nationals
    // event for men and women, say) is not a junior's to be offered, and an empty
    // age list would not say so to the planner.
    if (row.ageGroups.length === 0) {
      plan.skipped.push({
        externalId: row.externalId,
        name: row.name,
        reason: "lists no under-age group, so it is not offered as a junior event",
      });
      continue;
    }

    const sheet = input.sheets.get(row.externalId);
    const fields: EditionFields = {
      federationSlug: "aita",
      officialName: row.name,
      editionYear: Number(row.startDate.slice(0, 4)),
      startDate: asDate(row.startDate),
      endDate: asDate(row.endDate),
      ...(row.city ? { city: row.city } : {}),
      ...(row.state ? { state: row.state } : {}),
      ageGroups: row.ageGroups.map((age) => `Under-${age}`),
      ...(row.ageGroups.length > 0
        ? { category: row.ageGroups.map((age) => `Under ${age}`).join(" ") }
        : {}),
      ...(level.ladder ? { ladder: level.ladder } : {}),
      ...(level.ladder && level.days ? { grade: level.days } : {}),
      ...(level.circuit ? { circuit: level.circuit } : {}),
      kind: level.kind,
      externalId: row.externalId,
      detailUrl: row.factSheetUrl,
      sourceUrl: input.sourceUrlFor(row),
      lastCheckedAt: input.now,
      ...(level.kind === "junior-ladder" ? detailsFor(row, level, sheet, plan.warnings) : {}),
    };

    // ── An existing row for this event? ──────────────────────────────────
    const place = norm(row.city) || norm(row.state);
    const monday = mondayOnOrAfter(row.startDate);
    const sameLevel = (s: StoredEdition): boolean =>
      level.ladder ? s.ladder === level.ladder : s.kind === level.kind;
    const samePlace = (s: StoredEdition): boolean =>
      !!place && (norm(s.city) || norm(s.state)) === place;
    const distanceDays = (s: StoredEdition): number =>
      Math.abs(s.startDate.getTime() - asDate(row.startDate).getTime()) / DAY_MS;

    let hit = input.stored.find((s) => !claimed.has(s._id) && s.externalId === row.externalId);
    let matchedBy: UpdateOp["matchedBy"] = "externalId";
    if (!hit) {
      matchedBy = "legacy";
      hit = input.stored
        .filter((s) => !claimed.has(s._id) && !s.externalId && sameLevel(s) && samePlace(s))
        .filter((s) =>
          s.startDate.getUTCDay() === 1
            ? s.startDate.toISOString().slice(0, 10) === monday
            : distanceDays(s) <= 1
        )
        .sort((a, b) => distanceDays(a) - distanceDays(b))[0];
    }

    if (hit) {
      claimed.add(hit._id);
      const newKey = keyOf(hit.name, fields.startDate);
      const owner = finalKeys.get(newKey);
      if (owner !== undefined && owner !== hit._id) {
        plan.skipped.push({
          externalId: row.externalId,
          name: row.name,
          reason: `moving "${hit.name}" to ${row.startDate} would collide with another stored row`,
        });
        continue;
      }
      finalKeys.delete(keyOf(hit.name, hit.startDate));
      finalKeys.set(newKey, hit._id);

      const set: UpdateOp["set"] = { ...fields, updatedAt: input.now };
      // A fact sheet that cannot be read this time must not replace what an earlier
      // sweep read from one with the rules' version of it: that is a downgrade
      // caused by a bad minute on AITA's server. The stored details stay as they are.
      if (!sheet && hit.officialDetailsSource === "factSheet") {
        for (const key of DETAIL_KEYS) delete set[key];
      }
      // An event this reader cancelled for going missing, and that AITA lists again.
      if (hit.status === "cancelled")
        set.status = row.startDate <= todayIso ? "ongoing" : "announced";

      plan.updates.push({
        externalId: row.externalId,
        id: hit._id,
        name: hit.name,
        matchedBy,
        was: { startDate: hit.startDate.toISOString().slice(0, 10) },
        set,
      });
      continue;
    }

    // ── A new row ────────────────────────────────────────────────────────
    const base = shortName(row, level);
    if (!base) {
      plan.skipped.push({
        externalId: row.externalId,
        name: row.name,
        reason: "no city or state to name it by",
      });
      continue;
    }
    // A name that does not read back as the same level would be filed wrongly by every
    // later reader of the name, so it is refused and reported rather than stored.
    const readBack = seriesFromEditionName(base, row.name);
    if (readBack.kind !== level.kind || readBack.ladder !== level.ladder) {
      plan.skipped.push({
        externalId: row.externalId,
        name: row.name,
        reason: `"${base}" reads back as ${readBack.kind}/${readBack.ladder}, not ${level.kind}/${level.ladder}`,
      });
      continue;
    }

    let name = base;
    if (finalKeys.has(keyOf(name, fields.startDate))) {
      // Two events of one level in one place starting one day: tell them apart by age group, then by id.
      const place2 = row.city ?? row.state!;
      const ages =
        row.ageGroups.length > 0
          ? `${place2} ${row.ageGroups.map((a) => `U${a}`).join("/")}`
          : place2;
      name = base.replace(`(${place2})`, `(${ages})`);
      if (name === base || finalKeys.has(keyOf(name, fields.startDate))) {
        name = base.replace(`(${place2})`, `(${place2} #${row.externalId})`);
      }
    }
    finalKeys.set(keyOf(name, fields.startDate), "new");

    const slugBase = `${slugifyEditionName(name)}-${row.startDate}`.replace(/^-/, "");
    let slug = slugBase;
    for (let n = 2; input.takenSlugs.has(slug); n += 1) slug = `${slugBase}-${n}`;
    input.takenSlugs.add(slug);

    plan.creates.push({
      externalId: row.externalId,
      doc: {
        sportSlug: "tennis",
        name,
        slug,
        status: row.startDate <= todayIso ? "ongoing" : "announced",
        createdAt: input.now,
        updatedAt: input.now,
        ...fields,
      },
    });
  }

  plan.unmatched = input.stored.filter(
    (s) => isOurs(s) && !claimed.has(s._id) && s.startDate.toISOString().slice(0, 10) >= todayIso
  );
  return plan;
}

// ─── Events that have gone from AITA's calendar ───────────────────────────────

export interface RetirementInput {
  stored: StoredEdition[];
  /** AITA's id for every event any month page listed, of any level. */
  seenIds: Set<string>;
  /** The first and last day the months read cover, `YYYY-MM-DD`. */
  rangeStart: DateString;
  rangeEnd: DateString;
  now: Date;
  /**
   * An event must also have gone unseen this long before it is cancelled. Sweeps
   * stamp `lastCheckedAt` on everything they see, so this is "missing from at least
   * two sweeps a week apart" without a counter, and a manual run a minute after the
   * scheduled one cannot double the evidence.
   */
  minUnseenDays?: number;
}

export interface RetirementPlan {
  /** Rows to mark cancelled. */
  cancel: StoredEdition[];
  /** Rows missing from this sweep but not yet unseen long enough. */
  watching: StoredEdition[];
  /** Set when the sweep looks wrong enough that nothing should be cancelled or written. */
  refused: string | null;
}

/**
 * Which of the events this reader created have disappeared from AITA's calendar.
 *
 * Only rows with an AITA id are considered (a row the older calendar made is not
 * this reader's to judge), only ones that have not started (a vanished event that is
 * under way or finished is history, not a cancellation), and only ones inside the
 * months actually read (AITA lists two to three months ahead, so an event further out
 * is absent for a reason that says nothing about it).
 *
 * Refuses outright when the page set looks broken: nothing listed at all, or fewer
 * than half the events we hold for these months. A real calendar does not lose half
 * its events in a week, a changed page does, and cancelling on that evidence would
 * wipe the planner.
 */
export function planRetirements(input: RetirementInput): RetirementPlan {
  const minUnseenMs = (input.minUnseenDays ?? 10) * DAY_MS;
  const todayIso = input.now.toISOString().slice(0, 10);

  const ours = input.stored.filter(
    (s) =>
      !!s.externalId &&
      s.status !== "cancelled" &&
      isOwnStart(s, todayIso, input.rangeStart, input.rangeEnd)
  );

  if (input.seenIds.size === 0) {
    return { cancel: [], watching: [], refused: "AITA's pages listed no events at all" };
  }
  const stillListed = ours.filter((s) => input.seenIds.has(s.externalId!)).length;
  if (ours.length >= 10 && stillListed < ours.length / 2) {
    return {
      cancel: [],
      watching: [],
      refused:
        `only ${stillListed} of the ${ours.length} upcoming events we hold are still listed, ` +
        "which looks like a changed page and not a calendar change",
    };
  }

  const missing = ours.filter((s) => !input.seenIds.has(s.externalId!));
  const cancel: StoredEdition[] = [];
  const watching: StoredEdition[] = [];
  for (const row of missing) {
    const unseenFor = row.lastCheckedAt
      ? input.now.getTime() - row.lastCheckedAt.getTime()
      : Infinity;
    (unseenFor >= minUnseenMs ? cancel : watching).push(row);
  }
  return { cancel, watching, refused: null };
}

function isOwnStart(
  s: StoredEdition,
  todayIso: string,
  start: DateString,
  end: DateString
): boolean {
  const day = s.startDate.toISOString().slice(0, 10);
  return day >= todayIso && day >= start && day <= end;
}
