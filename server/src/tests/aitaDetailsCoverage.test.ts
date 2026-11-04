import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeCoverage,
  detailsCoverage,
  looksLikeParserDrift,
} from "../shared/services/aita/detailsCoverage";
import { parseFactSheetDetails } from "../shared/services/aita/factSheetSections";
import { FACT_SHEET_SECTIONS } from "./fixtures/aitaFactSheetSections";

const details = parseFactSheetDetails(FACT_SHEET_SECTIONS);

// Only the fields the coverage reads; the rest of a planned row is irrelevant here.
const row = (externalId: string, set: Record<string, unknown>) => ({ externalId, set }) as never;
const create = (externalId: string, doc: Record<string, unknown>) => ({ externalId, doc }) as never;

describe("details coverage", () => {
  it("counts the blocks kept, over rows read from a fact sheet only", () => {
    const coverage = detailsCoverage({
      creates: [create("1", { officialDetailsSource: "factSheet", factSheetDetails: details })],
      updates: [
        row("2", { officialDetailsSource: "factSheet", factSheetDetails: details }),
        row("3", { officialDetailsSource: "factSheet" }),
        row("4", { officialDetailsSource: "rules" }),
      ],
    });
    assert.equal(coverage.fromSheet, 3);
    assert.equal(coverage.withDetails, 2);
    assert.equal(coverage.blocks.draws, 2);
    assert.equal(coverage.blocks.hotel, 2);
    assert.deepEqual(coverage.withoutDetails, ["3"]);
    assert.match(describeCoverage(coverage), /kept for 2 of 3 sheet-sourced rows/);
  });

  it("flags a run that read many sheets and kept nothing, but not a small or healthy one", () => {
    const sheetOnly = Array.from({ length: 6 }, (_, i) =>
      row(String(i), { officialDetailsSource: "factSheet" })
    );
    assert.equal(looksLikeParserDrift(detailsCoverage({ creates: [], updates: sheetOnly })), true);
    assert.equal(
      looksLikeParserDrift(detailsCoverage({ creates: [], updates: sheetOnly.slice(0, 3) })),
      false
    );
    const healthy = [
      ...sheetOnly.slice(0, 5),
      row("9", { officialDetailsSource: "factSheet", factSheetDetails: details }),
    ];
    assert.equal(looksLikeParserDrift(detailsCoverage({ creates: [], updates: healthy })), false);
  });
});
