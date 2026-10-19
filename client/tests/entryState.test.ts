import { describe, expect, it } from "vitest";

import { entriesClosed, splitByEntryState } from "@/modules/planner/utils/timeline";

/**
 * "Can this still be entered" is asked by the plan row, the next-step box, the event
 * lists, the suggestions and the calendar. These pin the one answer they share, so a
 * list cannot offer an event another list calls closed.
 */

const NOW = new Date("2026-10-19T09:30:00.000Z");
const at = (iso: string) => `${iso}T00:00:00.000Z`;

describe("entriesClosed", () => {
  it("is false when the calendar prints no deadline: unknown is not closed", () => {
    expect(entriesClosed(undefined, NOW)).toBe(false);
    expect(entriesClosed(null, NOW)).toBe(false);
  });

  it("is true the day after the deadline, not on it", () => {
    expect(entriesClosed(at("2026-10-18"), NOW)).toBe(true);
    // A deadline on the 19th is live all day on the 19th.
    expect(entriesClosed(at("2026-10-19"), NOW)).toBe(false);
    expect(entriesClosed(at("2026-10-20"), NOW)).toBe(false);
  });
});

describe("splitByEntryState", () => {
  const entry = (name: string, deadline?: string) => ({
    edition: { name, registrationDeadlineDate: deadline },
  });

  it("separates what can be entered from what has shut, keeping order in both", () => {
    const { open, shut } = splitByEntryState(
      [
        entry("a", at("2026-10-25")),
        entry("b", at("2026-10-05")),
        entry("c"),
        entry("d", at("2026-10-01")),
        entry("e", at("2026-10-19")),
      ],
      NOW
    );
    expect(open.map((item) => item.edition.name)).toEqual(["a", "c", "e"]);
    expect(shut.map((item) => item.edition.name)).toEqual(["b", "d"]);
  });

  it("returns two empty lists for none", () => {
    expect(splitByEntryState([], NOW)).toEqual({ open: [], shut: [] });
  });
});
