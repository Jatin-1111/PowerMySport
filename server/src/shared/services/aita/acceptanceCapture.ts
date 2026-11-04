import type { AcceptanceSample } from "@powermysport/shared-types";
import type { FetchedEvent } from "./AitaAcceptanceSource";
import { AITA_LADDER_ORDER, seriesFromEditionName } from "./editionSeries";

/**
 * From AITA's finished events to the anonymous records the planner learns from.
 *
 * ── What is captured and when ───────────────────────────────────────────────
 * One record per finished junior event and singles category: draw sizes and the ranks of
 * the players accepted, never a name. An event is captured once it has FINISHED, because
 * until then its list can still change as players withdraw and slots are refilled; a list
 * read after the last day is the one that stood. An event already captured is not fetched
 * again, so a weekly run costs only the events that finished since the last.
 *
 * ── What is skipped ─────────────────────────────────────────────────────────
 * Anything not on AITA's own junior ladder: the senior prize-money circuit, ITF and Asian
 * events and the like are not comparable ("what rank gets into a National Series" says
 * nothing about an ITF junior), and an event whose level cannot be read from its name is
 * not guessed at.
 */

export interface CaptureTarget {
  externalId: string;
  name: string;
  /** The level as the calendar printed it, "National Series (7 Days)", when it did. */
  levelText: string | null;
  startDate: string;
  endDate: string;
}

export interface AcceptanceRecord extends AcceptanceSample {
  tournamentName: string;
  /** AITA's own code, "BS16". */
  category: string;
  entered: number | null;
  /** The day the list was last frozen, or null. */
  asOn: string | null;
  capturedAt: string;
}

/** The AITA ladder level of an event, from its name or its printed level, or null. */
export function ladderOf(target: Pick<CaptureTarget, "name" | "levelText">): string | null {
  const fromName = seriesFromEditionName(target.name);
  if (fromName.kind === "junior-ladder" && fromName.ladder) return fromName.ladder;
  const printed = target.levelText ?? "";
  return (
    AITA_LADDER_ORDER.find((rung) => printed.toLowerCase().includes(rung.toLowerCase())) ?? null
  );
}

/**
 * The events worth fetching: finished, on the junior ladder, not captured before. NEWEST
 * finished first, because AITA's lists exist only for events on its current platform
 * (from August 2026): going oldest-first spends a limited run on events that have none.
 * `since` (`YYYY-MM-DD`) bounds how far back to look, so an event that never had a list
 * stops being tried once it is old enough rather than being asked about every week.
 */
export function selectTargets(
  rows: CaptureTarget[],
  options: { today: string; alreadyCaptured: ReadonlySet<string>; limit?: number; since?: string }
): Array<CaptureTarget & { ladder: string }> {
  const seen = new Set<string>();
  const chosen: Array<CaptureTarget & { ladder: string }> = [];
  for (const row of [...rows].sort((a, b) => b.endDate.localeCompare(a.endDate))) {
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    if (row.endDate >= options.today) continue;
    if (options.since && row.endDate < options.since) continue;
    if (options.alreadyCaptured.has(row.externalId)) continue;
    const ladder = ladderOf(row);
    if (!ladder) continue;
    chosen.push({ ...row, ladder });
  }
  return chosen.slice(0, options.limit ?? chosen.length);
}

/** An event's categories as records, skipping any without a readable main draw. */
export function recordsFrom(
  event: FetchedEvent,
  target: CaptureTarget & { ladder: string },
  now: Date
): AcceptanceRecord[] {
  const records: AcceptanceRecord[] = [];
  for (const category of event.categories) {
    if (!category.parsed) continue;
    const { entered, asOn, ...numbers } = category.parsed;
    records.push({
      ...numbers,
      externalId: target.externalId,
      startDate: target.startDate,
      ladder: target.ladder,
      ageGroup: category.ageGroup,
      gender: category.gender,
      tournamentName: target.name,
      category: category.code,
      entered,
      asOn,
      capturedAt: now.toISOString(),
    });
  }
  return records;
}

export interface CaptureReport {
  fetched: number;
  failed: Array<{ externalId: string; reason: string }>;
  records: number;
  skippedNoRecords: number;
}

/**
 * Fetch and save, one event at a time. A failing event is recorded and the run goes on:
 * one dead page must not stop the rest.
 */
export async function captureAcceptance(params: {
  targets: Array<CaptureTarget & { ladder: string }>;
  source: { fetchEvent(tourId: number): Promise<FetchedEvent> };
  save: (records: AcceptanceRecord[]) => Promise<void>;
  now: Date;
  log?: (line: string) => void;
}): Promise<CaptureReport> {
  const report: CaptureReport = { fetched: 0, failed: [], records: 0, skippedNoRecords: 0 };
  for (const target of params.targets) {
    try {
      const event = await params.source.fetchEvent(Number(target.externalId));
      const records = recordsFrom(event, target, params.now);
      report.fetched += 1;
      if (records.length === 0) {
        report.skippedNoRecords += 1;
        params.log?.(`${target.externalId} ${target.name}: no readable lists`);
        continue;
      }
      await params.save(records);
      report.records += records.length;
      params.log?.(`${target.externalId} ${target.name}: ${records.length} categories`);
    } catch (error) {
      report.failed.push({
        externalId: target.externalId,
        reason: error instanceof Error ? error.message : String(error),
      });
      params.log?.(`${target.externalId} ${target.name}: FAILED ${report.failed.at(-1)!.reason}`);
    }
  }
  return report;
}
