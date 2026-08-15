import assert from "node:assert/strict";
import test from "node:test";
import {
  asOnLabelAgrees,
  isAgeGroupRollover,
} from "../shared/services/aita/AitaRankingIngestService";
import {
  Cell,
  Column,
  nearestColumn,
  parseDob,
  parseNumber,
} from "../shared/services/aita/rankingPdfParser";
import {
  ROLLED_DOWN_PREFIX,
  assignStateRanks,
  computeBandProfiles,
  computeBenchmarks,
  computeStateAggregates,
  nextBracketUp,
  nextTierFor,
  type InsightRow,
} from "../shared/services/aita/rankingInsights";
import { parseStateCell, resolveStateCode } from "../shared/services/aita/stateCodes";
import { INDIAN_STATES_AND_UTS } from "../shared/utils/states";

const cell = (x: number, width: number, text: string): Cell => ({
  x,
  width,
  center: x + width / 2,
  text,
});

/**
 * Real header geometry from `2026-07-27_BU-14.pdf`, to the tenth of a point.
 * The numbers matter: `Given Name` and `Family Name` are printed 2.4pt apart,
 * which is closer than the gap inside some cells, and Given Name is
 * right-aligned so its left edge moves with the length of the name.
 */
const column = (x: number, width: number, label: string, key?: string): Column => ({
  center: x + width / 2,
  start: x,
  end: x + width,
  label,
  ...(key ? { key } : {}),
});

const BU14_COLUMNS: Column[] = [
  column(58.4, 15.7, "RANK", "rank"),
  column(143.5, 33.6, "Given Name", "givenName"),
  column(179.5, 35.8, "Family Name", "familyName"),
  column(266.9, 23.2, "REG NO.", "regNo"),
  column(303.2, 12.3, "DOB", "dob"),
  column(332.0, 16.9, "STATE", "state"),
  column(363.8, 11.7, "BEST Eight SING. PTS."),
  column(393.1, 11.7, "BEST Eight DBLS. PTS."),
];

test("column assignment splits given and family names", () => {
  // Short given name: sits well right of where the header is printed.
  assert.equal(nearestColumn(cell(158.4, 18.8, "AARAV"), BU14_COLUMNS)?.key, "givenName");
  assert.equal(
    nearestColumn(cell(179.5, 30.9, "CHHALLANI"), BU14_COLUMNS)?.key,
    "familyName",
  );
});

test("a long given name does not bleed into the family name column", () => {
  // "SANJAY PRABHAKARAN" starts at x=113 — to the LEFT of the "Given Name"
  // header — because the column is right-aligned. This is the case that a
  // left-edge or midpoint-boundary parser gets wrong.
  assert.equal(
    nearestColumn(cell(113.0, 85.0, "SANJAY PRABHAKARAN"), BU14_COLUMNS)?.key,
    "givenName",
  );
  // The widest family name in a single real list. Its centroid is 21.8pt from
  // the header centre, which is why overlap rather than distance decides this.
  assert.equal(
    nearestColumn(cell(179.5, 79.4, "SADASIVAM RAJESH KANNAN"), BU14_COLUMNS)?.key,
    "familyName",
  );
});

test("right-aligned numbers land on their own column regardless of width", () => {
  // "400" (3 chars) and "1" (1 char) start 3pt apart but mean the same column.
  assert.equal(
    nearestColumn(cell(364.7, 10, "400"), BU14_COLUMNS)?.label,
    "BEST Eight SING. PTS.",
  );
  assert.equal(
    nearestColumn(cell(368.0, 3.3, "1"), BU14_COLUMNS)?.label,
    "BEST Eight SING. PTS.",
  );
  assert.equal(
    nearestColumn(cell(394.0, 10, "440"), BU14_COLUMNS)?.label,
    "BEST Eight DBLS. PTS.",
  );
});

test("a cell far from every column is rejected rather than snapped", () => {
  assert.equal(nearestColumn(cell(700, 20, "stray"), BU14_COLUMNS), null);
});

test("two-digit years pivot so juniors and seniors both parse", () => {
  // Sumit Nagal, born 1997, sits in the same file shape as a 2012-born junior.
  assert.equal(parseDob("16-Aug-97", 2000, 26)?.toISOString().slice(0, 10), "1997-08-16");
  assert.equal(parseDob("20-Jun-12", 2000, 26)?.toISOString().slice(0, 10), "2012-06-20");
  assert.equal(parseDob("01-Jan-00", 2000, 26)?.toISOString().slice(0, 10), "2000-01-01");
  assert.equal(parseDob("", 2000, 26), null);
  assert.equal(parseDob("not a date", 2000, 26), null);
  assert.equal(parseDob("20-Zzz-12", 2000, 26), null);
});

test("point cells coerce blanks and dashes to zero", () => {
  assert.equal(parseNumber("762.5"), 762.5);
  assert.equal(parseNumber("0"), 0);
  assert.equal(parseNumber(""), 0);
  assert.equal(parseNumber("-"), 0);
});

test("state cells yield a bare uppercase code", () => {
  assert.equal(parseStateCell("(MH)"), "MH");
  assert.equal(parseStateCell(" (ts) "), "TS");
  assert.equal(parseStateCell("KA"), "KA");
  assert.equal(parseStateCell("Maharashtra"), null);
});

test("unknown state codes resolve to null so the snapshot quarantines", () => {
  assert.equal(resolveStateCode("MH"), "Maharashtra");
  assert.equal(resolveStateCode("ts"), "Telangana");
  assert.equal(resolveStateCode("OR"), "Odisha"); // pre-2011 alias
  assert.equal(resolveStateCode("ZZ"), null);
  assert.equal(resolveStateCode(""), null);
});

/**
 * The state-drift guard. Every mapped name must be one of the 36 the rest of
 * the API accepts — a name that drifts by a character here turns a valid state
 * filter into a 400, and on a page that 404s when its fetch fails, into a 404
 * for the whole page.
 */
test("every mapped state name is one the API accepts", () => {
  const canonical = new Set<string>(INDIAN_STATES_AND_UTS);
  const codes = [
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DL", "DN", "GA", "GJ", "HP",
    "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ",
    "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB",
    "OR", "UA", "UT", "CT", "DD", "DH", "PO", "PN", "TG", "AD",
  ];
  for (const code of codes) {
    const name = resolveStateCode(code);
    assert.ok(name, `${code} should map to a state`);
    assert.ok(canonical.has(name), `${code} -> "${name}" is not a canonical state name`);
  }
});

test("all 36 canonical states are reachable from some code", () => {
  const reached = new Set(
    INDIAN_STATES_AND_UTS.map((name) => name).filter((name) =>
      ["AN", "AP", "AR", "AS", "BR", "CG", "CH", "DN", "DL", "GA", "GJ", "HR",
       "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ",
       "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB",
      ].some((code) => resolveStateCode(code) === name),
    ),
  );
  assert.equal(reached.size, INDIAN_STATES_AND_UTS.length);
});

test("the printed as-on line is cross-checked against the filed date", () => {
  assert.equal(asOnLabelAgrees("As on 27th July, 2026", "2026-07-27"), true);
  assert.equal(asOnLabelAgrees("As on 6th April, 2026", "2026-04-06"), true);
  // Zero-padded single-digit days, abbreviated months and stray spacing are all
  // used by the source. Rejecting these quarantined nine good lists in a single
  // 26-week backfill, so each real form seen is pinned here.
  assert.equal(asOnLabelAgrees("As on 02nd Feb , 2026", "2026-02-02"), true);
  assert.equal(asOnLabelAgrees("As on 06th April, 2026", "2026-04-06"), true);
  assert.equal(asOnLabelAgrees("As on 01st June, 2026", "2026-06-01"), true);
  assert.equal(asOnLabelAgrees("As on 09th March, 2026", "2026-03-09"), true);
  // ...but a padded day must still be compared, not ignored.
  assert.equal(asOnLabelAgrees("As on 02nd Feb , 2026", "2026-02-09"), false);
  // Wrong year — this is AITA filing a list under the wrong date.
  assert.equal(asOnLabelAgrees("As on 27th July, 2025", "2026-07-27"), false);
  // Wrong day.
  assert.equal(asOnLabelAgrees("As on 20th July, 2026", "2026-07-27"), false);
  // Absent or unrecognisable labels must not block a publish.
  assert.equal(asOnLabelAgrees(null, "2026-07-27"), true);
  assert.equal(asOnLabelAgrees("Ranking Document", "2026-07-27"), true);
});

/**
 * Age brackets are defined by birth year, so every January a cohort ages out
 * and the smaller list drops a large share of its players in one week — Boys
 * U-12 went 1,126 -> 668 across 31 Dec 2025 / 12 Jan 2026. That is the one
 * predictable step-change in this data and it must not read as corruption.
 */
test("the January age-group rollover is recognised, but only for age brackets", () => {
  assert.equal(isAgeGroupRollover("U-12", new Date("2025-12-31"), "2026-01-12"), true);
  assert.equal(isAgeGroupRollover("U-18", new Date("2024-12-29"), "2025-01-06"), true);
  // Same year — an ordinary week-to-week move, so no exemption.
  assert.equal(isAgeGroupRollover("U-12", new Date("2026-01-12"), "2026-01-19"), false);
  // Open-age lists have no birth-year boundary and never get the exemption.
  assert.equal(isAgeGroupRollover("Singles", new Date("2025-12-31"), "2026-01-12"), false);
  assert.equal(isAgeGroupRollover("Doubles", new Date("2025-12-31"), "2026-01-12"), false);
  assert.equal(isAgeGroupRollover("35+ Singles", new Date("2025-12-31"), "2026-01-12"), false);
});

// ─── Derived analytics ──────────────────────────────────────────────────────
//
// These are the numbers that turn a rank into something a reader can act on, so
// the cases that matter are the ones where a naive implementation invents a fact
// that is not in the data: ties, penalty columns, and lists shorter than the
// tier being reported.

const insightRow = (
  rank: number,
  regNo: string,
  totalPoints: number,
  state?: string,
  components: number[] = [],
): InsightRow => ({
  regNo,
  rank,
  totalPoints,
  ...(state ? { state } : {}),
  points: [
    ...components.map((value, index) => ({ label: `COL ${index + 1}`, value })),
    { label: "Final TTL PTS.", value: totalPoints },
  ],
});

test("benchmarks report the points needed to get inside a tier, not one player's total", () => {
  const rows = [
    insightRow(1, "1", 900),
    insightRow(2, "2", 800),
    // A tie: three players share rank 10, on different totals.
    insightRow(10, "3", 500),
    insightRow(10, "4", 480),
    insightRow(10, "5", 470),
    insightRow(24, "6", 200),
    insightRow(25, "7", 190),
  ];

  const benchmarks = computeBenchmarks(rows, [1, 10, 25, 50]);
  // The lowest total held inside the tier — overtake that and you are in.
  assert.deepEqual(benchmarks, [
    { rank: 1, points: 900 },
    { rank: 10, points: 470 },
    { rank: 25, points: 190 },
  ]);
  // No tier past the end of the list: a 25-player list has no "top 50", and
  // publishing one would invent a rung above the last player.
  assert.equal(benchmarks.some((b) => b.rank === 50), false);
});

test("the next tier up skips rungs the player already has the points for", () => {
  const benchmarks = [
    { rank: 10, points: 500 },
    { rank: 50, points: 300 },
    { rank: 100, points: 200 },
  ];

  // Rank 104 on 210 points: past the top-100 points bar but not the rank, so
  // "0 more points to the top 100" would read as a bug. Answer is the top 50.
  assert.deepEqual(nextTierFor(104, 210, benchmarks), {
    rank: 50,
    points: 300,
    gap: 90,
  });
  // Ordinary case: the rung immediately above.
  assert.deepEqual(nextTierFor(300, 150, benchmarks), {
    rank: 100,
    points: 200,
    gap: 50,
  });
  // Already number one — nothing above to chase.
  assert.equal(nextTierFor(1, 900, benchmarks), null);
});

test("state ranks keep nationally tied players tied", () => {
  const rows = [
    insightRow(5, "a", 400, "Maharashtra"),
    insightRow(12, "b", 300, "Karnataka"),
    // Two Maharashtra players share national rank 40.
    insightRow(40, "c", 100, "Maharashtra"),
    insightRow(40, "d", 100, "Maharashtra"),
    insightRow(41, "e", 90, "Maharashtra"),
    // No mappable state code — AITA's own typo. Gets no state rank rather than
    // being bucketed into an invented state.
    insightRow(50, "f", 50),
  ];

  const ranks = assignStateRanks(rows);
  assert.equal(ranks.get("a"), 1);
  assert.equal(ranks.get("c"), 2);
  assert.equal(ranks.get("d"), 2);
  // Competition ranking: the shared 2nd consumes the slot, so the next is 4th.
  assert.equal(ranks.get("e"), 4);
  assert.equal(ranks.get("b"), 1);
  assert.equal(ranks.has("f"), false);
});

test("state aggregates count the top-100 share and skip unmapped codes", () => {
  const rows = [
    insightRow(1, "a", 900, "Maharashtra"),
    insightRow(99, "b", 300, "Maharashtra"),
    insightRow(101, "c", 200, "Maharashtra"),
    insightRow(4, "d", 700, "Tamil Nadu"),
    insightRow(500, "e", 10),
  ];

  assert.deepEqual(computeStateAggregates(rows), [
    { state: "Maharashtra", count: 3, inTop100: 2 },
    { state: "Tamil Nadu", count: 1, inTop100: 1 },
  ]);
});

test("band profiles exclude the total column and flag penalty columns", () => {
  // Real Boys U-14 column labels, including the deduction and the total.
  const labelled = (
    rank: number,
    regNo: string,
    singles: number,
    doubles: number,
    noShow: number,
    total: number,
  ): InsightRow => ({
    regNo,
    rank,
    totalPoints: total,
    state: "Maharashtra",
    points: [
      { label: "BEST-Eight SING. PTS.", value: singles },
      { label: "BEST-Eight DBLS. PTS.", value: doubles },
      { label: "CUT FOR NO SHOW LATE WL", value: noShow },
      { label: "Final TTL PTS.", value: total },
    ],
  });

  const rows = [
    labelled(1, "a", 700, 200, 0, 900),
    labelled(10, "b", 400, 100, 0, 500),
    labelled(50, "c", 250, 50, 10, 300),
    labelled(500, "d", 100, 0, 0, 100),
  ];

  const profiles = computeBandProfiles(rows);
  const [top10, midfield, tail] = profiles;

  assert.equal(profiles.length, 3);
  assert.equal(top10?.label, "Top 10");
  assert.equal(top10?.playerCount, 2);
  assert.equal(top10?.averageTotal, 700);
  // Three component columns, and NOT the fourth: the last points column *is*
  // the total, so including it would double the height of every stacked bar.
  assert.equal(top10?.composition.length, 3);
  assert.equal(top10?.composition.some((c) => c.label === "Final TTL PTS."), false);
  assert.equal(top10?.composition[0]?.average, 550);

  // The penalty column is carried but marked, so the UI can keep it out of the
  // stack instead of stacking a deduction onto the things it deducts from.
  const penalty = midfield?.composition.find((c) => /NO SHOW/.test(c.label));
  assert.equal(penalty?.isDeduction, true);
  assert.equal(penalty?.average, 10);
  assert.equal(
    midfield?.composition.find((c) => /SING/.test(c.label))?.isDeduction,
    false,
  );

  assert.equal(tail?.label, "101 and below");
  assert.equal(tail?.to, null);
});

test("a column this category never uses is dropped rather than drawn empty", () => {
  const rows = [
    insightRow(1, "a", 500, "Maharashtra", [500, 0]),
    insightRow(2, "b", 400, "Kerala", [400, 0]),
  ];

  const profiles = computeBandProfiles(rows);
  assert.deepEqual(
    profiles[0]?.composition.map((c) => c.label),
    ["COL 1"],
  );
});

/**
 * The printed columns do not add up to the printed total. Verified against the
 * live Boys U-16 list on 2026-08-15: the number one shows 1,291 points against
 * columns summing to 250, and the shortfall is his entire Under-18 total.
 *
 * These use the real column labels and the real figures for that list.
 */
const u16Row = (
  rank: number,
  regNo: string,
  singles: number,
  doubles: number,
  quarterDoubles: number,
  noShow: number,
  asian: number,
  total: number,
): InsightRow => ({
  regNo,
  rank,
  totalPoints: total,
  state: "Haryana",
  points: [
    { label: "BEST Eight SING. PTS.", value: singles },
    { label: "BEST Eight DBLS. PTS.", value: doubles },
    { label: "25% BEST Eight DBLS. PTS.", value: quarterDoubles },
    { label: "POINTS CUT FOR NO SHOW LATE WL", value: noShow },
    { label: "03-Aug-25 25 % PTS. Asian U-16", value: asian },
    { label: "TTL. PTS. Final", value: total },
  ],
});

test("the raw doubles column is flagged as printed-but-not-scored", () => {
  // The sheet prints the doubles total and the quarter of it that counts.
  // Stacking both double-counts doubles, so only the quarter is scored.
  const profiles = computeBandProfiles(
    [u16Row(1, "a", 200, 200, 50, 0, 0, 1291)],
    "U-16",
  );
  const composition = profiles[0]?.composition ?? [];
  assert.equal(
    composition.find((c) => c.label === "BEST Eight DBLS. PTS.")?.isInformational,
    true,
  );
  assert.equal(
    composition.find((c) => c.label === "25% BEST Eight DBLS. PTS.")?.isInformational,
    false,
  );
});

test("points carried down from the age group above are recovered as a slice", () => {
  // Tavish Pahwa, real figures: 200 singles + 50 counting doubles = 250, but the
  // sheet prints 1,291. The missing 1,041 is his whole Under-18 total.
  const profiles = computeBandProfiles(
    [u16Row(1, "a", 200, 200, 50, 0, 0, 1291)],
    "U-16",
  );
  const rolled = profiles[0]?.composition.find((c) => c.label.startsWith(ROLLED_DOWN_PREFIX));
  assert.equal(rolled?.label, "Playing up in U-18");
  assert.equal(rolled?.average, 1041);

  // And the slices now account for the total, which is the chart's whole promise.
  const scored = (profiles[0]?.composition ?? [])
    .filter((c) => !c.isDeduction && !c.isInformational)
    .reduce((sum, c) => sum + c.average, 0);
  assert.equal(scored, 1291);
});

test("the no-show cut is added back before solving for the roll-down", () => {
  // Paranjay Siwach: own columns 773.75, Under-18 209.75, cut 5 → 978.5. Without
  // adding the cut back the residual would come out 5 short and the penalty
  // would be silently charged twice — once as a deduction, once as a smaller
  // roll-down. Stored at one decimal like every other average here.
  const profiles = computeBandProfiles(
    [u16Row(5, "a", 220, 215, 53.75, 5, 500, 978.5)],
    "U-16",
  );
  assert.equal(
    profiles[0]?.composition.find((c) => c.label.startsWith(ROLLED_DOWN_PREFIX))?.average,
    209.8,
  );
});

test("no roll-down slice on U-18 or the open-age lists, which have nothing above", () => {
  assert.equal(nextBracketUp("U-18"), null);
  assert.equal(nextBracketUp("Singles"), null);
  assert.equal(nextBracketUp("U-12"), "U-14");

  const profiles = computeBandProfiles([u16Row(1, "a", 200, 200, 50, 0, 0, 250)], "Singles");
  assert.equal(
    profiles[0]?.composition.some((c) => c.label.startsWith(ROLLED_DOWN_PREFIX)),
    false,
  );
});

test("a list whose columns overshoot its totals gets no roll-down slice at all", () => {
  // Every row contradicting means the rule changed. Publishing the slice anyway
  // would be inventing a number; omitting it lets the UI withhold the panel.
  const rows = Array.from({ length: 20 }, (_, i) =>
    u16Row(i + 1, `p${i}`, 900, 0, 0, 0, 0, 100),
  );
  const profiles = computeBandProfiles(rows, "U-16");
  assert.equal(
    profiles[0]?.composition.some((c) => c.label.startsWith(ROLLED_DOWN_PREFIX)),
    false,
  );
});

test("a scattering of rows that do not reconcile does not switch the slice off", () => {
  // AITA's own sheets carry a few of these: on the real Boys U-16 list of
  // 2026-08-03, 18 rows in 1,602 print a total below the sum of their columns.
  // An earlier 1% guard let those 18 disable the feature for all 1,602.
  const rows = [
    // 94 well-behaved rows, each carrying 50 down from Under-18.
    ...Array.from({ length: 94 }, (_, i) => u16Row(i + 1, `ok${i}`, 100, 0, 0, 0, 0, 150)),
    // 6 that overshoot, as Kaustubh Singh's row does.
    ...Array.from({ length: 6 }, (_, i) => u16Row(95 + i, `bad${i}`, 100, 0, 0, 0, 0, 91)),
  ];

  const rolled = computeBandProfiles(rows, "U-16")[0]?.composition.find((c) =>
    c.label.startsWith(ROLLED_DOWN_PREFIX),
  );
  assert.ok(rolled, "the roll-down slice should survive a few bad rows");
  // The bad rows are clamped to zero rather than dragging the average negative.
  assert.ok(rolled!.average > 0);
});

test("an empty list produces no analytics rather than zeroed ones", () => {
  assert.deepEqual(computeBenchmarks([]), []);
  assert.deepEqual(computeStateAggregates([]), []);
  assert.deepEqual(computeBandProfiles([]), []);
  assert.equal(assignStateRanks([]).size, 0);
});
