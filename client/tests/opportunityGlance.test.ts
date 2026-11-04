import { describe, expect, it } from "vitest";

import {
  glanceRows,
  hasFollowableDates,
  primaryAction,
} from "@/modules/opportunities/utils/atAGlance";

const rolling = {
  benefit: { summary: "Fee waiver of 90% to 100%.", amount: undefined },
  eligibility: { ageNote: "Students in grades 7-12" },
  cycle: undefined,
  cycleState: "rolling" as const,
  selection: "apply" as const,
};

const value = (rows: ReturnType<typeof glanceRows>, label: string) =>
  rows.find((row) => row.label === label)?.value;

describe("glanceRows", () => {
  it("answers what, who, when and how, from the entry's own fields", () => {
    const rows = glanceRows(rolling);
    expect(value(rows, "You get")).toBe("Fee waiver of 90% to 100%.");
    expect(value(rows, "Who can apply")).toBe("Students in grades 7-12");
    expect(value(rows, "How you are chosen")).toMatch(/You apply/);
  });

  it("says there is no deadline rather than leaving the row out or inventing one", () => {
    expect(value(glanceRows(rolling), "When")).toMatch(/No deadline listed/);
  });

  it("states a window that exists", () => {
    const rows = glanceRows({
      ...rolling,
      cycle: { closesOn: "2026-12-01" },
      cycleState: "open",
    });
    expect(value(rows, "When")).toBe("Open now, closes 1 Dec 2026");
  });

  it("adds the amount to what you get, and omits the row when nothing is known", () => {
    const withAmount = glanceRows({
      ...rolling,
      benefit: {
        summary: "Yearly support.",
        amount: { value: 500000, currency: "INR", period: "year" },
      },
    });
    expect(value(withAmount, "You get")).toMatch(/Yearly support\. .*5,00,000 a year/);
    expect(value(glanceRows({ ...rolling, benefit: undefined }), "You get")).toBeUndefined();
  });

  it("puts the editor's one line first, ahead of the age rule", () => {
    const rows = glanceRows({
      ...rolling,
      eligibility: { summary: "Aspiring footballers of any age", ageMin: 8, ageMax: 14 },
    });
    expect(value(rows, "Who can apply")).toBe("Aspiring footballers of any age");
  });

  it("shows a cost only when the entry states one, and never reads a missing cost as free", () => {
    expect(value(glanceRows(rolling), "Cost")).toBeUndefined();
    const free = glanceRows({ ...rolling, cost: { kind: "free", note: "Girls play free" } });
    expect(value(free, "Cost")).toBe("Free. Girls play free");
    const fee = glanceRows({
      ...rolling,
      cost: { kind: "fee", amount: 125, currency: "INR", note: "City round" },
    });
    expect(value(fee, "Cost")).toBe("₹125. City round");
  });

  it("sends the parent to the rules when no age or gender rule is stated", () => {
    expect(value(glanceRows({ ...rolling, eligibility: undefined }), "Who can apply")).toBe(
      "See the rules below"
    );
  });

  it("leaves out how you are chosen when the entry does not say", () => {
    expect(
      value(glanceRows({ ...rolling, selection: undefined }), "How you are chosen")
    ).toBeUndefined();
  });
});

describe("primaryAction", () => {
  const sources = [{ label: "Official page", url: "https://example.org/rules" }];

  it("goes to the application when there is one to apply to", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "open",
        selection: "apply",
        sources,
      })
    ).toEqual({ href: "https://example.org/apply", label: "Go to the official application" });
  });

  it("falls back to the first source when there is no application link", () => {
    expect(primaryAction({ cycleState: "rolling", selection: "apply", sources })).toEqual({
      href: "https://example.org/rules",
      label: "Open the official page",
    });
  });

  it("does not send a parent to apply once the window has closed", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "closed",
        selection: "apply",
        sources,
      })?.label
    ).toBe("Open the official page");
  });

  it("does not call a nominated or scouted route an application", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "open",
        selection: "nominated",
        sources,
      })?.label
    ).toBe("Open the official page");
  });

  it("offers nothing when there is no link at all", () => {
    expect(primaryAction({ cycleState: "rolling", selection: "apply", sources: [] })).toBeNull();
  });
});

describe("hasFollowableDates", () => {
  it("is true only when the window has a date an alert could be about", () => {
    expect(hasFollowableDates({ cycle: undefined })).toBe(false);
    expect(hasFollowableDates({ cycle: { keyDates: [] } })).toBe(false);
    expect(hasFollowableDates({ cycle: { opensOn: "2026-11-01" } })).toBe(true);
    expect(hasFollowableDates({ cycle: { closesOn: "2026-12-01" } })).toBe(true);
  });
});
