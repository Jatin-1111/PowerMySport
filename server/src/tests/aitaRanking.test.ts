import assert from "node:assert/strict";
import test from "node:test";
import {
  STALENESS_ALERT_DAYS,
  assessStaleness,
  isAgeGroupRollover,
} from "../shared/services/aita/AitaRankingIngestService";
import {
  parsePointBreakdown,
  parseRankingList,
  regNoFromPlayerKey,
  toFloat,
} from "../shared/services/aita/rankingListParser";
import { isoDateToWid, widToIsoDate } from "../shared/services/aita/AitaRankingSource";
import { AITA_LISTS, listByCode, listForCombo } from "../shared/services/aita/types";
import {
  ROLLED_DOWN_PREFIX,
  assignStateRanks,
  computeBandProfiles,
  computeBenchmarks,
  computeSampledBandProfiles,
  computeStateAggregates,
  nextBracketUp,
  nextTierFor,
  type InsightRow,
} from "../shared/services/aita/rankingInsights";
import {
  parseStateCell,
  reconcileStates,
  resolveStateCode,
  resolveZoneId,
} from "../shared/services/aita/stateCodes";
import { pickCompositionSample } from "../shared/services/aita/sampleBandComposition";
import { INDIAN_STATES_AND_UTS } from "../shared/utils/states";

/**
 * Builds one `div.rankingCard` in the shape the hitcourt platform emits.
 *
 * Names here are invented. The real lists are lists of children, and the repo
 * should not carry their names and birth years just to have something to parse —
 * the same reason the old suite refused to carry a PDF fixture full of dates of
 * birth.
 */
function card(options: {
  rank: number;
  playerKey: string;
  name: string;
  yob?: string;
  stateCode?: string;
  stateName?: string;
  points?: string;
  total?: string;
  tourn?: string;
  wtnSingles?: string;
  wtnDoubles?: string;
  /** "up" | "down" | "none" — rendered exactly as the source renders it. */
  move?: "up" | "down" | "none";
  movePlaces?: string;
  medal?: string;
}): string {
  const {
    rank,
    playerKey,
    name,
    yob = "2014",
    stateCode = "MH",
    stateName = "Maharashtra",
    points = "500.00",
    total = points,
    tourn = "0",
    wtnSingles = "-",
    wtnDoubles = "-",
    move = "none",
    movePlaces = "",
    medal = "",
  } = options;

  // Down-movers print an already-signed number, up-movers do not. That
  // asymmetry is real and is what `readMovement` has to absorb.
  const moveInner =
    move === "none"
      ? '<i class="fa fa-minus" aria-hidden="true"></i>'
      : `<i class="fas fa-long-arrow-alt-${move}" aria-hidden="true"></i>${movePlaces}`;

  return `<div class="rankingCard rank-row">
  <span class="rr-rank${medal ? ` ${medal}` : ""}"><span>${rank}</span></span>
  <span class="rank rr-move mx-2">${moveInner}</span>
  <span class="rr-avatar"><img src="https://bucket.example/photo/${rank}.png" alt="" loading="lazy" /></span>
  <div class="rr-who">
    <a href="javascript:void(0);" class="rr-name load-ranking-inline" data-rank="${rank}"
       data-weekof="1786300200" data-player="${playerKey}" data-category="16"
       data-short-code="BS12" title="${name}">${name}</a>
    <small class="rr-sub">
      <span class="yob-inline"><span class="yob">${yob}</span><span class="dotsep">&middot;</span></span>
      <a href="https://www.aita.hitcourt.com/ranking-view?wid=1786300200&category=BS12&page=1&record=25&state=${stateCode}" target="_self"><img src="/vendors/flags/in.png" alt="flags" title="India" />&nbsp;${stateName}</a>
    </small>
  </div>
  <div class="rr-stat"><small class="l">Born</small><span class="v">${yob}</span></div>
  <div class="rr-stat"><small class="l">Tourn.</small><span class="v tour-played">${tourn}</span></div>
  <div class="rr-wtn">
    <span class="wtn-brand"><img class="wtn-mark" src="/wtn.svg" alt="WTN" /></span>
    <span class="wtn-val"><small class="l">Single</small><b>${wtnSingles}</b></span>
    <span class="wtn-sep"></span>
    <span class="wtn-val"><small class="l">Doubles</small><b>${wtnDoubles}</b></span>
  </div>
  <div class="rr-points">
    <span class="pts"><span class="points">${points}</span> <small>pts</small></span>
    <small class="rr-meta">Total Pts. <span class="total-pts">${total}</span><span class="meta-tourn"> &middot; <span class="tour-played">${tourn}</span> Tourn.</span></small>
  </div>
  <div class="rr-detail"></div>
</div>`;
}

/** Wraps cards in the page shell, including the inline vars the page echoes. */
function page(cards: string[], vars: { weekof?: string; category?: string } = {}): string {
  const { weekof = "1786300200", category = "BS12" } = vars;
  return `<html><head><title>AITA Rankings</title></head><body>
<script>
  var LIST_BASE = 'ranking';
  var weekof_int = ${weekof};
  var category="${category}";
  var category_id = 16;
  var record = 25;
</script>
<div class="rank-list">${cards.join("\n")}</div>
</body></html>`;
}

test("a page with no ranking rows throws rather than reporting an empty list", () => {
  // This is the shape of the failure that hid the August 2026 cutover for three
  // weeks: a successful response whose emptiness was indistinguishable from a
  // quiet week. It must be an error, never zero rows.
  assert.throws(
    () => parseRankingList("<html><body><p>Nothing here</p></body></html>"),
    /no `div\.rankingCard` rows/
  );
});

test("a row's fields are read off the markup that names them", () => {
  const result = parseRankingList(
    page([
      card({
        rank: 1,
        playerKey: Buffer.from("AAABBB440090").toString("base64"),
        name: "Firstname LASTNAME",
        yob: "2014",
        stateCode: "GJ",
        stateName: "Gujarat",
        points: "1149.00",
        tourn: "7",
        medal: "m1",
      }),
    ])
  );

  assert.equal(result.rows.length, 1);
  const row = result.rows[0]!;
  assert.equal(row.rank, 1);
  assert.equal(row.fullName, "Firstname LASTNAME");
  assert.equal(row.regNo, "440090");
  assert.equal(row.birthYear, 2014);
  assert.equal(row.stateCode, "GJ");
  assert.equal(row.totalPoints, 1149);
  assert.equal(row.tournamentsPlayed, 7);
  // Year of birth is all the source publishes now, so there is no exact date of
  // birth of a minor to hold in the first place.
  assert.equal(row.dob, null);
  assert.equal(result.diagnostics.malformedRows, 0);
});

test("the registration number is recovered from the base64 player key", () => {
  // The number is not printed anywhere on the page — it lives inside the key.
  // Recovering it is what keeps the primary key continuous across the cutover,
  // and therefore what keeps week-over-week movement working on archived rows.
  assert.equal(regNoFromPlayerKey("UklBTkFONDQwMDkw"), "440090");
  // Short names are padded with X; the digits are still the identifier.
  assert.equal(regNoFromPlayerKey("REhBU01YNDM3NzI5"), "437729");
  // A key we cannot decode must yield null, never a partial guess — inventing
  // one would merge two players' histories under a single row.
  assert.equal(regNoFromPlayerKey("bm90LWEta2V5"), null);
  assert.equal(regNoFromPlayerKey(""), null);
});

test("a row missing its identity fields is counted, not defaulted", () => {
  const broken =
    '<div class="rankingCard rank-row"><span class="rr-rank"><span>4</span></span></div>';
  const result = parseRankingList(
    page([
      card({ rank: 1, playerKey: Buffer.from("AAABBB111111").toString("base64"), name: "A ONE" }),
      broken,
    ])
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.diagnostics.malformedRows, 1);
  assert.equal(result.diagnostics.unparsedLines.length, 1);
});

test("movement direction comes from the icon, never from the printed sign", () => {
  // Down-movers render "-13", up-movers render "1". Trusting the sign would
  // flip every up-mover negative and read as a fall.
  const result = parseRankingList(
    page([
      card({
        rank: 1,
        playerKey: Buffer.from("AAAAAA100001").toString("base64"),
        name: "A UP",
        move: "up",
        movePlaces: "2",
      }),
      card({
        rank: 2,
        playerKey: Buffer.from("BBBBBB100002").toString("base64"),
        name: "B DOWN",
        move: "down",
        movePlaces: "-13",
      }),
      card({
        rank: 3,
        playerKey: Buffer.from("CCCCCC100003").toString("base64"),
        name: "C FLAT",
        move: "none",
      }),
    ])
  );
  assert.deepEqual(result.rows[0]!.sourceMovement, { direction: "up", places: 2 });
  assert.deepEqual(result.rows[1]!.sourceMovement, { direction: "down", places: 13 });
  // A dash means "no movement" *or* "no previous week" — the source renders both
  // identically, which is why `prevRank` stays derived from our own archive.
  assert.deepEqual(result.rows[2]!.sourceMovement, { direction: "none", places: 0 });
});

test("an absent WTN reads as null rather than zero", () => {
  // Every one of 1,663 rows on Boys U-14 read "-" at cutover. A zero would be a
  // claim about the player's rating; null is the truth.
  const result = parseRankingList(
    page([
      card({
        rank: 1,
        playerKey: Buffer.from("AAABBB440090").toString("base64"),
        name: "A ONE",
        wtnSingles: "-",
        wtnDoubles: "14.2",
      }),
    ])
  );
  assert.equal(result.rows[0]!.wtnSingles, null);
  assert.equal(result.rows[0]!.wtnDoubles, 14.2);
});

test("the page's echoed week and list are captured for cross-checking", () => {
  // This replaces the old printed-"As on"-line check and is stronger: it reads
  // the server's own idea of what it served, so a silent fallback to a default
  // list is caught instead of being filed under the date we asked for.
  const result = parseRankingList(
    page(
      [card({ rank: 1, playerKey: Buffer.from("AAABBB440090").toString("base64"), name: "A ONE" })],
      {
        weekof: "1785695400",
        category: "GS16",
      }
    )
  );
  assert.equal(result.sourceWeekof, 1785695400);
  assert.equal(result.sourceCategory, "GS16");
});

test("a full page is treated as truncated rather than complete", () => {
  // `record` is not enforced server-side today. "Today" is three weeks old, and
  // a silently truncated list is a wrong list.
  const cards = Array.from({ length: 3 }, (_, i) =>
    card({
      rank: i + 1,
      playerKey: Buffer.from(`AAAAAA10000${i}`).toString("base64"),
      name: `P ${i}`,
    })
  );
  assert.throws(
    () => parseRankingList(page(cards), { requestedPageSize: 3 }),
    /probably truncated/
  );
  // One under the cap is a complete list.
  assert.equal(parseRankingList(page(cards), { requestedPageSize: 4 }).rows.length, 3);
});

test("blanks and dashes coerce to null, not to zero", () => {
  assert.equal(toFloat("1149.00"), 1149);
  assert.equal(toFloat("1,149.00"), 1149);
  assert.equal(toFloat("-"), null);
  assert.equal(toFloat(""), null);
  assert.equal(toFloat(undefined), null);
});

/**
 * The identity that took a debug cycle to find on the old PDFs, now stated
 * outright by the source. Pinned because it is the whole basis of the points
 * composition chart: the bracket above rolls down *in full* and used to be
 * invisible.
 */
test("the point breakdown reconciles, with the roll-down named", () => {
  const fragment = `<div class="pv"><div class="pv-stats">
    <div class="pv-stat"><span class="lbl">Rank</span><span class="val">1</span></div>
    <div class="pv-stat is-hot"><span class="lbl">Best 8 Sngls</span><span class="val">725.00</span></div>
    <div class="pv-stat"><span class="lbl">Best 8 Dbls</span><span class="val">675.00</span></div>
    <div class="pv-stat is-hot"><span class="lbl">25% Best 8 Dbls</span><span class="val">168.75</span></div>
    <div class="pv-stat is-hot"><span class="lbl">Asian (25%)</span><span class="val">-</span></div>
    <div class="pv-stat is-hot"><span class="lbl">14&amp;Under</span><span class="val">255.25</span></div>
    <div class="pv-stat"><span class="lbl">Penalty Pts</span><span class="val">-</span></div>
    <div class="pv-stat"><span class="lbl">Total Pts</span><span class="val">1149.00</span></div>
  </div></div>`;

  const parsed = parsePointBreakdown(fragment);
  assert.equal(parsed.rank, 1);
  assert.equal(parsed.totalPoints, 1149);

  const byLabel = new Map(parsed.slices.map((s) => [s.label, s]));
  // The raw doubles column is printed but not scored — stacking it alongside its
  // 25% sibling draws the chart at double height.
  assert.equal(byLabel.get("Best 8 Dbls")!.isInformational, true);
  assert.equal(byLabel.get("25% Best 8 Dbls")!.isInformational, false);
  assert.equal(byLabel.get("Penalty Pts")!.isDeduction, true);
  assert.equal(byLabel.get("14&Under")!.isRollDown, true);
  assert.equal(byLabel.get("Best 8 Sngls")!.isRollDown, false);
  // A dash is a legitimate zero for a component that does not apply.
  assert.equal(byLabel.get("Asian (25%)")!.value, 0);

  // 725.00 + 168.75 + 0 + 255.25 = 1149.00, exact to the paisa.
  const scoring = parsed.slices
    .filter((s) => !s.isInformational && !s.isDeduction)
    .reduce((sum, s) => sum + s.value, 0);
  assert.equal(scoring, parsed.totalPoints);
});

/**
 * The week id is midnight IST, which is 18:30 UTC the *previous* day. Reading it
 * as a UTC date is off by one, which would file every list a day early.
 */
test("week ids convert to and from the as-on Monday in IST", () => {
  assert.equal(widToIsoDate(1786300200), "2026-08-10");
  assert.equal(widToIsoDate(1785695400), "2026-08-03");
  assert.equal(isoDateToWid("2026-08-10"), 1786300200);
  assert.equal(isoDateToWid("2026-01-12"), 1768156200);
  // Round-trips, which is what the ingest relies on when it turns a stored
  // as-on date back into a request.
  for (const wid of [1786300200, 1785090600, 1768156200]) {
    assert.equal(isoDateToWid(widToIsoDate(wid)), wid);
  }
});

/**
 * Two vocabularies have to stay in step: what the source takes, and what we
 * store. A drift here silently orphans 468k archived rows.
 */
test("all twelve lists map both ways between stored combo and source code", () => {
  assert.equal(AITA_LISTS.length, 12);
  for (const list of AITA_LISTS) {
    assert.equal(listByCode(list.code)?.categoryId, list.categoryId);
    assert.equal(listForCombo(list.category, list.subcategory)?.code, list.code);
  }
  // The numeric ids are not derivable from the codes and are not contiguous —
  // doubles were bolted on at 30 and 35. Pinned so a "tidy-up" cannot renumber
  // them.
  assert.equal(listByCode("BS12")?.categoryId, 16);
  assert.equal(listByCode("MD")?.categoryId, 30);
  assert.equal(listByCode("WD")?.categoryId, 35);
  assert.equal(listByCode("NOPE"), null);
  // Unique on both keys.
  assert.equal(new Set(AITA_LISTS.map((l) => l.code)).size, 12);
  assert.equal(new Set(AITA_LISTS.map((l) => l.categoryId)).size, 12);
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
    "AN",
    "AP",
    "AR",
    "AS",
    "BR",
    "CG",
    "CH",
    "DL",
    "DN",
    "GA",
    "GJ",
    "HP",
    "HR",
    "JH",
    "JK",
    "KA",
    "KL",
    "LA",
    "LD",
    "MH",
    "ML",
    "MN",
    "MP",
    "MZ",
    "NL",
    "OD",
    "PB",
    "PY",
    "RJ",
    "SK",
    "TN",
    "TR",
    "TS",
    "UK",
    "UP",
    "WB",
    "OR",
    "UA",
    "UT",
    "CT",
    "DD",
    "DH",
    "PO",
    "PN",
    "TG",
    "AD",
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
      [
        "AN",
        "AP",
        "AR",
        "AS",
        "BR",
        "CG",
        "CH",
        "DN",
        "DL",
        "GA",
        "GJ",
        "HR",
        "HP",
        "JK",
        "JH",
        "KA",
        "KL",
        "LA",
        "LD",
        "MP",
        "MH",
        "MN",
        "ML",
        "MZ",
        "NL",
        "OD",
        "PY",
        "PB",
        "RJ",
        "SK",
        "TN",
        "TS",
        "TR",
        "UP",
        "UK",
        "WB",
      ].some((code) => resolveStateCode(code) === name)
    )
  );
  assert.equal(reached.size, INDIAN_STATES_AND_UTS.length);
});

/**
 * AITA's zones are the eligibility boundary for Talent Series entry, and the new
 * platform publishes them as a `region_id` per state — the first time this has
 * been machine-readable rather than transcribed from a 2020 PDF.
 */
test("every state AITA publishes has exactly one of the four zones", () => {
  // The 36 codes on AITA's own state table, as fetched 2026-08-29.
  const published =
    "AN AP AR AS BR CG CH DH DL GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD PB PY RJ SK TG TN TR UK UP WB".split(
      " "
    );
  assert.equal(published.length, 36);
  const seen = new Map<number, number>();
  for (const code of published) {
    const zone = resolveZoneId(code);
    assert.ok(zone !== null, `${code} has no zone`);
    assert.ok(zone! >= 1 && zone! <= 4, `${code} has zone ${zone}`);
    seen.set(zone!, (seen.get(zone!) ?? 0) + 1);
  }
  // All four zones are populated; a mapping that collapsed three of them into
  // one would still satisfy the per-code check above.
  assert.equal(seen.size, 4);
});

test("historical state aliases resolve to a name but deliberately not to a zone", () => {
  // "OR" tells us the row means Odisha; it does not tell us which zone AITA
  // would place a pre-2011 registration in today. Guessing is how state drift
  // starts.
  assert.equal(resolveStateCode("OR"), "Odisha");
  assert.equal(resolveZoneId("OR"), null);
  assert.equal(resolveZoneId("PD"), null);
});

test("state reconciliation reports drift in both directions", () => {
  // Nothing to report when the source agrees with us.
  assert.deepEqual(reconcileStates([{ code: "MH", name: "Maharashtra" }]), []);
  // A code we cannot map would strand every player in that state.
  assert.match(reconcileStates([{ code: "ZZ", name: "Atlantis" }])[0]!, /cannot map/);
  // A name mismatch is the shape of the bug that turned a valid state pick into
  // a whole-page 404, so it has to surface even though the code resolves.
  assert.match(
    reconcileStates([{ code: "OD", name: "Orissa" }])[0]!,
    /AITA calls it "Orissa", we call it "Odisha"/
  );
});

/**
 * "PD" appeared exactly once in a 567-row Men's Doubles list that used "PY"
 * correctly elsewhere. AITA's own state table has no such code, which settles
 * it: it was a typo, and the row publishes with a code and no canonical state
 * rather than being guessed into Puducherry.
 */
test("an unmapped code yields no canonical state instead of a nearest guess", () => {
  assert.equal(resolveStateCode("PD"), null);
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
  components: number[] = []
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
  assert.equal(
    benchmarks.some((b) => b.rank === 50),
    false
  );
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
    total: number
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
  assert.equal(
    top10?.composition.some((c) => c.label === "Final TTL PTS."),
    false
  );
  assert.equal(top10?.composition[0]?.average, 550);

  // The penalty column is carried but marked, so the UI can keep it out of the
  // stack instead of stacking a deduction onto the things it deducts from.
  const penalty = midfield?.composition.find((c) => /NO SHOW/.test(c.label));
  assert.equal(penalty?.isDeduction, true);
  assert.equal(penalty?.average, 10);
  assert.equal(midfield?.composition.find((c) => /SING/.test(c.label))?.isDeduction, false);

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
    ["COL 1"]
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
  total: number
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
  const profiles = computeBandProfiles([u16Row(1, "a", 200, 200, 50, 0, 0, 1291)], "U-16");
  const composition = profiles[0]?.composition ?? [];
  assert.equal(composition.find((c) => c.label === "BEST Eight DBLS. PTS.")?.isInformational, true);
  assert.equal(
    composition.find((c) => c.label === "25% BEST Eight DBLS. PTS.")?.isInformational,
    false
  );
});

test("points carried down from the age group above are recovered as a slice", () => {
  // Tavish Pahwa, real figures: 200 singles + 50 counting doubles = 250, but the
  // sheet prints 1,291. The missing 1,041 is his whole Under-18 total.
  const profiles = computeBandProfiles([u16Row(1, "a", 200, 200, 50, 0, 0, 1291)], "U-16");
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
  const profiles = computeBandProfiles([u16Row(5, "a", 220, 215, 53.75, 5, 500, 978.5)], "U-16");
  assert.equal(
    profiles[0]?.composition.find((c) => c.label.startsWith(ROLLED_DOWN_PREFIX))?.average,
    209.8
  );
});

test("no roll-down slice on U-18 or the open-age lists, which have nothing above", () => {
  assert.equal(nextBracketUp("U-18"), null);
  assert.equal(nextBracketUp("Singles"), null);
  assert.equal(nextBracketUp("U-12"), "U-14");

  const profiles = computeBandProfiles([u16Row(1, "a", 200, 200, 50, 0, 0, 250)], "Singles");
  assert.equal(
    profiles[0]?.composition.some((c) => c.label.startsWith(ROLLED_DOWN_PREFIX)),
    false
  );
});

test("a list whose columns overshoot its totals gets no roll-down slice at all", () => {
  // Every row contradicting means the rule changed. Publishing the slice anyway
  // would be inventing a number; omitting it lets the UI withhold the panel.
  const rows = Array.from({ length: 20 }, (_, i) => u16Row(i + 1, `p${i}`, 900, 0, 0, 0, 0, 100));
  const profiles = computeBandProfiles(rows, "U-16");
  assert.equal(
    profiles[0]?.composition.some((c) => c.label.startsWith(ROLLED_DOWN_PREFIX)),
    false
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
    c.label.startsWith(ROLLED_DOWN_PREFIX)
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

/**
 * The sampling picker. Pure arithmetic, so it is pinned without a network or a
 * database — which is the point of keeping it separate from the fetch.
 */
const candidates = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    regNo: String(400000 + i),
    rank: i + 1,
    playerKey: `key${i}`,
    totalPoints: 1000 - i,
  }));

test("a band smaller than the quota is taken whole, not sampled", () => {
  // "Top 10" holds ten players every week, so it is always a census. A chart of
  // the top 10 drawn from four of them would be the weakest claim on the panel
  // and the one readers scrutinise most.
  const picked = pickCompositionSample(candidates(1000), 15);
  const topBand = picked.filter((c) => c.rank <= 10);
  assert.equal(topBand.length, 10);
});

test("larger bands are spread evenly and include both ends", () => {
  const picked = pickCompositionSample(candidates(1000), 15);

  const mid = picked.filter((c) => c.rank >= 11 && c.rank <= 100).map((c) => c.rank);
  assert.equal(mid.length, 15);
  // Both extremes of the band are represented rather than trimmed off: the head
  // of a band and its tail are the two places composition differs most.
  assert.equal(mid[0], 11);
  assert.equal(mid[mid.length - 1], 100);

  // Evenly spaced, not clustered. With 90 members and 15 picks the step is ~6.36,
  // so no two consecutive picks may sit more than one rank off that.
  const gaps = mid.slice(1).map((rank, i) => rank - mid[i]!);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, `uneven gaps: ${gaps}`);
});

test("the same list picks the same players every week", () => {
  // Deterministic on purpose. If the sample moved week to week, a change in the
  // chart could not be told apart from a change in who was measured — and the
  // whole pipeline is built so that re-running produces the same answer.
  const a = pickCompositionSample(candidates(500), 15).map((c) => c.regNo);
  const b = pickCompositionSample(candidates(500), 15).map((c) => c.regNo);
  assert.deepEqual(a, b);
});

test("the tail band is sampled, not skipped for being open-ended", () => {
  const picked = pickCompositionSample(candidates(1600), 15);
  const tail = picked.filter((c) => c.rank >= 101);
  assert.equal(tail.length, 15);
  assert.equal(tail[0]!.rank, 101);
  assert.equal(tail[tail.length - 1]!.rank, 1600);
});

test("the whole sweep stays inside a sane request budget", () => {
  // 12 lists x this. The number is the reason sampling is viable at all, so it
  // is worth failing a test over rather than discovering in a log.
  const perList = pickCompositionSample(candidates(1663), 15).length;
  assert.ok(perList <= 40, `${perList} requests per list is more than budgeted`);
  assert.ok(perList * 12 <= 480, "sweep budget exceeded");
});

test("a degenerate quota asks for nothing rather than throwing", () => {
  assert.deepEqual(pickCompositionSample(candidates(100), 0), []);
  assert.deepEqual(pickCompositionSample([], 15), []);
});

/**
 * Band profiles built from a sample. The trap here is population mixing: the
 * band's average total covers everyone, the bars cover only the sample, and
 * quietly stacking one against the other is how a chart lies without erroring.
 */
const sampledRow = (rank: number, parts: Array<[string, number]>, total: number): InsightRow => ({
  regNo: `r${rank}`,
  rank,
  totalPoints: total,
  points: [
    ...parts.map(([label, value]) => ({ label, value })),
    { label: "Total Pts.", value: total },
  ],
  pointsSampled: true,
});

const plainRow = (rank: number, total: number): InsightRow => ({
  regNo: `r${rank}`,
  rank,
  totalPoints: total,
  points: [{ label: "Total Pts.", value: total }],
});

test("no sampled rows means no composition at all", () => {
  // The right answer to "we have not measured this" is silence. A panel drawn
  // from one column would imply the rest is zero.
  const rows = Array.from({ length: 200 }, (_, i) => plainRow(i + 1, 1000 - i));
  assert.deepEqual(computeSampledBandProfiles(rows), []);
});

test("counts and averages are exact while only the bars are sampled", () => {
  const rows: InsightRow[] = [];
  // A band of 10 where only 3 carry a breakdown — the floor, so the composition
  // is still drawn.
  for (let rank = 1; rank <= 10; rank++) {
    rows.push(
      rank <= 3
        ? sampledRow(
            rank,
            [
              ["Best 8 Sngls", 600],
              ["14&Under", 400],
            ],
            1000
          )
        : plainRow(rank, 500)
    );
  }

  const [band] = computeSampledBandProfiles(rows);
  assert.ok(band);
  // Every row has a rank and a total, so these two are facts about the band.
  assert.equal(band!.playerCount, 10);
  assert.equal(band!.averageTotal, 650); // (1000 x 3 + 500 x 7) / 10
  // The bars can only speak for the three players behind them.
  assert.equal(band!.sampleSize, 3);
  assert.equal(band!.compositionTotal, 1000);

  // And the bars sum to the figure they are reported against — never to the
  // whole-band average, which would leave an unexplainable gap.
  const stacked = band!.composition
    .filter((s) => !s.isInformational && !s.isDeduction)
    .reduce((sum, s) => sum + s.average, 0);
  assert.ok(Math.abs(stacked - band!.compositionTotal!) < 0.5, `${stacked}`);
  assert.notEqual(band!.compositionTotal, band!.averageTotal);
});

test("the printed roll-down is used as-is, never re-derived as a residual", () => {
  // `computeBandProfiles` recovers the bracket above as `total - columns` because
  // the old PDFs never printed it. The new breakdown names it, and measured
  // across ranks 1 to 1,078 on three list types every sampled player's columns
  // sum to their total exactly — so a residual would be zero and a derived slice
  // would be a duplicate of a real one.
  const rows = Array.from({ length: 10 }, (_, i) =>
    sampledRow(
      i + 1,
      [
        ["Best 8 Sngls", 725],
        ["25% Best 8 Dbls", 168.75],
        ["14&Under", 255.25],
      ],
      1149
    )
  );
  const [band] = computeSampledBandProfiles(rows);
  const labels = band!.composition.map((s) => s.label);
  assert.deepEqual(labels, ["Best 8 Sngls", "25% Best 8 Dbls", "14&Under"]);
  assert.equal(labels.filter((l) => l.startsWith(ROLLED_DOWN_PREFIX)).length, 0);
});

test("the raw doubles column is still kept out of the arithmetic", () => {
  // The one trap that survives the source change: both the raw doubles total and
  // the quarter of it that scores are printed, and stacking both doubles the bar.
  const rows = Array.from({ length: 10 }, (_, i) =>
    sampledRow(
      i + 1,
      [
        ["Best 8 Sngls", 725],
        ["Best 8 Dbls", 675],
        ["25% Best 8 Dbls", 168.75],
        ["14&Under", 255.25],
      ],
      1149
    )
  );
  const [band] = computeSampledBandProfiles(rows);
  const raw = band!.composition.find((s) => s.label === "Best 8 Dbls");
  const quarter = band!.composition.find((s) => s.label === "25% Best 8 Dbls");
  assert.equal(raw?.isInformational, true);
  assert.equal(quarter?.isInformational, false);

  // Each slice is rounded to a tenth before it is stored, so the stack can land
  // a tenth off the total. That is well inside the client's reconciliation
  // tolerance of max(0.5, 1% of the total) — which exists so display rounding
  // never withholds the panel or gets mistaken for a missing component. What
  // would matter is being off by the whole doubles column.
  const stacked = band!.composition
    .filter((s) => !s.isInformational && !s.isDeduction)
    .reduce((sum, s) => sum + s.average, 0);
  assert.ok(Math.abs(stacked - 1149) < 0.5, `stacked to ${stacked}, expected ~1149`);
  // The failure this guards against, stated explicitly: stacking the raw column
  // too would reach ~1824.
  assert.ok(stacked < 1200, "raw doubles column leaked into the stack");
});

test("a band with members but no sampled players reports itself honestly", () => {
  const rows: InsightRow[] = [];
  for (let rank = 1; rank <= 10; rank++) {
    rows.push(sampledRow(rank, [["Best 8 Sngls", 1000]], 1000));
  }
  // A second band nobody was sampled from.
  for (let rank = 11; rank <= 60; rank++) rows.push(plainRow(rank, 100));

  const profiles = computeSampledBandProfiles(rows);
  const second = profiles.find((p) => p.label === "11–100");
  assert.ok(second);
  // Its count and average are real; it simply has no bars to draw.
  assert.equal(second!.playerCount, 50);
  assert.equal(second!.averageTotal, 100);
  assert.equal(second!.sampleSize, 0);
  assert.deepEqual(second!.composition, []);
});

test("the penalty column is flagged as a deduction, not stacked", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    sampledRow(
      i + 1,
      [
        ["Best 8 Sngls", 1100],
        ["Penalty Pts", 50],
      ],
      1050
    )
  );
  const [band] = computeSampledBandProfiles(rows);
  assert.equal(band!.composition.find((s) => s.label === "Penalty Pts")?.isDeduction, true);
});

/**
 * The asymmetry between AITA's two endpoints, pinned because it is invisible
 * unless you compare them and it silently shifts every penalised player.
 *
 * The list page publishes a total **net** of the penalty; the breakdown endpoint
 * publishes it **gross** with the penalty as its own row. Boys U-16 rank 638 on
 * 2026-08-10: list 30, breakdown 40, penalty 10.
 *
 * So a stored row's components are gross of the penalty against a net total —
 * the same shape the old PDF rows have, which is why `explainTotal` adds the
 * deduction back on both paths.
 */
test("components are stored gross of the penalty, against the net list total", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    // scoring 40, penalty 10, list total 30.
    sampledRow(
      i + 1,
      [
        ["Best 8 Sngls", 40],
        ["Penalty Pts", 10],
      ],
      30
    )
  );
  const [band] = computeSampledBandProfiles(rows);
  assert.ok(band);
  assert.equal(band!.compositionTotal, 30);

  const scoring = band!.composition
    .filter((s) => !s.isInformational && !s.isDeduction)
    .reduce((sum, s) => sum + s.average, 0);
  const penalty = band!.composition
    .filter((s) => s.isDeduction)
    .reduce((sum, s) => sum + Math.abs(s.average), 0);

  // scoring - penalty = net total. Reading it the other way round would report
  // this band as 50 rather than 30.
  assert.equal(scoring - penalty, band!.compositionTotal);
  assert.equal(scoring, 40);
  assert.equal(penalty, 10);
});

/**
 * Staleness. Rewritten 2026-08-29 because the original measured the wrong thing:
 * it compared the newest list's as-on date against today and alarmed past three
 * weeks, while **AITA's own upload lag routinely runs 12 to 19 days**. On the day
 * this was found the pipeline held every list AITA offered and reported 19 days
 * against a threshold of 21 — two days from crying wolf on a healthy pipeline.
 *
 * An alarm that fires when nothing is wrong is worse than none: it is how the
 * platform cutover went unnoticed for three weeks.
 */
test("being level with the source is never stale, however old the week is", () => {
  // The exact situation on 2026-08-29: AITA's newest week is 10 Aug and we hold
  // it. Nineteen days old, and completely healthy.
  const health = assessStaleness("2026-08-10", "2026-08-10", new Date("2026-08-29T12:00:00Z"));
  assert.equal(health.daysSincePublish, 19);
  assert.equal(health.behindSource, false);
  assert.equal(health.stale, false);
  assert.equal(health.staleReason, null);

  // Still not stale two months on. If AITA stops publishing, that is a fact
  // about AITA, and the source-unreachable alarm is what covers a real break.
  const later = assessStaleness("2026-08-10", "2026-08-10", new Date("2026-10-20T12:00:00Z"));
  assert.equal(later.stale, false);
});

test("being behind the source is reported as the fault, with no timed grace", () => {
  // A first attempt put a two-day grace here. It could never fire: the only
  // interval this function can compute is between the two as-on dates, and AITA
  // publishes weekly, so that gap is >= 7 days the instant a new week appears.
  // Whether being behind is worth shouting about needs "how long have we been
  // behind", which needs memory across runs — so it lives in the scheduler.
  const behind = assessStaleness("2026-08-03", "2026-08-10", new Date("2026-08-10T09:00:00Z"));
  assert.equal(behind.behindSource, true);
  assert.equal(behind.stale, true);
  assert.match(behind.staleReason!, /behind the source/);

  // And the verdict does not drift with how long nobody looked. It is a
  // statement about two lists, not about the clock.
  const muchLater = assessStaleness("2026-08-03", "2026-08-10", new Date("2026-12-01T09:00:00Z"));
  assert.equal(muchLater.stale, true);
  assert.equal(muchLater.staleReason, behind.staleReason);
});

test("the date ceiling applies only when the source cannot be read", () => {
  // Unknown source, recent list: nothing to say.
  const ok = assessStaleness("2026-08-10", null, new Date("2026-08-29T12:00:00Z"));
  assert.equal(ok.behindSource, null);
  assert.equal(ok.stale, false);

  // Unknown source, and our newest is past the fallback ceiling. This is the only
  // case where the age of our own data is evidence on its own.
  const old = assessStaleness("2026-08-10", null, new Date("2026-10-01T12:00:00Z"));
  assert.equal(old.stale, true);
  assert.match(old.staleReason!, /could not be read/);

  // The ceiling must clear AITA's real lag. Nineteen days happened; 21 was the
  // old threshold and would have fired on it.
  assert.ok(STALENESS_ALERT_DAYS > 19, "the ceiling must clear AITA's observed 19-day lag");
});

test("a source week older than ours is not 'behind'", () => {
  // Backfills and corrections can leave us holding a week the source's *latest*
  // pointer has moved past. Ahead is not behind.
  const ahead = assessStaleness("2026-08-10", "2026-08-03", new Date("2026-08-12T12:00:00Z"));
  assert.equal(ahead.behindSource, false);
  assert.equal(ahead.stale, false);
});

/**
 * The floor exists because of a real chart. Sampling Women's Doubles left one
 * band represented by a **single** player whose total was eight times the band
 * average — `sampleSize: 1` was displayed, and it still read as a chart.
 */
test("a band too thin to average gets no composition", () => {
  const rows: InsightRow[] = [];
  // Top 10: healthily sampled.
  for (let rank = 1; rank <= 10; rank++) {
    rows.push(sampledRow(rank, [["Best 8 Dbls", 1000]], 1000));
  }
  // 11-100: ninety players, one of whom survived sampling, and an outlier.
  rows.push(sampledRow(11, [["Best 8 Dbls", 8000]], 8000));
  for (let rank = 12; rank <= 100; rank++) rows.push(plainRow(rank, 100));

  const profiles = computeSampledBandProfiles(rows);
  const thin = profiles.find((p) => p.label === "11–100")!;

  // The count and the average are still facts and still reported.
  assert.equal(thin.playerCount, 90);
  assert.equal(thin.sampleSize, 1);
  // But nothing is drawn from one player.
  assert.deepEqual(thin.composition, []);
  // The healthy band keeps its bars; withholding the panel is the client's call.
  assert.ok(profiles.find((p) => p.label === "Top 10")!.composition.length > 0);
});

/**
 * The raw doubles column is only "printed but not scored" where the 25% sibling
 * exists. On the doubles lists there is no sibling — `Best 8 Dbls` IS the score.
 * Flagging it informational there zeroed the only domestic column on the sheet
 * and excluded two thirds of Women's Doubles from its own sample.
 */
test("on a doubles list the raw doubles column is the score", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    // A doubles-list shape: no 25% sibling anywhere.
    sampledRow(
      i + 1,
      [
        ["Best 8 Dbls", 10],
        ["WTA Points", 0],
      ],
      10
    )
  );
  const [band] = computeSampledBandProfiles(rows);
  const raw = band!.composition.find((s) => s.label === "Best 8 Dbls");
  assert.ok(raw, "the doubles column must survive as a slice");
  assert.notEqual(raw!.isInformational, true);
  assert.equal(raw!.average, 10);

  const scoring = band!.composition
    .filter((s) => !s.isInformational && !s.isDeduction)
    .reduce((sum, s) => sum + s.average, 0);
  assert.equal(scoring, band!.compositionTotal);
});
