// Unit tests for what is written from AITA's calendar. No database, no network.
//
// The plan is pure, so these run the same decisions the script reports and then
// writes. What they pin: an old row is updated IN PLACE and keeps its name and slug,
// a second run changes nothing it did not have to, nothing outside the junior scope
// is written, a row is never created under a name that would be filed as the wrong
// level, and details come from the fact sheet, or from the rules and are labelled so.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { parseMonthPage, parseFactSheet } = require("../shared/services/aita/calendarParser");
const {
  planIngest,
  mondayOnOrAfter,
  shortName,
} = require("../shared/services/aita/calendarIngest");
const { MONTH_PAGE, FACT_SHEET } = require("./fixtures/aitaCalendar");

const NOW = new Date("2026-10-06T10:00:00.000Z");
const rows = parseMonthPage(MONTH_PAGE);
const row = (id: string) => ({ ...rows.find((r: { externalId: string }) => r.externalId === id) });

const TS = row("3016"); // Talent Series (7 Days), Bengaluru, 2026-10-31 to 11-06
const CS = row("3011"); // Championship Series (7 Days), Lucknow, 2026-10-31 to 11-06
const NS = row("2934"); // National Series, Sonipat, 2026-11-14

const run = (over: Record<string, unknown> = {}) =>
  planIngest({
    rows: [],
    sheets: new Map(),
    stored: [],
    takenSlugs: new Set<string>(),
    sourceUrlFor: () => "https://source.test/month",
    now: NOW,
    ...over,
  });

const stored = (over: Record<string, unknown>) => ({
  _id: `id-${Math.random()}`,
  name: "AITA CS7 (Lucknow)",
  slug: "aita-cs7-lucknow-2026-11-02",
  startDate: new Date("2026-11-02T00:00:00.000Z"),
  city: "Lucknow",
  state: null,
  ladder: "Championship Series",
  kind: "junior-ladder",
  externalId: null,
  ...over,
});

describe("mondayOnOrAfter", () => {
  it("returns the Monday on or after a day", () => {
    assert.equal(mondayOnOrAfter("2026-10-31"), "2026-11-02"); // Saturday
    assert.equal(mondayOnOrAfter("2026-11-01"), "2026-11-02"); // Sunday
    assert.equal(mondayOnOrAfter("2026-11-02"), "2026-11-02"); // Monday
    assert.equal(mondayOnOrAfter("2026-10-29"), "2026-11-02"); // Thursday
  });
});

describe("shortName", () => {
  const level = (r: { levelText: string }) =>
    require("../shared/services/aita/calendarParser").classifyLevel(r.levelText);
  it("uses the form the older calendar used", () => {
    assert.equal(shortName(TS, level(TS)), "AITA TS7 (Bengaluru)");
    assert.equal(shortName(CS, level(CS)), "AITA CS7 (Lucknow)");
    assert.equal(shortName(NS, level(NS)), "AITA NS (Sonipat)");
  });
  it("falls back to the state, and gives up with neither", () => {
    assert.equal(shortName({ ...TS, city: null }, level(TS)), "AITA TS7 (Karnataka)");
    assert.equal(shortName({ ...TS, city: null, state: null }, level(TS)), null);
  });
});

describe("planIngest: updating an old row in place", () => {
  it("matches the Monday-dated row (main-draw Monday) of the same level and place, and keeps its name and slug", () => {
    const old = stored({});
    const plan = run({ rows: [CS], stored: [old] });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 1);
    const [u] = plan.updates;
    assert.equal(u.id, old._id);
    assert.equal(u.name, "AITA CS7 (Lucknow)");
    assert.equal(u.matchedBy, "legacy");
    assert.equal(u.was.startDate, "2026-11-02");
    assert.equal(u.set.startDate.toISOString(), "2026-10-31T00:00:00.000Z");
    assert.equal(u.set.externalId, "3011");
    assert.equal("slug" in u.set, false, "an update must never touch the slug");
    assert.equal("name" in u.set, false, "an update must never rename the row");
  });

  it("does not match a different week, level or place", () => {
    for (const other of [
      stored({ startDate: new Date("2026-10-26T00:00:00.000Z") }), // the Monday before the event
      stored({ startDate: new Date("2026-11-09T00:00:00.000Z") }), // a week late
      stored({ ladder: "Talent Series" }),
      stored({ city: "Kanpur" }),
    ]) {
      const plan = run({ rows: [CS], stored: [other] });
      assert.equal(plan.updates.length, 0);
      assert.equal(plan.creates.length, 1);
    }
  });

  it("matches a row not on a Monday only when it is within a day of the start", () => {
    const near = stored({ startDate: new Date("2026-10-31T00:00:00.000Z") });
    const far = stored({ startDate: new Date("2026-10-27T00:00:00.000Z") });
    assert.equal(run({ rows: [CS], stored: [near] }).updates.length, 1);
    assert.equal(run({ rows: [CS], stored: [far] }).updates.length, 0);
  });

  it("claims a stored row once", () => {
    const plan = run({
      rows: [CS, { ...CS, externalId: "9999", name: "Another" }],
      stored: [stored({})],
    });
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.creates.length, 1);
  });

  it("matches by AITA id on a later run, and then writes the same thing again", () => {
    const first = run({ rows: [CS], stored: [stored({})] });
    const after = stored({
      startDate: first.updates[0].set.startDate,
      externalId: "3011",
    });
    const second = run({ rows: [CS], stored: [after] });
    assert.equal(second.creates.length, 0);
    assert.equal(second.updates.length, 1);
    assert.equal(second.updates[0].matchedBy, "externalId");
    assert.equal(second.unmatched.length, 0);
  });

  it("skips, and reports, a move that would collide with another stored row", () => {
    const old = stored({});
    const squatter = stored({
      name: "AITA CS7 (Lucknow)",
      startDate: new Date("2026-10-31T00:00:00.000Z"),
      city: "Elsewhere",
    });
    const plan = run({ rows: [CS], stored: [old, squatter] });
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.skipped.length, 1);
    assert.match(plan.skipped[0].reason, /collide/);
  });
});

describe("planIngest: creating", () => {
  it("creates a row named like the older ones, with a slug and the classified level", () => {
    const plan = run({ rows: [TS] });
    assert.equal(plan.creates.length, 1);
    const d = plan.creates[0].doc;
    assert.equal(d.name, "AITA TS7 (Bengaluru)");
    assert.equal(d.slug, "aita-ts7-bengaluru-2026-10-31");
    assert.equal(d.sportSlug, "tennis");
    assert.equal(d.federationSlug, "aita");
    assert.equal(d.ladder, "Talent Series");
    assert.equal(d.grade, 7);
    assert.equal(d.circuit, "AITA");
    assert.equal(d.kind, "junior-ladder");
    assert.deepEqual(d.ageGroups, ["Under-16"]);
    assert.equal(d.category, "Under 16");
    assert.equal(d.officialName, "MAT AITA TS(7) U-16");
    assert.equal(d.status, "announced");
    assert.equal(d.externalId, "3016");
    assert.equal(d.editionYear, 2026);
    assert.equal(d.endDate.toISOString(), "2026-11-06T00:00:00.000Z");
  });

  it("marks an event already under way as ongoing", () => {
    const plan = run({ rows: [{ ...TS, startDate: "2026-10-03", endDate: "2026-10-09" }] });
    assert.equal(plan.creates[0].doc.status, "ongoing");
  });

  it("does not offer events that have finished", () => {
    const plan = run({ rows: [{ ...TS, startDate: "2026-09-20", endDate: "2026-09-26" }] });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.skipped.length, 0);
  });

  it("lists an event spanning two months once", () => {
    const plan = run({ rows: [TS, { ...TS }] });
    assert.equal(plan.creates.length, 1);
  });

  it("never reuses a slug", () => {
    const plan = run({ rows: [TS], takenSlugs: new Set(["aita-ts7-bengaluru-2026-10-31"]) });
    assert.equal(plan.creates[0].doc.slug, "aita-ts7-bengaluru-2026-10-31-2");
  });

  it("tells apart two events of one level, place and day", () => {
    const twin = { ...TS, externalId: "4000", ageGroups: [12] };
    const plan = run({ rows: [TS, twin] });
    const names = plan.creates.map((c: { doc: { name: string } }) => c.doc.name);
    assert.equal(new Set(names).size, 2);
    assert.ok(
      names.includes("AITA TS7 (Bengaluru U12)") || names.includes("AITA TS7 (Bengaluru U16)")
    );
    // and the name still reads back as the same level
    for (const c of plan.creates) assert.equal(c.doc.ladder, "Talent Series");
  });

  it("does not offer an event that lists no under-age group", () => {
    const plan = run({ rows: [{ ...CS, ageGroups: [] }], stored: [stored({})] });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 0);
    assert.match(plan.skipped[0].reason, /no under-age group/);
    // and the old row it would have matched is reported, not silently kept as current
    assert.equal(plan.unmatched.length, 1);
  });

  it("refuses an event with nothing to name it by", () => {
    const plan = run({ rows: [{ ...TS, city: null, state: null }] });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.skipped.length, 1);
  });
});

describe("planIngest: scope", () => {
  it("counts senior and unknown events and writes none of them", () => {
    const pro = { ...TS, externalId: "1", levelText: "AITA Pro Circuit - 1 Lakh" };
    const unknown = { ...TS, externalId: "2", levelText: "10 & Under" };
    const plan = run({ rows: [pro, unknown] });
    assert.equal(plan.creates.length, 0);
    assert.deepEqual(plan.outOfScope, { "senior-prize-money": 1, unknown: 1 });
  });

  it("keeps the ITF and Asian junior events, with no ladder fields", () => {
    const itf = {
      ...TS,
      externalId: "3",
      levelText: "ITF Juniors",
      city: "Pune",
      state: "Maharashtra",
      ageGroups: [18],
    };
    const plan = run({ rows: [itf] });
    const d = plan.creates[0].doc;
    assert.equal(d.name, "ITF Juniors (Pune)");
    assert.equal(d.kind, "international-junior");
    assert.equal(d.circuit, "ITF");
    assert.equal("ladder" in d, false);
    assert.equal("feeSingles" in d, false, "no fee is claimed for an event the rules do not cover");
  });

  it("reports stored junior rows nothing matched, and ignores stored senior rows", () => {
    const orphan = stored({ name: "AITA CS7 (Nowhere)", city: "Nowhere" });
    const senior = stored({
      name: "AITA Rs 2.5 Lakh (X)",
      ladder: null,
      kind: "senior-prize-money",
      city: "X",
    });
    const past = stored({
      name: "AITA CS7 (Old)",
      city: "Old",
      startDate: new Date("2026-08-03T00:00:00.000Z"),
    });
    const plan = run({ rows: [TS], stored: [orphan, senior, past] });
    assert.deepEqual(
      plan.unmatched.map((s: { name: string }) => s.name),
      ["AITA CS7 (Nowhere)"]
    );
  });
});

describe("planIngest: official details", () => {
  it("states the rules, labelled as the rules, when there is no fact sheet", () => {
    const d = run({ rows: [TS] }).creates[0].doc;
    assert.equal(d.officialDetailsSource, "rules");
    assert.equal(d.registrationDeadlineDate.toISOString(), "2026-10-12T00:00:00.000Z");
    assert.equal(d.withdrawalDeadlineDate.toISOString(), "2026-10-26T00:00:00.000Z");
    assert.equal(d.freezeDeadlineDate.toISOString(), "2026-10-29T00:00:00.000Z");
    assert.equal(d.feeSingles, 400);
    assert.equal(d.feeDoubles, 400);
    assert.equal("entryOpensDate" in d, false, "the rules do not say when entries open");
  });

  it("states nothing for a Championship 3-day, which the rules do not fix", () => {
    const cs3 = { ...CS, levelText: "Championship Series (3 Days)" };
    const d = run({ rows: [cs3] }).creates[0].doc;
    assert.equal(d.officialDetailsSource, "rules");
    assert.equal("registrationDeadlineDate" in d, false);
    assert.equal(d.feeSingles, 400);
    assert.equal(d.feeDoubles, undefined);
  });

  it("takes everything from the fact sheet when there is one, and says so", () => {
    const sheet = parseFactSheet(FACT_SHEET);
    const d = run({ rows: [CS], sheets: new Map([["3011", sheet]]) }).creates[0].doc;
    assert.equal(d.officialDetailsSource, "factSheet");
    assert.equal(d.entryOpensDate.toISOString(), "2026-09-04T00:00:00.000Z");
    assert.equal(d.registrationDeadlineDate.toISOString(), "2026-09-14T00:00:00.000Z");
    assert.deepEqual(d.deadlineTimes, {
      entryCloses: "23:59",
      withdrawal: "23:59",
      freeze: "15:00",
    });
    assert.equal(d.feeSingles, 600);
    assert.equal(d.feeDoubles, 700);
    assert.equal(d.dailyAllowance, 400);
    assert.equal(d.surface, "Clay");
    assert.equal(d.mainDrawStartDate.toISOString(), "2026-10-05T00:00:00.000Z");
  });

  it("keeps the sheet and warns where it parts from the rules or the calendar", () => {
    const sheet = parseFactSheet(FACT_SHEET);
    // The saved sheet is for a different date, so against this row it disagrees.
    const plan = run({ rows: [CS], sheets: new Map([["3011", sheet]]) });
    assert.ok(
      plan.warnings.some((w: string) =>
        /entries close 2026-09-14, the rules give 2026-10-12/.test(w)
      )
    );
    assert.ok(
      plan.warnings.some((w: string) =>
        /the sheet starts 2026-10-03, the calendar 2026-10-31/.test(w)
      )
    );
    assert.equal(
      plan.creates[0].doc.registrationDeadlineDate.toISOString(),
      "2026-09-14T00:00:00.000Z"
    );
  });

  it("falls back to the rules when the sheet holds none of it", () => {
    const empty = parseFactSheet("<html><body>Not found</body></html>");
    const d = run({ rows: [TS], sheets: new Map([["3016", empty]]) }).creates[0].doc;
    assert.equal(d.officialDetailsSource, "rules");
  });
});
