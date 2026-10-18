import type { IngestPlan } from "./calendarIngest";

/**
 * How much of the fact sheet's block sections (draws, organiser, venue, hotel and
 * so on) a sweep read, counted over the rows it is about to write.
 *
 * It exists to make one failure visible. The block parser reads the rendered page's
 * headings and labels, so if AITA changes its markup it will return nothing without
 * raising an error, and the rest of the sweep (dates, fees) still succeeds. A sweep
 * that read many sheets and kept details from none of them is that case.
 */
export interface DetailsCoverage {
  /** Rows in the plan that came from a fact sheet. */
  fromSheet: number;
  /** Of those, how many carry the block sections. */
  withDetails: number;
  blocks: Record<
    "draws" | "organisation" | "director" | "referee" | "academy" | "venue" | "travel" | "hotel",
    number
  >;
  /** AITA ids of rows read from a sheet that kept none of the blocks. */
  withoutDetails: string[];
}

export function detailsCoverage(plan: Pick<IngestPlan, "creates" | "updates">): DetailsCoverage {
  const coverage: DetailsCoverage = {
    fromSheet: 0,
    withDetails: 0,
    blocks: {
      draws: 0,
      organisation: 0,
      director: 0,
      referee: 0,
      academy: 0,
      venue: 0,
      travel: 0,
      hotel: 0,
    },
    withoutDetails: [],
  };

  const rows = [
    ...plan.creates.map((c) => ({ id: c.externalId, doc: c.doc })),
    ...plan.updates.map((u) => ({ id: u.externalId, doc: u.set })),
  ];
  for (const { id, doc } of rows) {
    if (doc.officialDetailsSource !== "factSheet") continue;
    coverage.fromSheet += 1;
    const details = doc.factSheetDetails;
    if (!details) {
      coverage.withoutDetails.push(id);
      continue;
    }
    coverage.withDetails += 1;
    if (details.draws.length > 0) coverage.blocks.draws += 1;
    for (const key of [
      "organisation",
      "director",
      "referee",
      "academy",
      "venue",
      "travel",
      "hotel",
    ] as const) {
      if (details[key]) coverage.blocks[key] += 1;
    }
  }
  return coverage;
}

/** One line for a log or a report. */
export function describeCoverage(coverage: DetailsCoverage): string {
  const parts = Object.entries(coverage.blocks)
    .map(([name, n]) => `${name} ${n}`)
    .join(", ");
  return `fact-sheet blocks kept for ${coverage.withDetails} of ${coverage.fromSheet} sheet-sourced rows (${parts})`;
}

/**
 * Whether the pattern looks like the parser has stopped understanding the page: a
 * meaningful number of sheets were read and none kept any block.
 */
export function looksLikeParserDrift(coverage: DetailsCoverage): boolean {
  return coverage.fromSheet >= 5 && coverage.withDetails === 0;
}
