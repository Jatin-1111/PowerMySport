import { describe, expect, it } from "vitest";

import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import {
  addMonths,
  defaultMonth,
  describeMonth,
  itemsInMonth,
  monthChoices,
} from "@/modules/planner/utils/calendarMonths";

/**
 * Which month opens, what the strip offers, and what a month says about itself. The
 * claims worth pinning are the ones a parent would act on: an event that crosses a
 * month end is in both, the calendar never opens on a month with nothing left in it
 * while a later one has something, and the counts are the events that are really there.
 */

const TODAY = "2026-10-06";

const item = (
  slug: string,
  start: string,
  end: string,
  over: Partial<CalendarItem> = {}
): CalendarItem => ({
  slug,
  name: `Event ${slug}`,
  startDate: `${start}T00:00:00.000Z`,
  endDate: `${end}T00:00:00.000Z`,
  kind: "available",
  edition: { slug, name: `Event ${slug}`, startDate: `${start}T00:00:00.000Z` },
  clashes: [],
  hasOverlap: false,
  ...over,
});

describe("addMonths", () => {
  it("moves across a year end, both ways", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });
});

describe("monthChoices", () => {
  it("starts at this month and offers at least two more, with nothing to show", () => {
    const choices = monthChoices({ items: [], today: TODAY });
    expect(choices.map((c) => c.key)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(choices.every((c) => c.count === 0)).toBe(true);
  });

  it("reaches as far as the last event", () => {
    const choices = monthChoices({ items: [item("a", "2027-02-10", "2027-02-14")], today: TODAY });
    expect(choices.at(-1)?.key).toBe("2027-02");
    expect(choices).toHaveLength(5);
  });

  it("counts an event that crosses a month end in both months", () => {
    const choices = monthChoices({ items: [item("a", "2026-10-30", "2026-11-03")], today: TODAY });
    expect(choices.find((c) => c.key === "2026-10")?.count).toBe(1);
    expect(choices.find((c) => c.key === "2026-11")?.count).toBe(1);
    expect(choices.find((c) => c.key === "2026-12")?.count).toBe(0);
  });

  it("is capped, so a wrong year cannot stretch the strip", () => {
    const choices = monthChoices({ items: [item("a", "2031-01-10", "2031-01-12")], today: TODAY });
    expect(choices).toHaveLength(9);
  });

  it("adds the year to a month only once the strip crosses into a new one", () => {
    const choices = monthChoices({ items: [item("a", "2027-02-10", "2027-02-14")], today: TODAY });
    expect(choices.map((c) => c.short)).toEqual(["Oct", "Nov", "Dec", "Jan 2027", "Feb 2027"]);
  });

  it("labels each month for people and for the strip", () => {
    const [first] = monthChoices({ items: [], today: TODAY });
    expect(first).toMatchObject({
      label: "October 2026",
      short: "Oct",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});

describe("defaultMonth", () => {
  const open = (items: CalendarItem[], today = TODAY) => {
    const choices = monthChoices({ items, today });
    return defaultMonth(choices, items, today);
  };

  it("opens on this month when it has something still to come", () => {
    expect(
      open([item("a", "2026-10-16", "2026-10-20"), item("b", "2026-11-05", "2026-11-09")])
    ).toBe("2026-10");
  });

  it("moves on when the rest of this month is empty and a later one is not", () => {
    // Today is the 28th and the only event this month has finished.
    const items = [
      item("done", "2026-10-10", "2026-10-14"),
      item("next", "2026-11-05", "2026-11-09"),
    ];
    expect(open(items, "2026-10-28")).toBe("2026-11");
  });

  it("counts an event under way as still to come", () => {
    expect(open([item("now", "2026-10-04", "2026-10-10")])).toBe("2026-10");
  });

  it("stays on this month when there is nothing anywhere", () => {
    expect(open([])).toBe("2026-10");
  });
});

describe("what a month says about itself", () => {
  const choices = monthChoices({ items: [], today: TODAY });
  const october = choices[0]!;

  const items = [
    item("a", "2026-10-16", "2026-10-20", { kind: "planned", status: "entered" }),
    item("b", "2026-10-24", "2026-10-28", { kind: "planned", status: "shortlisted" }),
    item("c", "2026-10-17", "2026-10-19", { kind: "suggested" }),
    item("d", "2026-10-10", "2026-10-12"),
    item("e", "2026-10-11", "2026-10-13"),
    item("f", "2026-11-14", "2026-11-18"),
  ];

  it("lists only the events in the month", () => {
    expect(
      itemsInMonth(october, items)
        .map((i) => i.slug)
        .sort()
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("counts them by what has been done with each, naming only what is there", () => {
    expect(describeMonth(october, items)).toBe(
      "5 events in October 2026: 1 entered, 1 still to enter, 1 suggested, 2 open to enter."
    );
  });

  it("says plainly when there is nothing", () => {
    expect(describeMonth(choices[2]!, items)).toBe(
      "Nothing on the calendar for December 2026 yet."
    );
  });

  it("uses the singular for one", () => {
    expect(describeMonth(october, [items[3]!])).toBe("1 event in October 2026: 1 open to enter.");
  });
});
