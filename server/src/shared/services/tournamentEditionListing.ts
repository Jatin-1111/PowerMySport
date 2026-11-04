import { TournamentEdition } from "../models/TournamentEdition";
import { AITA_LADDER_ORDER, seriesLabel, type EditionSeries } from "./aita/editionSeries";

// ─── One sport's editions, filtered, for the public tournaments pages ───────
//
// The filters a parent actually narrows by: what sort of event it is, their
// child's age group, and the month. Each one's options are read from the data
// rather than from a per-sport list, so a sport with a calendar gets working
// filters the day it is approved, and a sport whose calendar has no category
// information simply shows no category filter instead of an empty one.
//
// Deliberately NOT a filter: state. It is blank on most tennis rows, so a state
// picker would quietly hide events that are in the state being asked for.

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MAX_AGE_LABEL_LENGTH = 40;

export interface EditionListFilters {
  /** A category value from the facets, e.g. "championship-series". */
  category?: string | undefined;
  /** An age group exactly as stored, e.g. "Under-14". */
  age?: string | undefined;
  /** "2026-10". */
  month?: string | undefined;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface EditionFacets {
  categories: FacetOption[];
  ages: FacetOption[];
  months: FacetOption[];
}

interface SeriesFields {
  ladder?: string | null;
  kind?: string | null;
  circuit?: string | null;
}

const slugify = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * What sort of event this is, as a parent would name it. The ladder rung
 * without its grade number, so "CS7" and "CS5" sit under one Championship
 * Series option (the grade's meaning is unsourced; see editionSeries.ts).
 * Null when nothing is known, which is every row outside tennis today.
 */
export function categoryLabelFor(edition: SeriesFields): string | null {
  if (edition.ladder) return edition.ladder;
  if (!edition.kind) return null;
  return seriesLabel({
    ladder: null,
    grade: null,
    circuit: (edition.circuit ?? null) as EditionSeries["circuit"],
    kind: edition.kind as EditionSeries["kind"],
  });
}

/** Ladder rungs in ladder order first, then everything else by how common it is. */
const categoryRank = (label: string): number => {
  const rung = (AITA_LADDER_ORDER as readonly string[]).indexOf(label);
  return rung === -1 ? AITA_LADDER_ORDER.length : rung;
};

/** "Under-12" before "Under-14", and "Men"/"Women" after every numbered group. */
export function compareAgeGroups(a: string, b: string): number {
  const number = (label: string) => {
    const match = label.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
  };
  return number(a) - number(b) || a.localeCompare(b);
}

/** The month as a half-open UTC range, or null for anything that is not "YYYY-MM". */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const match = month.match(MONTH_PATTERN);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const index = parseInt(match[2]!, 10) - 1;
  return {
    from: new Date(Date.UTC(year, index, 1)),
    to: new Date(Date.UTC(year, index + 1, 1)),
  };
}

const monthLabel = (month: string): string => {
  const range = monthRange(month);
  return range
    ? range.from.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    : month;
};

interface CategoryGroup {
  label: string;
  value: string;
  count: number;
  /** One exact match per (ladder, kind, circuit) the label covers. */
  conditions: Array<Record<string, string | null>>;
}

/**
 * Upcoming or past editions of one sport, one page at a time, with the options
 * each filter offers. Options are counted over the whole upcoming (or past)
 * window rather than the current selection, so picking one filter never makes
 * the others' options disappear from under the reader.
 */
export async function listSportEditions(
  sportSlug: string,
  options: { page: number; limit: number; upcoming: boolean; filters: EditionListFilters }
) {
  const { page, limit, upcoming, filters } = options;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const base = {
    sportSlug,
    slug: { $exists: true, $ne: null },
    status: { $ne: "cancelled" },
    startDate: upcoming ? { $gte: startOfToday } : { $lt: startOfToday },
    mergedInto: { $in: [null, undefined] },
  };

  const [seriesRows, ageRows, monthRows] = await Promise.all([
    TournamentEdition.aggregate<{ _id: SeriesFields; count: number }>([
      { $match: base },
      {
        $group: {
          _id: { ladder: "$ladder", kind: "$kind", circuit: "$circuit" },
          count: { $sum: 1 },
        },
      },
    ]),
    TournamentEdition.aggregate<{ _id: string; count: number }>([
      { $match: base },
      { $unwind: "$ageGroups" },
      { $group: { _id: "$ageGroups", count: { $sum: 1 } } },
    ]),
    TournamentEdition.aggregate<{ _id: string; count: number }>([
      { $match: base },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$startDate", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const groups = new Map<string, CategoryGroup>();
  for (const row of seriesRows) {
    const label = categoryLabelFor(row._id);
    if (!label) continue;
    const value = slugify(label);
    const group = groups.get(value) ?? { label, value, count: 0, conditions: [] };
    group.count += row.count;
    // `null` in a Mongo equality matches a missing field too, which is what a
    // row the classifier never touched looks like.
    group.conditions.push({
      ladder: row._id.ladder ?? null,
      kind: row._id.kind ?? null,
      circuit: row._id.circuit ?? null,
    });
    groups.set(value, group);
  }

  const categories = [...groups.values()].sort(
    (a, b) =>
      categoryRank(a.label) - categoryRank(b.label) ||
      b.count - a.count ||
      a.label.localeCompare(b.label)
  );

  const facets: EditionFacets = {
    categories: categories.map(({ value, label, count }) => ({ value, label, count })),
    ages: ageRows
      .filter((row) => typeof row._id === "string" && row._id.trim())
      .sort((a, b) => compareAgeGroups(a._id, b._id))
      .map((row) => ({ value: row._id, label: row._id, count: row.count })),
    months: monthRows
      .filter((row) => typeof row._id === "string")
      .sort((a, b) => (upcoming ? a._id.localeCompare(b._id) : b._id.localeCompare(a._id)))
      .map((row) => ({ value: row._id, label: monthLabel(row._id), count: row.count })),
  };

  // Only a filter that matched something real is applied, and only those are
  // echoed back, so a stale or hand-edited link degrades to "everything"
  // instead of an empty page the reader cannot explain.
  const and: Record<string, unknown>[] = [];
  const applied: EditionListFilters = {};

  const category = filters.category ? groups.get(filters.category) : undefined;
  if (category) {
    and.push({ $or: category.conditions });
    applied.category = category.value;
  }

  const age = filters.age?.trim();
  if (age && age.length <= MAX_AGE_LABEL_LENGTH && facets.ages.some((a) => a.value === age)) {
    and.push({ ageGroups: age });
    applied.age = age;
  }

  const range = filters.month ? monthRange(filters.month) : null;
  if (range) {
    and.push({ startDate: { $gte: range.from, $lt: range.to } });
    applied.month = filters.month;
  }

  const filter = and.length > 0 ? { ...base, $and: and } : base;

  const [editions, total] = await Promise.all([
    TournamentEdition.find(filter)
      .sort({ startDate: upcoming ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "slug name officialName startDate endDate registrationDeadlineDate city state venue " +
          "level ageGroups federationSlug ladder grade circuit kind"
      )
      .lean(),
    TournamentEdition.countDocuments(filter),
  ]);

  return {
    editions: editions.map((edition) => ({
      ...edition,
      categoryLabel: categoryLabelFor(edition),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    facets,
    applied,
  };
}
