/* eslint-disable @typescript-eslint/no-var-requires */
// What AITA's own pages contribute to the planner: the shape sent to the website,
// and the entry fee in a cost view. No database, no network.
//
// The properties worth pinning: an event we never read AITA's pages for carries NO
// official block (absent means "not stated", and a guessed block would be a claim),
// an older row's expiring link is never offered as a page to enter on, and a fee
// AITA prints is used for the cost while the parent's own figure still wins.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { toPlannerEdition } = require("../client/services/PlannerService");
const { viewFor } = require("../client/services/plannerCosts/CostService");

const base = {
  slug: "aita-cs7-bengaluru-2026-10-03",
  name: "AITA CS7 (Bengaluru)",
  startDate: new Date("2026-10-03T00:00:00.000Z"),
};

const read = {
  ...base,
  externalId: "2921",
  detailUrl: "https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MjkyMQ==",
  lastCheckedAt: new Date("2026-10-06T10:00:00.000Z"),
  entryOpensDate: new Date("2026-09-04T00:00:00.000Z"),
  registrationDeadlineDate: new Date("2026-09-14T00:00:00.000Z"),
  withdrawalDeadlineDate: new Date("2026-09-28T00:00:00.000Z"),
  freezeDeadlineDate: new Date("2026-10-01T00:00:00.000Z"),
  deadlineTimes: { entryCloses: "23:59", withdrawal: "23:59", freeze: "15:00" },
  feeSingles: 600,
  feeDoubles: 700,
  dailyAllowance: 400,
  surface: "Clay",
  qualifyingStartDate: new Date("2026-10-03T00:00:00.000Z"),
  mainDrawStartDate: new Date("2026-10-05T00:00:00.000Z"),
  officialDetailsSource: "factSheet" as const,
};

describe("toPlannerEdition: official details", () => {
  it("carries what AITA's page says, as calendar days", () => {
    const edition = toPlannerEdition(read);
    assert.deepEqual(edition.official, {
      source: "factSheet",
      entryOpens: "2026-09-04",
      entryCloses: "2026-09-14",
      withdrawalDeadline: "2026-09-28",
      freezeDeadline: "2026-10-01",
      times: { entryCloses: "23:59", withdrawal: "23:59", freeze: "15:00" },
      feeSingles: 600,
      feeDoubles: 700,
      dailyAllowance: 400,
      surface: "Clay",
      qualifyingStart: "2026-10-03",
      mainDrawStart: "2026-10-05",
      pageUrl: "https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MjkyMQ==",
      checkedAt: "2026-10-06T10:00:00.000Z",
    });
  });

  it("has no official block for an event AITA's pages were never read for", () => {
    const edition = toPlannerEdition({
      ...base,
      registrationDeadlineDate: new Date("2026-09-14T00:00:00.000Z"),
    });
    assert.equal("official" in edition, false);
    // the long-standing field is untouched
    assert.equal(edition.registrationDeadlineDate, "2026-09-14T00:00:00.000Z");
  });

  it("never offers an older row's link as a page to enter on", () => {
    const edition = toPlannerEdition({
      ...base,
      detailUrl: "https://aitatennis.com/management/tournament-content?id=5037",
      officialDetailsSource: "rules" as const,
      feeSingles: 600,
    });
    assert.equal(edition.official.source, "rules");
    assert.equal("pageUrl" in edition.official, false);
  });

  it("leaves a field out when the page did not print it", () => {
    const edition = toPlannerEdition({
      ...base,
      officialDetailsSource: "factSheet" as const,
      feeSingles: 400,
    });
    assert.deepEqual(edition.official, { source: "factSheet", feeSingles: 400 });
  });
});

describe("viewFor: the entry fee", () => {
  const event = (over: Record<string, unknown> = {}) => ({
    slug: base.slug,
    startDate: base.startDate.toISOString(),
    city: "Bengaluru",
    state: "Karnataka",
    ...over,
  });
  const origin = { kind: "city", city: "Pune", state: "Maharashtra", label: "Pune" };
  const estimate = {
    source: "ai",
    assumptions: null,
    travel: { low: 4000, high: 6000 },
    stay: { low: 3000, high: 5000 },
  };

  it("uses the fee AITA's fact sheet prints, and adds it to the total", () => {
    const view = viewFor(
      event({ officialFee: { singles: 600, source: "factSheet" } }),
      undefined,
      origin,
      estimate
    );
    assert.equal(view.entryFee, 600);
    assert.equal(view.entryFeeBasis, "fact-sheet");
    assert.equal(view.entryFeeMissing, false);
    assert.deepEqual(view.total, { low: 7600, high: 11600 });
  });

  it("says when the fee is the rules' figure and not the page's", () => {
    const view = viewFor(
      event({ officialFee: { singles: 600, source: "rules" } }),
      undefined,
      origin,
      estimate
    );
    assert.equal(view.entryFeeBasis, "rules");
  });

  it("lets the parent's own figure win", () => {
    const entry = { costs: { entryFee: 750 } };
    const view = viewFor(
      event({ officialFee: { singles: 600, source: "factSheet" } }),
      entry,
      origin,
      estimate
    );
    assert.equal(view.entryFee, 750);
    assert.equal(view.entryFeeBasis, "yours");
    assert.deepEqual(view.total, { low: 7750, high: 11750 });
  });

  it("is missing, and says so, when neither the parent nor AITA gave one", () => {
    const view = viewFor(event(), undefined, origin, estimate);
    assert.equal(view.entryFee, null);
    assert.equal(view.entryFeeBasis, null);
    assert.equal(view.entryFeeMissing, true);
    assert.deepEqual(view.total, { low: 7000, high: 11000 });
  });
});
