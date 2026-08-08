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
