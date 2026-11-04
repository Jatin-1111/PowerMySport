// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeasonOutlook } from "@/modules/rankings/components/SeasonOutlook";
import type { RankingProjection } from "@/modules/rankings/services/api";

/**
 * The maths behind this panel is tested on the server. What is tested here is
 * the thing only the rendered copy can get wrong: whether a bounded number is
 * presented as a certainty.
 *
 * Two of the figures are not facts about the future. "Points at risk" is the
 * MOST that ageing results can cost, because each one that drops off is
 * replaced by the next best result we cannot see; and the time to the next level
 * extends a rate the player has already achieved rather than predicting one.
 * A future edit that tightens this copy into "will drop" or "will reach" would
 * pass every other test in this repo, so it is pinned here.
 */

const projection = (overrides: Partial<RankingProjection> = {}): RankingProjection => ({
  window: {
    from: "2025-09-08T00:00:00.000Z",
    to: "2026-09-07T00:00:00.000Z",
    listsHeld: 48,
    weeksCovered: 52,
    coversFullCycle: true,
  },
  movement: {
    fourWeeks: { points: 12, rank: 8, from: "2026-08-10T00:00:00.000Z" },
    twelveWeeks: { points: -6, rank: -14, from: "2026-06-15T00:00:00.000Z" },
    fiftyTwoWeeks: { points: 40, rank: 60, from: "2025-09-08T00:00:00.000Z" },
  },
  activity: {
    improvingWeeks: 4,
    decliningWeeks: 3,
    pointsGained: 60,
    pointsLost: 20,
    averageRise: 15,
    lastRiseAt: "2026-08-10T00:00:00.000Z",
    weeksSinceLastRise: 4,
  },
  atRisk: { nextFourWeeks: 15, nextTwelveWeeks: 40, isComplete: true },
  toNextTier: { rank: 100, points: 300, gap: 152, estimatedWeeks: 30, weeklyRate: 5.2 },
  ...overrides,
});

describe("the outlook panel", () => {
  it("states points at risk as a ceiling, never as a forecast", () => {
    render(<SeasonOutlook projection={projection()} listLabel="Boys 14 & Under" />);

    expect(screen.getByText(/Up to 40 points could drop off/i)).toBeTruthy();
    expect(screen.getByText(/This is the most it can cost, not a forecast/i)).toBeTruthy();
    // The failure mode this guards: copy that promises the fall will happen.
    expect(document.body.textContent).not.toMatch(/will drop off|will fall|will lose/i);
  });

  it("puts 'at the rate they have gained' on the estimate itself", () => {
    render(<SeasonOutlook projection={projection()} listLabel="Boys 14 & Under" />);

    expect(
      screen.getByText(/At the rate they have gained points over the past year/i)
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/will reach|guaranteed|on track to/i);
  });

  it("says there is no rate to work from rather than inventing one", () => {
    render(
      <SeasonOutlook
        projection={projection({
          activity: {
            improvingWeeks: 0,
            decliningWeeks: 6,
            pointsGained: 0,
            pointsLost: 45,
            averageRise: 0,
            lastRiseAt: "2025-10-06T00:00:00.000Z",
            weeksSinceLastRise: 48,
          },
          toNextTier: { rank: 100, points: 300, gap: 152, estimatedWeeks: null, weeklyRate: 0 },
        })}
        listLabel="Boys 14 & Under"
      />
    );

    expect(screen.getByText(/no rate here to work from/i)).toBeTruthy();
  });

  it("admits when the history is shorter than a scoring cycle", () => {
    render(
      <SeasonOutlook
        projection={projection({
          window: {
            from: "2026-06-01T00:00:00.000Z",
            to: "2026-09-07T00:00:00.000Z",
            listsHeld: 14,
            weeksCovered: 14,
            coversFullCycle: false,
          },
          movement: {
            fourWeeks: { points: 12, rank: 8, from: "2026-08-10T00:00:00.000Z" },
            twelveWeeks: { points: 30, rank: 40, from: "2026-06-15T00:00:00.000Z" },
            fiftyTwoWeeks: null,
          },
          atRisk: null,
        })}
        listLabel="Boys 14 & Under"
      />
    );

    expect(screen.getByText(/less than a full 52-week scoring cycle/i)).toBeTruthy();
    // A horizon we cannot see must be absent, not rendered as "no change".
    expect(screen.queryByText("Last 12 months")).toBeNull();
    // And with no full cycle there is no at-risk figure to show at all.
    expect(document.body.textContent).not.toMatch(/could drop off/i);
  });

  it("writes every movement with a direction in words, not only a sign", () => {
    render(<SeasonOutlook projection={projection()} listLabel="Boys 14 & Under" />);

    expect(screen.getByText(/up 12 points, up 8 places/i)).toBeTruthy();
    // A negative twelve-week change reads as "down", not as "-6".
    expect(screen.getByText(/down 6 points, down 14 places/i)).toBeTruthy();
  });
});
