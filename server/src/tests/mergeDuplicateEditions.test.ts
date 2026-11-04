import assert from "node:assert/strict";
import test from "node:test";
import { isSameEvent } from "../migrations/41_merge_duplicate_tournament_editions";

/**
 * The matcher behind migration 41, which decides whether two tournament rows
 * describe the same real event and therefore whether one page gets permanently
 * redirected into the other.
 *
 * A false positive here sends a real tournament's URL to a different
 * tournament, so the negative cases below matter more than the positive ones.
 * Every name in this file is taken verbatim from production data — an earlier
 * version of the matcher proposed each of the "different events" pairs as a
 * merge, which is why they are pinned.
 */

test("merges the long and short spellings of one event", () => {
  assert.ok(
    isSameEvent(
      "1st KCA International FIDE Rating Open Chess Tournament (Odisha)",
      "1st KCA International Open (Odisha)"
    )
  );
  assert.ok(
    isSameEvent(
      "10th CHESSMII INTERNATIONAL OPEN FIDE RATED CHESS TOURNAMENT",
      "10th Chessmii International Open Kerala"
    )
  );
  assert.ok(
    isSameEvent(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Madurai)",
      "Athens of the East 6th International Grandmaster Chess Tournaments (Madurai)"
    )
  );
});

test("merges an AITA-prefixed row with its unprefixed twin", () => {
  assert.ok(isSameEvent("AITA ITF Juniors (Chennai)", "ITF Juniors (Chennai)"));
});

test("merges the two spellings of one category", () => {
  assert.ok(
    isSameEvent(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Category - D Below 1800)",
      "Athens of the East 6th International Grandmaster Open Cat D Below 1800 Madurai"
    )
  );
  assert.ok(
    isSameEvent(
      "22nd Delhi International Open Grandmasters Chess Tournament - 2027 (Category 'B')",
      "22nd Delhi International Open Grandmasters Cat B Delhi"
    )
  );
});

test("keeps different categories of the same festival apart", () => {
  assert.ok(
    !isSameEvent(
      "Athens of the East 6th International Grandmaster Open Cat A Above 2100 Madurai",
      "Athens of the East 6th International Grandmaster Open Cat B Below 2100 Madurai"
    )
  );
  assert.ok(
    !isSameEvent(
      "22nd Delhi International Open Grandmasters Chess Tournament - 2027 (Category 'A')",
      "22nd Delhi International Open Grandmasters Chess Tournament - 2027 (Category 'B')"
    )
  );
});

test("does not swallow a category into the umbrella listing", () => {
  // The bug the first version of this matcher shipped with: treating "chess"
  // and "tournament" as noise made the umbrella a subset of the category.
  assert.ok(
    !isSameEvent(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Madurai)",
      "Athens of the East 6th International Grandmaster Open Cat D Below 1800 Madurai"
    )
  );
});

test("keeps different formats of the same festival apart", () => {
  assert.ok(
    !isSameEvent(
      "13th BBCF International FIDE Rapid Rated Chess Tournament (Tamil Nadu)",
      "14th BBCF International FIDE Blitz Rated Chess Tournament (Tamil Nadu)"
    )
  );
  assert.ok(!isSameEvent("Pune Grand Slam Blitz Pune", "Pune Grand Slam Rapid Pune"));
});

test("keeps different divisions apart", () => {
  assert.ok(
    !isSameEvent(
      "360 One Junior Masters Chess Tournament-CATEGORY-C",
      "360 ONE MASTERS CHESS TOURNAMENT-CATEGORY A"
    )
  );
  assert.ok(
    !isSameEvent(
      "Second Chola Chess International GM Norm Round Robin Tournament (Chennai)",
      "First Chola Chess International IM Norm Round Robin Tournament (Chennai)"
    )
  );
  assert.ok(
    !isSameEvent(
      "National Under 13 Girls Chess Championship 2026",
      "National Under 13 Chess Championship 2026"
    )
  );
});

test("keeps different age groups apart", () => {
  assert.ok(
    !isSameEvent(
      "AITA Yonex-Sunrise All India Sub Junior Ranking Badminton Tournament (U-13 years)",
      "AITA Yonex-Sunrise All India Sub Junior Ranking Badminton Tournament (U-15 & U-17)"
    )
  );
});

test("a name with nothing left after noise never matches", () => {
  assert.ok(!isSameEvent("Chess Tournament", "FIDE Rated Chess Tournament"));
});

test("the edition year does not distinguish two rows on the same date", () => {
  assert.ok(
    isSameEvent(
      "PICA's All India Open Below 1800 FIDE Rating Chess Tournament 2026",
      "PICA's All India Open Below 1800 Hyderabad",
      2026
    )
  );
  // Without the year in hand the same pair stays unmatched, which is why the
  // caller passes the bucket's year rather than stripping any 4-digit number.
  assert.ok(
    !isSameEvent(
      "PICA's All India Open Below 1800 FIDE Rating Chess Tournament 2026",
      "PICA's All India Open Below 1800 Hyderabad"
    )
  );
});

test("a rating band is never mistaken for a year", () => {
  // 2000 here is a rating ceiling, not an edition year, and the two categories
  // must stay apart even when the bucket year is passed in.
  assert.ok(
    !isSameEvent(
      "1st Akshaya International Grandmaster Open Cat A Above 2000 Coimbatore",
      "1st Akshaya International Grandmaster Open Cat B Below 2000 Coimbatore",
      2027
    )
  );
});
