import { describe, expect, it } from "vitest";

import type { PathwayGuide, PathwayStage } from "../services/pathway";
import { isUnavailableHref, withoutUnavailableLinks } from "./availableActions";

const stage = (overrides: Partial<PathwayStage>): PathwayStage => ({
  key: "s1",
  order: 1,
  name: "Stage",
  ageRange: "6-8",
  coreQuestion: "q",
  overview: "o",
  questions: [],
  signals: [],
  decisions: [],
  nextSteps: [],
  helpLinks: [],
  ...overrides,
});

const guide = (stages: PathwayStage[]): PathwayGuide => ({
  sportSlug: "tennis",
  sportName: "Tennis",
  formatVersion: 1,
  intro: {},
  sportIntro: [],
  reviewedOn: null,
  contributor: null,
  stages,
});

describe("isUnavailableHref", () => {
  it("flags the academy finder, coach finder and shop", () => {
    expect(isUnavailableHref("/booking?tab=academies")).toBe(true);
    expect(isUnavailableHref("/booking?tab=coaches")).toBe(true);
    expect(isUnavailableHref("/booking?city=pune&tab=coaches")).toBe(true);
    expect(isUnavailableHref("/shop")).toBe(true);
    expect(isUnavailableHref("/shop/rackets")).toBe(true);
  });

  it("leaves working destinations alone", () => {
    expect(isUnavailableHref("/booking?tab=experts")).toBe(false);
    expect(isUnavailableHref("/guidance")).toBe(false);
    expect(isUnavailableHref("/shopping-guide")).toBe(false);
    expect(isUnavailableHref(undefined)).toBe(false);
  });
});

describe("withoutUnavailableLinks", () => {
  it("drops dead help chips and keeps the working ones", () => {
    const result = withoutUnavailableLinks(
      guide([
        stage({
          helpLinks: [
            { label: "Find academy", href: "/booking?tab=academies" },
            { label: "Find coach", href: "/booking?tab=coaches" },
            { label: "Book expert", href: "/booking?tab=experts" },
            { label: "Equipment", href: "/shop" },
            { label: "Assessment", href: "/guidance" },
          ],
        }),
      ])
    );
    expect(result.stages[0]?.helpLinks.map((l) => l.label)).toEqual(["Book expert", "Assessment"]);
  });

  it("removes a primary action that points at a dead page, and keeps a live one", () => {
    const result = withoutUnavailableLinks(
      guide([
        stage({ primaryAction: { label: "Find trial sessions", href: "/booking?tab=academies" } }),
        stage({
          key: "s2",
          primaryAction: { label: "Start a review", href: "/booking?tab=experts" },
        }),
      ])
    );
    expect(result.stages[0]?.primaryAction).toBeUndefined();
    expect(result.stages[1]?.primaryAction?.label).toBe("Start a review");
  });
});
