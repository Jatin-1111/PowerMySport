import { describe, expect, it } from "vitest";
import { buildShortlist } from "@powermysport/shared-types";

import {
  buildCalendar,
  MAX_WEEKS,
  MIN_WEEKS,
  startOfWeek,
} from "@/modules/planner/utils/calendarLayout";
import { buildCalendarItems, type CalendarItem } from "@/modules/planner/utils/calendarItems";

/**
 * The calendar is only useful if an event is on the day it is really on, so these
 * pin the cases a screenshot would miss: an event crossing a week or a month, two
 * that overlap, a blocked range that runs over a weekend, a deadline on a day the
 * page is not looking at. Dates are written as plain calendar dates and read in UTC,
 * which is how the calendar stores them, so the result does not depend on where the
 * test runs.
 */

const DAY = 86_400_000;
// Monday 5 October 2026, a Monday, so "this week" starts on the day we say it does.
const TODAY = "2026-10-05";
const base = Date.UTC(2026, 9, 5);
const at = (offset: number): string => new Date(base + offset * DAY).toISOString();

const item = (
  slug: string,
  start: number,
  end: number | undefined,
  over: Partial<CalendarItem> = {}
): CalendarItem => ({
  slug,
  name: `Event ${slug}`,
  startDate: at(start),
  endDate: end === undefined ? undefined : at(end),
  kind: "planned",
  edition: { slug, name: `Event ${slug}`, startDate: at(start) },
  clashes: [],
  hasOverlap: false,
  ...over,
});

const layout = (
  items: CalendarItem[],
  blocked: Array<{ from: string; to: string; label?: string }> = [],
  extra = {}
) => buildCalendar({ items, blocked, today: TODAY, ...extra });

describe("weeks", () => {
  it("starts weeks on Monday", () => {
    const monday = Date.UTC(2026, 9, 5) / DAY;
    expect(startOfWeek(monday)).toBe(monday);
    expect(startOfWeek(monday + 6)).toBe(monday); // the Sunday
    expect(startOfWeek(monday + 7)).toBe(monday + 7);
    // 1 January 1970 was a Thursday, and its week began on Monday 29 December 1969.
    expect(startOfWeek(0)).toBe(-3);
  });

  it("opens on the Monday of this week and draws a quarter by default", () => {
    const { weeks } = layout([]);
    expect(weeks).toHaveLength(MIN_WEEKS);
    expect(weeks[0]!.days[0]!.iso).toBe("2026-10-05");
    expect(weeks[0]!.days[6]!.iso).toBe("2026-10-11");
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(weeks[1]!.days[0]!.iso).toBe("2026-10-12");
  });

  it("opens on the Monday before when today is mid-week", () => {
    const { weeks } = buildCalendar({ items: [], blocked: [], today: "2026-10-08" });
    expect(weeks[0]!.days[0]!.iso).toBe("2026-10-05");
  });

  it("marks today and the days gone, and labels a month where it starts", () => {
    const { weeks } = buildCalendar({ items: [], blocked: [], today: "2026-10-08" });
    const first = weeks[0]!.days;
    expect(first.map((day) => day.isPast)).toEqual([true, true, true, false, false, false, false]);
    expect(first[3]!.isToday).toBe(true);
    expect(first.filter((day) => day.isToday)).toHaveLength(1);
    // The grid's first cell is labelled so the page opens knowing the month.
    expect(first[0]!.monthLabel).toBe("Oct");
    expect(first[1]!.monthLabel).toBeNull();
    const nov1 = weeks.flatMap((week) => week.days).find((day) => day.iso === "2026-11-01");
    expect(nov1!.monthLabel).toBe("Nov");
  });

  it("names each week for someone who cannot see the grid", () => {
    expect(layout([]).weeks[0]!.label).toBe("Week of 5 Oct");
  });
});

describe("bars", () => {
  it("draws an event inside one week across the days it covers", () => {
    // Wednesday to Friday of this week.
    const { weeks } = layout([item("a", 2, 4)]);
    expect(weeks[0]!.bars).toEqual([
      expect.objectContaining({
        startCol: 3,
        endCol: 5,
        lane: 0,
        continuesBefore: false,
        continuesAfter: false,
      }),
    ]);
    expect(weeks[1]!.bars).toEqual([]);
  });

  it("is one day wide when the calendar gives no end date, or an end before the start", () => {
    expect(layout([item("a", 2, undefined)]).weeks[0]!.bars[0]).toMatchObject({
      startCol: 3,
      endCol: 3,
    });
    expect(layout([item("a", 2, 0)]).weeks[0]!.bars[0]).toMatchObject({ startCol: 3, endCol: 3 });
  });

  it("splits an event that crosses a week, and says where it continues", () => {
    // Saturday 10 Oct to Tuesday 13 Oct.
    const { weeks } = layout([item("a", 5, 8)]);
    expect(weeks[0]!.bars[0]).toMatchObject({
      startCol: 6,
      endCol: 7,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(weeks[1]!.bars[0]).toMatchObject({
      startCol: 1,
      endCol: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("carries an event across three weeks with a full middle week", () => {
    const { weeks } = layout([item("a", 5, 17)]);
    expect(weeks[1]!.bars[0]).toMatchObject({
      startCol: 1,
      endCol: 7,
      continuesBefore: true,
      continuesAfter: true,
    });
    expect(weeks[2]!.bars[0]).toMatchObject({ continuesBefore: true, continuesAfter: false });
  });

  it("puts events that overlap in different lanes, and ones that do not in the same lane", () => {
    const { weeks } = layout([item("a", 0, 3), item("b", 2, 5), item("c", 5, 6)]);
    const lane = Object.fromEntries(weeks[0]!.bars.map((bar) => [bar.item.slug, bar.lane]));
    expect(lane.a).toBe(0);
    expect(lane.b).toBe(1);
    // c starts after a has ended, so it takes the free top lane back.
    expect(lane.c).toBe(0);
    expect(weeks[0]!.laneCount).toBe(2);
  });

  it("gives the longer of two events starting together the top lane", () => {
    const { weeks } = layout([item("short", 0, 1), item("long", 0, 5)]);
    const lane = Object.fromEntries(weeks[0]!.bars.map((bar) => [bar.item.slug, bar.lane]));
    expect(lane.long).toBe(0);
    expect(lane.short).toBe(1);
  });

  it("keeps an event that began last week and is still running, and drops one that is over", () => {
    const { weeks } = layout([item("running", -3, 2), item("over", -10, -6)]);
    expect(weeks[0]!.bars).toHaveLength(1);
    expect(weeks[0]!.bars[0]).toMatchObject({ startCol: 1, endCol: 3, continuesBefore: true });
  });

  it("reads a date as the UTC calendar date it was stored as", () => {
    // Midnight UTC is still the previous day in Los Angeles. The calendar date the
    // federation printed is the 7th everywhere.
    const { weeks } = layout([
      {
        ...item("a", 0, 0),
        startDate: "2026-10-07T00:00:00.000Z",
        endDate: "2026-10-07T00:00:00.000Z",
      },
    ]);
    expect(weeks[0]!.bars[0]).toMatchObject({ startCol: 3, endCol: 3 });
  });
});

describe("how far the calendar reaches", () => {
  it("extends to cover an event beyond the quarter", () => {
    const { weeks } = layout([item("far", 100, 103)]);
    expect(weeks.length).toBeGreaterThan(MIN_WEEKS);
    expect(weeks.flatMap((week) => week.bars).some((bar) => bar.item.slug === "far")).toBe(true);
  });

  it("does not stretch the page for an event beyond the cap, and says how many are further out", () => {
    // A calendar entry typed with the wrong year must not add 30 empty rows.
    const { weeks, later } = layout([item("typo", 2000, 2003), item("typo2", 3000, 3001)]);
    expect(weeks).toHaveLength(MIN_WEEKS);
    expect(later).toBe(2);
  });

  it("clips an event that starts inside the cap and runs past it", () => {
    const { weeks, later } = layout([item("long", 100, 2000)]);
    expect(weeks).toHaveLength(MAX_WEEKS);
    expect(later).toBe(0);
    expect(weeks[MAX_WEEKS - 1]!.bars[0]).toMatchObject({ continuesAfter: true });
  });
});

describe("blocked dates", () => {
  it("shades the days of a range, across a weekend and a month", () => {
    const { weeks } = layout([], [{ from: "2026-10-30", to: "2026-11-03", label: "Exams" }]);
    const days = weeks.flatMap((week) => week.days);
    const shaded = days.filter((day) => day.blocked).map((day) => day.iso);
    expect(shaded).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("writes the note on the first day and again at the start of each week it runs through", () => {
    const { weeks } = layout([], [{ from: "2026-10-07", to: "2026-10-14", label: "Exams" }]);
    const labelled = weeks
      .flatMap((week) => week.days)
      .filter((day) => day.blocked?.showLabel)
      .map((day) => day.iso);
    expect(labelled).toEqual(["2026-10-07", "2026-10-12"]);
  });

  it("shades nothing when nothing is blocked", () => {
    expect(
      layout([])
        .weeks.flatMap((week) => week.days)
        .some((day) => day.blocked)
    ).toBe(false);
  });
});

describe("entry deadlines", () => {
  const withDeadline = (offset: number, over: Partial<CalendarItem> = {}) =>
    item("a", 20, 23, {
      edition: {
        slug: "a",
        name: "Event a",
        startDate: at(20),
        registrationDeadlineDate: at(offset),
      },
      ...over,
    });
  const flagged = (items: CalendarItem[]) =>
    layout(items)
      .weeks.flatMap((week) => week.days)
      .filter((day) => day.deadlines.length > 0)
      .map((day) => day.iso);

  it("flags the day entries close, for a planned or a suggested event", () => {
    expect(flagged([withDeadline(9)])).toEqual(["2026-10-14"]);
    expect(flagged([withDeadline(9, { kind: "suggested" })])).toEqual(["2026-10-14"]);
  });

  it("keeps the flag on today, which is the last day to enter", () => {
    expect(flagged([withDeadline(0)])).toEqual(["2026-10-05"]);
  });

  it("does not flag a deadline already gone, a played event, or an event only on offer", () => {
    expect(flagged([withDeadline(-3)])).toEqual([]);
    expect(flagged([withDeadline(9, { status: "played" })])).toEqual([]);
    expect(flagged([withDeadline(9, { kind: "available" })])).toEqual([]);
  });

  it("has no flag for an event whose deadline was never published", () => {
    expect(flagged([item("a", 20, 23)])).toEqual([]);
  });
});

// ─── Which events are drawn, and their state ──────────────────────────────────

const edition = (slug: string, start: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: `Event ${slug}`,
  startDate: at(start),
  endDate: at(start + 3),
  city: "Sonipat",
  state: "Haryana",
  ageGroups: ["Under-14"],
  ladder: "Championship Series",
  grade: 7,
  kind: "junior-ladder",
  ...over,
});

const shortlistOf = (editions: ReturnType<typeof edition>[]) =>
  buildShortlist(editions, { bracket: "U-14", rank: 312 });

const entry = (
  slug: string,
  start: number,
  status: "shortlisted" | "entered" | "played" = "shortlisted"
) => ({
  editionSlug: slug,
  name: `Event ${slug}`,
  startDate: at(start),
  status,
  addedAt: at(0),
});

const build = (over: Partial<Parameters<typeof buildCalendarItems>[0]> = {}) =>
  buildCalendarItems({
    shortlist: shortlistOf([edition("a", 10), edition("b", 20), edition("c", 30)]),
    planEntries: [],
    suggestions: [],
    showAvailable: false,
    ...over,
  });

const kinds = (items: CalendarItem[]) => Object.fromEntries(items.map((i) => [i.slug, i.kind]));

describe("which events are drawn", () => {
  it("draws only the plan and the suggestions until asked for the rest", () => {
    const items = build({
      planEntries: [entry("a", 10)],
      suggestions: [{ slug: "b", tier: "recommended", reason: "Because." }],
    });
    expect(kinds(items)).toEqual({ a: "planned", b: "suggested" });
  });

  it("draws everything the child can enter when asked", () => {
    expect(kinds(build({ showAvailable: true }))).toEqual({
      a: "available",
      b: "available",
      c: "available",
    });
  });

  it("lets a decision outrank advice: an event both planned and suggested is planned", () => {
    const items = build({
      planEntries: [entry("a", 10)],
      suggestions: [{ slug: "a", tier: "recommended", reason: "Because." }],
    });
    expect(kinds(items)).toEqual({ a: "planned" });
  });

  it("carries the reason and tier on a suggestion, and the status on a planned event", () => {
    const items = build({
      planEntries: [entry("a", 10, "entered")],
      suggestions: [{ slug: "b", tier: "consider", reason: "Next up." }],
    });
    expect(items.find((i) => i.slug === "a")!.status).toBe("entered");
    const suggested = items.find((i) => i.slug === "b")!;
    expect([suggested.tier, suggested.reason]).toEqual(["consider", "Next up."]);
  });

  it("keeps the event the parent has open on screen whatever the toggle says", () => {
    expect(kinds(build({ selectedSlug: "c" }))).toEqual({ c: "available" });
  });

  it("never draws an event the child cannot enter or would be playing up in", () => {
    const items = build({
      shortlist: shortlistOf([
        edition("own", 10),
        edition("up", 12, { ageGroups: ["Under-16"] }),
        edition("shut", 14, { ladder: "Talent Series" }),
      ]),
      showAvailable: true,
    });
    // Rank 312 may enter Talent Series, so build one the rules do close.
    const closed = buildCalendarItems({
      shortlist: buildShortlist([edition("shut", 14, { ladder: "Talent Series" })], {
        bracket: "U-14",
        rank: 40,
      }),
      planEntries: [],
      suggestions: [],
      showAvailable: true,
    });
    expect(Object.keys(kinds(items))).toEqual(["own", "shut"]);
    expect(closed).toEqual([]);
  });

  it("still draws a planned event the live calendar no longer holds, with what the plan kept", () => {
    const items = build({ planEntries: [entry("gone", 40, "played")] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      slug: "gone",
      kind: "planned",
      status: "played",
      verdict: undefined,
    });
    expect(items[0]!.edition).toMatchObject({ slug: "gone", name: "Event gone" });
  });

  it("is in date order", () => {
    const items = build({ planEntries: [entry("c", 30), entry("a", 10)], showAvailable: true });
    expect(items.map((i) => i.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("clashes on the plan", () => {
  const plan = (specs: Array<[string, number, number?]>) =>
    buildCalendarItems({
      shortlist: shortlistOf(specs.map(([slug, start]) => edition(slug, start))),
      planEntries: specs.map(([slug, start, status]) =>
        entry(slug, start, status === undefined ? "shortlisted" : "shortlisted")
      ),
      suggestions: [],
      showAvailable: false,
    });

  it("marks both events of an overlap, and tells each about the other", () => {
    const items = plan([
      ["a", 10],
      ["b", 12],
    ]);
    expect(items.every((i) => i.hasOverlap)).toBe(true);
    expect(items.find((i) => i.slug === "a")!.clashes).toContain("Overlaps with Event b.");
    expect(items.find((i) => i.slug === "b")!.clashes).toContain("Overlaps with Event a.");
  });

  it("finds an overlap that is not between neighbours", () => {
    // a runs 10 to 13; b sits inside it, c starts on its last day.
    const items = buildCalendarItems({
      shortlist: shortlistOf([
        edition("a", 10, { endDate: at(20) }),
        edition("b", 12),
        edition("c", 25),
      ]),
      planEntries: [entry("a", 10), entry("b", 12), entry("c", 25)],
      suggestions: [],
      showAvailable: false,
    });
    expect(items.find((i) => i.slug === "a")!.hasOverlap).toBe(true);
    expect(items.find((i) => i.slug === "c")!.hasOverlap).toBe(false);
  });

  it("warns about a tight gap against the later event, but does not call it an overlap", () => {
    // a ends day 13; b starts day 14: no clear day between.
    const items = plan([
      ["a", 10],
      ["b", 14],
    ]);
    expect(items.every((i) => !i.hasOverlap)).toBe(true);
    expect(items.find((i) => i.slug === "b")!.clashes[0]).toMatch(
      /Starts the day after Event a ends/
    );
    expect(items.find((i) => i.slug === "a")!.clashes).toEqual([]);
  });

  it("has nothing to say when there is room", () => {
    const items = plan([
      ["a", 10],
      ["b", 20],
    ]);
    expect(items.every((i) => i.clashes.length === 0 && !i.hasOverlap)).toBe(true);
  });

  it("ignores an event already played, which is history and not a clash", () => {
    const items = buildCalendarItems({
      shortlist: shortlistOf([edition("a", 10), edition("b", 12)]),
      planEntries: [entry("a", 10, "played"), entry("b", 12)],
      suggestions: [],
      showAvailable: false,
    });
    expect(items.every((i) => !i.hasOverlap)).toBe(true);
  });

  it("does not make a suggestion part of a clash: only the plan can clash with itself", () => {
    const items = build({
      planEntries: [entry("a", 10)],
      suggestions: [{ slug: "b", tier: "recommended", reason: "x" }],
      shortlist: shortlistOf([edition("a", 10), edition("b", 12)]),
    });
    expect(items.every((i) => !i.hasOverlap)).toBe(true);
  });
});

describe("a single month", () => {
  const october = { from: "2026-10-01", to: "2026-10-31" };
  const november = { from: "2026-11-01", to: "2026-11-30" };
  const month = (
    items: CalendarItem[],
    range: { from: string; to: string },
    blocked: Array<{ from: string; to: string; label?: string }> = []
  ) => buildCalendar({ items, blocked, today: TODAY, range });

  it("draws exactly the weeks that hold the month, Monday to Sunday", () => {
    const oct = month([], october).weeks;
    // 1 Oct 2026 is a Thursday and 31 Oct a Saturday: 28 Sep to 1 Nov, five weeks.
    expect(oct.map((week) => week.key)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    // 1 Nov is a Sunday and 30 Nov a Monday: 26 Oct to 6 Dec, six weeks.
    expect(month([], november).weeks).toHaveLength(6);
  });

  it("marks the days of the weeks drawn that belong to another month", () => {
    const weeks = month([], october).weeks;
    expect(weeks[0]!.days.map((day) => day.outside)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(weeks[4]!.days.map((day) => day.outside)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(weeks.slice(1, 4).every((week) => week.days.every((day) => !day.outside))).toBe(true);
  });

  it("puts an event that crosses the month end in both months, continuing across the join", () => {
    // Friday 30 Oct to Tuesday 3 Nov.
    const crossing = item("x", 25, 29);
    const inOctober = month([crossing], october).weeks.flatMap((week) => week.bars);
    expect(inOctober).toHaveLength(1);
    expect(inOctober[0]).toMatchObject({ startCol: 5, endCol: 7, continuesAfter: true });

    const inNovember = month([crossing], november).weeks.flatMap((week) => week.bars);
    expect(inNovember).toHaveLength(2);
    expect(inNovember[1]).toMatchObject({ startCol: 1, endCol: 2, continuesBefore: true });
  });

  it("does not draw an event that lies wholly in the leading days of the first week", () => {
    // 26 to 30 Oct: it shares a week row with 1 Nov, but it is October's, not November's.
    const october = item("oct", 21, 25);
    expect(month([october], november).weeks.flatMap((week) => week.bars)).toHaveLength(0);
    expect(
      month([october], { from: "2026-10-01", to: "2026-10-31" }).weeks.flatMap((week) => week.bars)
    ).toHaveLength(1);
  });

  it("leaves out an event that is wholly in another month", () => {
    const early = item("early", 1, 2); // 6 to 7 Oct
    expect(month([early], november).weeks.flatMap((week) => week.bars)).toHaveLength(0);
    expect(month([early], october).weeks.flatMap((week) => week.bars)).toHaveLength(1);
  });

  it("does not stretch to reach an event far ahead, and does not count it as later", () => {
    const far = item("far", 400, 401);
    const result = month([far], october);
    expect(result.weeks).toHaveLength(5);
    expect(result.later).toBe(0);
  });

  it("still shades blocked dates and flags entry deadlines inside the month", () => {
    const withDeadline = item("d", 20, 23, {
      kind: "suggested",
      edition: { slug: "d", name: "Event d", startDate: at(20), registrationDeadlineDate: at(10) },
    });
    const result = month([withDeadline], october, [
      { from: "2026-10-08", to: "2026-10-09", label: "Exams" },
    ]);
    const days = result.weeks.flatMap((week) => week.days);
    expect(days.find((day) => day.iso === "2026-10-08")?.blocked?.label).toBe("Exams");
    expect(days.find((day) => day.iso === "2026-10-15")?.deadlines).toHaveLength(1);
  });
});

describe("a busy week", () => {
  // Events spanning the whole of the week of Monday 12 October.
  const crowd = (kinds: Array<CalendarItem["kind"]>): CalendarItem[] =>
    kinds.map((kind, i) =>
      item(`e${i}`, 7, 13, { kind, status: kind === "planned" ? "shortlisted" : undefined })
    );
  const week = (items: CalendarItem[], extra = {}) =>
    layout(items, [], extra).weeks.find((w) => w.key === "2026-10-12")!;

  it("gives the plan and the suggestions the top rows, however they are ordered", () => {
    const items = [
      item("open1", 7, 13, { kind: "available" }),
      item("open2", 7, 13, { kind: "available" }),
      item("suggested", 7, 13, { kind: "suggested" }),
      item("planned", 7, 13, { kind: "planned", status: "shortlisted" }),
    ];
    const lane = Object.fromEntries(week(items).bars.map((bar) => [bar.item.slug, bar.lane]));
    expect(lane.planned).toBe(0);
    expect(lane.suggested).toBe(1);
    expect(lane.open1).toBeGreaterThan(1);
    expect(lane.open2).toBeGreaterThan(1);
  });

  it("draws every event when no limit is set", () => {
    const result = week(
      crowd(["available", "available", "available", "available", "available", "available"])
    );
    expect(result.bars).toHaveLength(6);
    expect(result.hidden).toEqual([]);
  });

  it("folds what is open beyond the limit into a count, and says which events they are", () => {
    const result = week(
      crowd(["planned", "available", "available", "available", "available", "available"]),
      { maxLanes: 3 }
    );
    expect(result.bars).toHaveLength(3);
    expect(result.laneCount).toBe(3);
    expect(result.hidden).toHaveLength(3);
    expect(result.hidden.every((hidden) => hidden.kind === "available")).toBe(true);
    // Nothing is lost: what is drawn and what is folded are the whole week.
    expect(result.bars.length + result.hidden.length).toBe(6);
  });

  it("never folds away the plan or a suggestion, even when they alone exceed the limit", () => {
    const result = week(
      crowd(["planned", "planned", "suggested", "planned", "available", "available"]),
      {
        maxLanes: 2,
      }
    );
    const shown = result.bars.map((bar) => bar.item.kind);
    expect(shown.filter((kind) => kind !== "available")).toHaveLength(4);
    expect(result.hidden.every((hidden) => hidden.kind === "available")).toBe(true);
  });

  it("draws the whole week once it is expanded", () => {
    const items = crowd([
      "planned",
      "available",
      "available",
      "available",
      "available",
      "available",
    ]);
    const result = week(items, { maxLanes: 3, expandedWeeks: new Set(["2026-10-12"]) });
    expect(result.bars).toHaveLength(6);
    expect(result.hidden).toEqual([]);
  });

  it("only folds events that really share days, so a quiet week is never folded", () => {
    const apart = [item("a", 7, 8), item("b", 9, 10), item("c", 11, 12), item("d", 13, 13)];
    const result = week(apart, { maxLanes: 1 });
    expect(result.bars).toHaveLength(4);
    expect(result.hidden).toEqual([]);
  });
});

describe("weeks that start on another day", () => {
  const saturday = 5;
  const october = { from: "2026-10-01", to: "2026-10-31" };

  it("finds the start of a week for any weekday", () => {
    const wednesday = Date.UTC(2026, 9, 7) / DAY;
    expect(startOfWeek(wednesday)).toBe(Date.UTC(2026, 9, 5) / DAY); // Monday
    expect(startOfWeek(wednesday, saturday)).toBe(Date.UTC(2026, 9, 3) / DAY); // Saturday
    const sat = Date.UTC(2026, 9, 3) / DAY;
    expect(startOfWeek(sat, saturday)).toBe(sat);
    expect(startOfWeek(sat + 6, saturday)).toBe(sat);
    expect(startOfWeek(sat + 7, saturday)).toBe(sat + 7);
  });

  it("draws Saturday to Friday rows, and says each day's weekday", () => {
    const weeks = buildCalendar({
      items: [],
      blocked: [],
      today: TODAY,
      range: october,
      weekStartsOn: saturday,
    }).weeks;
    // 1 Oct is a Thursday and 31 Oct a Saturday: 26 Sep to 6 Nov, six rows.
    expect(weeks.map((week) => week.key)).toEqual([
      "2026-09-26",
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ]);
    expect(weeks[1]!.days.map((day) => day.weekday)).toEqual([5, 6, 0, 1, 2, 3, 4]);
  });

  it("draws a Saturday to Friday event as one unbroken bar, which Monday weeks cannot", () => {
    // Saturday 10 October to Friday 16 October.
    const event = item("sat", 5, 11);
    const sat = buildCalendar({
      items: [event],
      blocked: [],
      today: TODAY,
      range: october,
      weekStartsOn: saturday,
    }).weeks.flatMap((week) => week.bars);
    expect(sat).toHaveLength(1);
    expect(sat[0]).toMatchObject({
      startCol: 1,
      endCol: 7,
      continuesBefore: false,
      continuesAfter: false,
    });

    const monday = buildCalendar({
      items: [event],
      blocked: [],
      today: TODAY,
      range: october,
    }).weeks.flatMap((week) => week.bars);
    expect(monday).toHaveLength(2);
  });
});
