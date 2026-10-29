import {
  CHILD_EVENT_SECTION,
  sourceOf,
  type ChildEventKind,
  type ChildHistoryView,
  type ChildTimelineRow,
} from "@powermysport/shared-types";
import type { RankingStanding } from "../RankingClaimService";

/**
 * Builds the timeline a parent sees from what is stored and what the platform already knows.
 *
 * Pure: it takes plain data and returns rows, so every rule here is tested without a database.
 * Stored entries come first in meaning, derived rows fill in around them:
 *
 *   - a tournament marked played in the planner is a row of its own until the parent stores a
 *     result for it, after which the stored entry replaces it (matched on the edition slug);
 *   - the sport the family chose is one row;
 *   - each current ranking is one row, read live, labelled as from the ranking list.
 *
 * Nothing derived is written anywhere, so none of it can disagree with its source.
 */

export interface StoredEvent {
  _id: { toString(): string };
  kind: ChildEventKind;
  title: string;
  detail?: string | null | undefined;
  resultLabel?: string | null | undefined;
  occurredOn: Date;
  datePrecision: "day" | "month" | "year";
  endedOn?: Date | null | undefined;
  resultUrl?: string | null | undefined;
  editionSlug?: string | null | undefined;
}

export interface PlayedEntry {
  editionSlug: string;
  name: string;
  startDate: Date;
}

export interface TimelineInput {
  stored: StoredEvent[];
  played: PlayedEntry[];
  chosenSport?: { name: string; at: Date } | undefined;
  standings: RankingStanding[];
}

const iso = (date: Date): string => date.toISOString();

export const presentStoredEvent = (event: StoredEvent): ChildTimelineRow => ({
  id: String(event._id),
  origin: "stored",
  kind: event.kind,
  section: CHILD_EVENT_SECTION[event.kind],
  title: event.title,
  ...(event.detail ? { detail: event.detail } : {}),
  ...(event.resultLabel ? { resultLabel: event.resultLabel } : {}),
  occurredOn: iso(event.occurredOn),
  datePrecision: event.datePrecision,
  ...(event.endedOn ? { endedOn: iso(event.endedOn) } : {}),
  ...(event.resultUrl ? { resultUrl: event.resultUrl } : {}),
  ...(event.editionSlug ? { editionSlug: event.editionSlug } : {}),
  source: sourceOf({ resultUrl: event.resultUrl }),
  editable: true,
  canAddResult: false,
});

const fromPlayed = (entry: PlayedEntry): ChildTimelineRow => ({
  id: `planner:${entry.editionSlug}`,
  origin: "planner",
  kind: "tournament_result",
  section: "results",
  title: entry.name,
  occurredOn: iso(entry.startDate),
  datePrecision: "day",
  editionSlug: entry.editionSlug,
  source: "parent",
  editable: false,
  canAddResult: true,
});

const fromStanding = (standing: RankingStanding, index: number): ChildTimelineRow => {
  const where = [standing.category, standing.subcategory].filter(Boolean).join(" ");
  return {
    id: `ranking:${index}`,
    origin: "ranking",
    kind: "ranking",
    section: "ranking",
    title: where ? `Ranked ${standing.rank} in ${where}` : `Ranked ${standing.rank}`,
    occurredOn: iso(standing.asOnDate),
    datePrecision: "day",
    source: "federation",
    editable: false,
    canAddResult: false,
  };
};

/** Newest first. Rows on the same date keep a stable order by id. */
const newestFirst = (a: ChildTimelineRow, b: ChildTimelineRow): number =>
  b.occurredOn.localeCompare(a.occurredOn) || a.id.localeCompare(b.id);

export const buildTimeline = (input: TimelineInput): ChildTimelineRow[] => {
  const storedSlugs = new Set(
    input.stored.map((event) => event.editionSlug).filter((slug): slug is string => Boolean(slug))
  );

  const rows: ChildTimelineRow[] = [
    ...input.stored.map(presentStoredEvent),
    ...input.played.filter((entry) => !storedSlugs.has(entry.editionSlug)).map(fromPlayed),
    ...input.standings.map(fromStanding),
  ];

  if (input.chosenSport) {
    rows.push({
      id: "sport",
      origin: "chosen_sport",
      kind: "milestone",
      section: "awards",
      title: `Chose ${input.chosenSport.name}`,
      occurredOn: iso(input.chosenSport.at),
      datePrecision: "day",
      source: "parent",
      editable: false,
      canAddResult: false,
    });
  }

  return rows.sort(newestFirst);
};

/** The tiles above the timeline. A tournament counted once whether stored, played, or both. */
export const buildStats = (
  input: TimelineInput,
  yearsPlaying: number | null | undefined
): ChildHistoryView["stats"] => {
  const tournamentKeys = new Set<string>();
  for (const event of input.stored) {
    if (event.kind === "tournament_result") {
      tournamentKeys.add(event.editionSlug ? `edition:${event.editionSlug}` : `event:${event._id}`);
    }
  }
  for (const entry of input.played) tournamentKeys.add(`edition:${entry.editionSlug}`);

  return {
    yearsInSport: typeof yearsPlaying === "number" ? yearsPlaying : null,
    tournaments: tournamentKeys.size,
    awards: input.stored.filter((event) => event.kind === "award").length,
  };
};
