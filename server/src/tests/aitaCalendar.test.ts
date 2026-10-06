/* eslint-disable @typescript-eslint/no-var-requires */
// Unit tests for the AITA calendar reader. No database, no network.
//
// The fixtures are real rows and a real fact sheet saved from aita.hitcourt.com on
// 2026-10-06, so the expected values below are what the live pages said, not what
// the parser happens to return. They are the only protection against the platform
// changing its markup, and the empty-page tests are the protection against that
// change being mistaken for a quiet month.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  parseDate,
  externalIdFromUrl,
  decodeEntities,
  parseMonthPage,
  parseFactSheet,
  classifyLevel,
} = require("../shared/services/aita/calendarParser");
const {
  entryFeeFor,
  deadlinesFor,
  WITHDRAWAL_RULES,
} = require("../shared/services/aita/calendarRules");
const { AitaCalendarSource, monthUrl } = require("../shared/services/aita/AitaCalendarSource");
const {
  MONTH_PAGE,
  EMPTY_MONTH_PAGE,
  FACT_SHEET,
  FACT_SHEET_NO_DOUBLES_FEE,
} = require("./fixtures/aitaCalendar");

describe("parseDate", () => {
  it("reads every format AITA prints", () => {
    assert.equal(parseDate("31-Oct-2026"), "2026-10-31");
    assert.equal(parseDate("03 Oct 2026"), "2026-10-03");
    assert.equal(parseDate("5-Oct-2026"), "2026-10-05");
    assert.equal(parseDate("14 September 2026"), "2026-09-14");
  });

  it("returns null for anything else, including an impossible date", () => {
    assert.equal(parseDate(null), null);
    assert.equal(parseDate(""), null);
    assert.equal(parseDate("soon"), null);
    assert.equal(parseDate("31-Feb-2026"), null);
    assert.equal(parseDate("12-Foo-2026"), null);
  });
});

describe("externalIdFromUrl and decodeEntities", () => {
  it("decodes the base64 id in a fact-sheet address", () => {
    assert.equal(
      externalIdFromUrl("https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MzAxNg=="),
      "3016"
    );
    assert.equal(externalIdFromUrl("https://x.test/tournament-acceptance-factsheet-NDE="), "41");
  });

  it("returns null when the address holds no numeric id", () => {
    assert.equal(externalIdFromUrl("https://x.test/somewhere-else"), null);
    // "abc" in base64, which is text and not an id.
    assert.equal(externalIdFromUrl("https://x.test/tournament-acceptance-factsheet-YWJj"), null);
  });

  it("decodes the entities the pages use", () => {
    assert.equal(
      decodeEntities("Boys &amp; Girls&#039; &quot;draw&quot;"),
      'Boys & Girls\' "draw"'
    );
  });
});

describe("parseMonthPage", () => {
  const rows = parseMonthPage(MONTH_PAGE);
  const byId = (id: string) => rows.find((r: { externalId: string }) => r.externalId === id);

  it("reads every row of the saved page", () => {
    assert.equal(rows.length, 6);
  });

  it("reads a Talent Series row completely", () => {
    assert.deepEqual(byId("3016"), {
      externalId: "3016",
      factSheetUrl: "https://www.aita.hitcourt.com/tournament-acceptance-factsheet-MzAxNg==",
      name: "MAT AITA TS(7) U-16",
      levelText: "Talent Series (7 Days)",
      city: "Bengaluru",
      state: "Karnataka",
      ageGroups: [16],
      startDate: "2026-10-31",
      endDate: "2026-11-06",
      entriesOpen: true,
      daysLeftToEnter: 6,
    });
  });

  it("reads the level in words even when the title says something else", () => {
    // The title of this one says nothing about its length; the level does.
    assert.equal(byId("3011").name, "AITA Championship Series Tournament");
    assert.equal(byId("3011").levelText, "Championship Series (7 Days)");
    assert.equal(byId("2934").levelText, "National Series");
  });

  it("marks a finished or closed event as not open, with no countdown", () => {
    const itf = byId("41");
    assert.equal(itf.entriesOpen, false);
    assert.equal(itf.daysLeftToEnter, null);
    assert.equal(itf.levelText, "ITF Juniors");
  });

  it("gives an event with no age badges an empty list", () => {
    assert.deepEqual(byId("2872").ageGroups, []);
  });

  it("returns an empty list for a page that says it has no records", () => {
    assert.deepEqual(parseMonthPage(EMPTY_MONTH_PAGE), []);
  });

  it("throws for a page with no rows that does not say so", () => {
    assert.throws(() => parseMonthPage("<html><body>Maintenance</body></html>"), /failed read/);
    assert.throws(() => parseMonthPage(""), /failed read/);
  });

  it("skips a row whose date cannot be read, and keeps the rest", () => {
    const broken = MONTH_PAGE.replace("31-Oct-2026 to 06-Nov-2026", "31-Foo-2026 to 06-Nov-2026");
    assert.notEqual(broken, MONTH_PAGE, "the fixture no longer contains the date this test edits");
    const parsed = parseMonthPage(broken);
    assert.ok(parsed.length >= 1 && parsed.length < rows.length);
  });

  it("throws when every row is unreadable, instead of reporting an empty month", () => {
    const allBroken = MONTH_PAGE.replace(/\d{2}-[A-Za-z]{3}-\d{4}/g, "unknown");
    assert.throws(() => parseMonthPage(allBroken), /failed read/);
  });
});

describe("parseFactSheet", () => {
  const sheet = parseFactSheet(FACT_SHEET);

  it("reads the level without what is printed after it", () => {
    assert.equal(sheet.levelText, "Championship Series (7 Days)");
  });

  it("reads the dates and the three deadlines with their times", () => {
    assert.equal(sheet.startDate, "2026-10-03");
    assert.equal(sheet.endDate, "2026-10-09");
    assert.equal(sheet.qualifyingFirstDay, "2026-10-03");
    assert.equal(sheet.mainDrawFirstDay, "2026-10-05");
    assert.equal(sheet.entryOpens, "2026-09-04");
    assert.deepEqual(sheet.entryCloses, { date: "2026-09-14", time: "23:59" });
    assert.deepEqual(sheet.withdrawalDeadline, { date: "2026-09-28", time: "23:59" });
    assert.deepEqual(sheet.freezeDeadline, { date: "2026-10-01", time: "15:00" });
  });

  it("reads fees, allowance, surface and venue", () => {
    assert.equal(sheet.feeSingles, 600);
    assert.equal(sheet.feeDoubles, 700);
    assert.equal(sheet.dailyAllowance, 400);
    assert.equal(sheet.surface, "Clay");
    assert.equal(sheet.mainDrawCourts, 5);
    assert.equal(sheet.indoorOutdoor, "Outdoors");
    assert.equal(sheet.eventsPlayed, "Boys 12&Under, Girls 12&Under");
    assert.equal(sheet.country, "India");
    assert.equal(sheet.state, "Karnataka");
    assert.equal(sheet.city, "Bengaluru");
  });

  it("gives null, not zero, for a fee the page leaves blank", () => {
    const blank = parseFactSheet(FACT_SHEET_NO_DOUBLES_FEE);
    assert.equal(blank.feeDoubles, null);
    assert.equal(blank.feeSingles, 600);
  });

  it("returns nulls for a page that holds none of it", () => {
    const empty = parseFactSheet("<html><body><p>Not found</p></body></html>");
    assert.equal(empty.startDate, null);
    assert.equal(empty.entryCloses, null);
    assert.equal(empty.feeSingles, null);
    assert.equal(empty.levelText, null);
  });
});

describe("classifyLevel", () => {
  const cases: Array<[string | null, unknown]> = [
    [
      "Talent Series (7 Days)",
      { ladder: "Talent Series", days: 7, circuit: "AITA", kind: "junior-ladder" },
    ],
    [
      "Championship Series (3 Days)",
      { ladder: "Championship Series", days: 3, circuit: "AITA", kind: "junior-ladder" },
    ],
    [
      "Championship Series (7 Days)",
      { ladder: "Championship Series", days: 7, circuit: "AITA", kind: "junior-ladder" },
    ],
    [
      "Super Series",
      { ladder: "Super Series", days: null, circuit: "AITA", kind: "junior-ladder" },
    ],
    [
      "National Series",
      { ladder: "National Series", days: null, circuit: "AITA", kind: "junior-ladder" },
    ],
    ["Nationals", { ladder: "Nationals", days: null, circuit: "AITA", kind: "junior-ladder" }],
    ["ITF Juniors", { ladder: null, days: null, circuit: "ITF", kind: "international-junior" }],
    ["Asian Under 14", { ladder: null, days: null, circuit: "ATF", kind: "international-junior" }],
    [
      "AITA Pro Circuit - 1 Lakh",
      { ladder: null, days: null, circuit: "AITA", kind: "senior-prize-money" },
    ],
    // A level AITA invents later is hidden, not guessed at.
    ["Mystery Cup", { ladder: null, days: null, circuit: null, kind: "unknown" }],
    [null, { ladder: null, days: null, circuit: null, kind: "unknown" }],
  ];
  for (const [text, expected] of cases) {
    it(`reads ${JSON.stringify(text)}`, () => {
      assert.deepEqual(classifyLevel(text), expected);
    });
  }
});

describe("entryFeeFor", () => {
  it("returns the 2026 table", () => {
    assert.deepEqual(entryFeeFor("Talent Series", 7), { singles: 400, doubles: 400 });
    assert.deepEqual(entryFeeFor("Championship Series", 3), { singles: 400, doubles: null });
    assert.deepEqual(entryFeeFor("Championship Series", 7), { singles: 600, doubles: 700 });
    assert.deepEqual(entryFeeFor("Super Series", null), { singles: 700, doubles: 900 });
    assert.deepEqual(entryFeeFor("National Series", null), { singles: 900, doubles: 1100 });
    assert.deepEqual(entryFeeFor("Nationals", null), { singles: 1100, doubles: 1300 });
  });

  it("does not depend on length for a level with one fee", () => {
    assert.deepEqual(entryFeeFor("Super Series", 7), { singles: 700, doubles: 900 });
  });

  it("returns null rather than the nearest fee for an unlisted Championship length, or no level", () => {
    assert.equal(entryFeeFor("Championship Series", 5), null);
    assert.equal(entryFeeFor("Championship Series", null), null);
    assert.equal(entryFeeFor(null, 7), null);
  });
});

describe("deadlinesFor", () => {
  it("matches the deadlines printed on the sampled fact sheet", () => {
    // 2026-10-03 is a Saturday; the sheet printed 14 Sep, 28 Sep and 1 Oct.
    assert.deepEqual(deadlinesFor("2026-10-03", "Championship Series", 7), {
      entryCloses: "2026-09-14",
      withdrawal: "2026-09-28",
      freeze: "2026-10-01",
    });
  });

  it("counts from a Monday start as strictly before it", () => {
    assert.deepEqual(deadlinesFor("2026-10-05", "Talent Series", 7), {
      entryCloses: "2026-09-14",
      withdrawal: "2026-09-28",
      freeze: "2026-10-01",
    });
  });

  it("states nothing for the levels whose deadlines differ or are unknown", () => {
    assert.equal(deadlinesFor("2026-10-03", "Championship Series", 3), null);
    assert.equal(deadlinesFor("2026-10-03", "Championship Series", null), null);
    assert.equal(deadlinesFor("2026-10-03", null, null), null);
  });
});

describe("WITHDRAWAL_RULES", () => {
  it("states the fines against the right levels", () => {
    assert.equal(WITHDRAWAL_RULES.noShowFine.championship3Day, 1180);
    assert.equal(WITHDRAWAL_RULES.noShowFine.talentAndChampionship7Day, 1770);
    assert.equal(WITHDRAWAL_RULES.lateWithdrawalsPerYear, 2);
  });
});

describe("monthUrl", () => {
  it("builds the address the site itself uses", () => {
    assert.equal(
      monthUrl(2026, 11),
      "https://www.aita.hitcourt.com/tournament-list-calendar-monthly-MjAyNiMjIzExIyMjMiMjIzAjIyMwIyMjMA=="
    );
  });
});

describe("AitaCalendarSource", () => {
  it("fetches and parses a month through the injected fetcher", async () => {
    const seen: string[] = [];
    const source = new AitaCalendarSource({
      fetchHtml: async (url: string) => {
        seen.push(url);
        return { status: 200, body: MONTH_PAGE };
      },
    });
    const month = await source.fetchMonth(2026, 11);
    assert.equal(month.rows.length, 6);
    assert.equal(month.sourceUrl, monthUrl(2026, 11));
    assert.deepEqual(seen, [monthUrl(2026, 11)]);
  });

  it("fetches and parses a fact sheet", async () => {
    const source = new AitaCalendarSource({
      fetchHtml: async () => ({ status: 200, body: FACT_SHEET }),
    });
    const sheet = await source.fetchFactSheet(
      "https://x.test/tournament-acceptance-factsheet-MzAxNg=="
    );
    assert.equal(sheet.feeSingles, 600);
  });

  it("fails at once on a 4xx answer, without retrying", async () => {
    let calls = 0;
    const source = new AitaCalendarSource({
      fetchHtml: async () => {
        calls += 1;
        return { status: 404, body: "" };
      },
    });
    await assert.rejects(source.fetchMonth(2026, 11), /returned 404/);
    assert.equal(calls, 1);
  });
});
