/* eslint-disable @typescript-eslint/no-var-requires */
// Pure unit tests — no database, no HTTP. The projection is arithmetic over a
// series of published lists, and arithmetic that shapes what a parent believes
// about their child's season deserves to be pinned case by case.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  projectRanking,
  ROLLING_WINDOW_WEEKS,
} = require("../shared/services/ranking/rankingProjection");

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Mondays, like the real lists. The anchor date is arbitrary but fixed. */
const TODAY = new Date(Date.UTC(2026, 8, 7)).getTime();
const weeksAgo = (weeks: number) => new Date(TODAY - weeks * MS_PER_WEEK);

/** A weekly series, oldest first, from `[weeksAgo, rank, points]` triples. */
const series = (rows: Array<[number, number, number]>) =>
  rows.map(([weeks, rank, totalPoints]) => ({
    asOnDate: weeksAgo(weeks),
    rank,
    totalPoints,
  }));

/** 52 weeks of flat history, so a test can add only the weeks it cares about. */
const flatYear = (points: number, rank: number) =>
  Array.from({ length: ROLLING_WINDOW_WEEKS + 1 }, (_, index) => {
    const weeks = ROLLING_WINDOW_WEEKS - index;
    return { asOnDate: weeksAgo(weeks), rank, totalPoints: points };
  });

describe("what the weekly series can and cannot say", () => {
  it("returns nothing from a single list", () => {
    assert.equal(projectRanking({ history: series([[0, 100, 50]]) }), null);
  });

  it("reports a horizon it holds and withholds one it does not", () => {
    const projection = projectRanking({
      history: series([
        [12, 400, 80],
        [4, 350, 100],
        [0, 312, 120],
      ]),
    });

    assert.ok(projection);
    assert.equal(projection.movement.fourWeeks!.points, 20);
    assert.equal(projection.movement.twelveWeeks!.points, 40);
    // 400 -> 312 is 88 places gained, and the sign must read as an improvement
    // even though the number itself went down.
    assert.equal(projection.movement.twelveWeeks!.rank, 88);
    // The series starts 12 weeks ago, so a year is not ours to report.
    assert.equal(projection.movement.fiftyTwoWeeks, null);
    assert.equal(projection.window.coversFullCycle, false);
  });

  it("ignores a corrected re-upload of a week it already holds", () => {
    // Same as-on date twice: version 1 said 100, the correction says 130. Taking
    // both would invent a 30-point gain between a list and its own correction.
    const projection = projectRanking({
      history: [
        { asOnDate: weeksAgo(4), rank: 350, totalPoints: 90, version: 1 },
        { asOnDate: weeksAgo(0), rank: 312, totalPoints: 100, version: 1 },
        { asOnDate: weeksAgo(0), rank: 300, totalPoints: 130, version: 2 },
      ],
    });

    assert.ok(projection);
    assert.equal(projection.window.listsHeld, 2);
    assert.equal(projection.movement.fourWeeks!.points, 40);
  });
});

describe("activity, read as results entering the counted set", () => {
  it("counts rises and falls separately, and never treats a fall as a bad result", () => {
    const history = flatYear(100, 400);
    history[ROLLING_WINDOW_WEEKS - 10] = { asOnDate: weeksAgo(10), rank: 380, totalPoints: 140 };
    history[ROLLING_WINDOW_WEEKS - 9] = { asOnDate: weeksAgo(9), rank: 380, totalPoints: 140 };
    history[ROLLING_WINDOW_WEEKS - 8] = { asOnDate: weeksAgo(8), rank: 390, totalPoints: 125 };
    for (let weeks = 7; weeks >= 0; weeks -= 1) {
      history[ROLLING_WINDOW_WEEKS - weeks] = {
        asOnDate: weeksAgo(weeks),
        rank: 390,
        totalPoints: 125,
      };
    }

    const projection = projectRanking({ history });
    assert.ok(projection);
    assert.equal(projection.activity.improvingWeeks, 1);
    assert.equal(projection.activity.decliningWeeks, 1);
    assert.equal(projection.activity.pointsGained, 40);
    // Reported positive: it is a quantity lost, not a negative quantity.
    assert.equal(projection.activity.pointsLost, 15);
    assert.equal(projection.activity.averageRise, 40);
    assert.equal(projection.activity.weeksSinceLastRise, 10);
  });

  it("says when a new result last counted, even if it was before the window", () => {
    const history = [
      { asOnDate: weeksAgo(70), rank: 500, totalPoints: 40 },
      { asOnDate: weeksAgo(60), rank: 420, totalPoints: 90 },
      ...flatYear(90, 420),
    ];

    const projection = projectRanking({ history });
    assert.ok(projection);
    // Nothing has risen inside the rolling window...
    assert.equal(projection.activity.improvingWeeks, 0);
    assert.equal(projection.activity.pointsGained, 0);
    // ...but "when did they last gain" is a fact about the player, not about
    // our window, so it still answers.
    assert.equal(projection.activity.weeksSinceLastRise, 60);
  });
});

describe("points at risk as results age out", () => {
  it("counts only the gains about to leave the rolling window", () => {
    const history = flatYear(100, 300);
    // A gain 50 weeks ago: two weeks from ageing out, so inside a four-week
    // horizon. A gain 30 weeks ago: not due for another 22 weeks, so outside.
    for (let weeks = 50; weeks >= 0; weeks -= 1) {
      history[ROLLING_WINDOW_WEEKS - weeks] = {
        asOnDate: weeksAgo(weeks),
        rank: 300,
        totalPoints: weeks <= 30 ? 175 : 130,
      };
    }

    const projection = projectRanking({ history });
    assert.ok(projection);
    assert.ok(projection.atRisk);
    assert.equal(projection.atRisk.nextFourWeeks, 30);
    assert.equal(projection.atRisk.nextTwelveWeeks, 30);
    assert.equal(projection.atRisk.isComplete, true);
  });

  it("withholds the figure entirely when the history is shorter than a cycle", () => {
    const projection = projectRanking({
      history: series([
        [20, 400, 80],
        [10, 360, 110],
        [0, 340, 130],
      ]),
    });

    assert.ok(projection);
    // Not zero. A zero here would read as "nothing is due to expire", when what
    // we actually know is that we cannot see back far enough to tell.
    assert.equal(projection.atRisk, null);
  });
});

describe("what the next tier would take", () => {
  const benchmarks = [
    { rank: 10, points: 600 },
    { rank: 100, points: 300 },
    { rank: 250, points: 160 },
    { rank: 500, points: 90 },
  ];

  it("picks the next rung up and extends the observed rate", () => {
    const history = flatYear(100, 300);
    // +60 over the year: 20 points in each of three improving weeks.
    for (const [weeks, points] of [
      [40, 120],
      [20, 140],
      [5, 160],
    ] as const) {
      for (let w = weeks; w >= 0; w -= 1) {
        const existing = history[ROLLING_WINDOW_WEEKS - w]!;
        history[ROLLING_WINDOW_WEEKS - w] = { ...existing, totalPoints: points };
      }
    }
    history[ROLLING_WINDOW_WEEKS] = { asOnDate: weeksAgo(0), rank: 300, totalPoints: 160 };

    const projection = projectRanking({ history, benchmarks });
    assert.ok(projection);
    assert.equal(projection.toNextTier!.rank, 100);
    assert.equal(projection.toNextTier!.gap, 140);
    // 60 points over 52 weeks is ~1.15/week, so ~122 weeks — past the ceiling,
    // which is reported as "not at this rate" rather than a two-year number.
    assert.equal(projection.toNextTier!.estimatedWeeks, null);
    assert.equal(projection.toNextTier!.weeklyRate, 1.15);
  });

  it("gives no estimate to a player who has gained nothing", () => {
    const projection = projectRanking({ history: flatYear(160, 300), benchmarks });
    assert.ok(projection);
    assert.equal(projection.toNextTier!.gap, 140);
    // No rate to extend. Dividing by zero weeks of progress would produce
    // Infinity; reporting it as null is the same fact, said honestly.
    assert.equal(projection.toNextTier!.estimatedWeeks, null);
    assert.equal(projection.toNextTier!.weeklyRate, 0);
  });

  it("has nothing to chase at the top of the list", () => {
    const projection = projectRanking({
      history: series([
        [4, 3, 800],
        [0, 2, 850],
      ]),
      benchmarks,
    });
    assert.ok(projection);
    assert.equal(projection.toNextTier, null);
  });
});
