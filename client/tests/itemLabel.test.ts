import { describe, expect, it } from "vitest";

import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import { shortEventLabel } from "@/modules/planner/utils/itemLabel";

const item = (name: string, edition: Partial<CalendarItem["edition"]> = {}): CalendarItem => ({
  slug: "x",
  name,
  startDate: "2026-10-10T00:00:00.000Z",
  kind: "available",
  edition: { name, startDate: "2026-10-10T00:00:00.000Z", ...edition },
  clashes: [],
  hasOverlap: false,
});

describe("shortEventLabel", () => {
  it("leads with the place and follows with the level in plain words", () => {
    expect(
      shortEventLabel(
        item("AITA CS7 (Sonipat)", { city: "Sonipat", ladder: "Championship Series" })
      )
    ).toEqual({ place: "Sonipat", level: "Championship" });
    expect(
      shortEventLabel(item("AITA SS (Delhi)", { city: "Delhi", ladder: "Super Series" }))
    ).toEqual({ place: "Delhi", level: "Super" });
    expect(
      shortEventLabel(item("AITA TS7 (Jaipur)", { city: "Jaipur", ladder: "Talent Series" }))
    ).toEqual({ place: "Jaipur", level: "Talent" });
  });

  it("takes the level from the name for events that are not on the AITA ladder", () => {
    expect(shortEventLabel(item("ITF Juniors (Pune)", { city: "Pune" }))).toEqual({
      place: "Pune",
      level: "ITF Juniors",
    });
  });

  it("falls back to the state, then to the name, when there is no city", () => {
    expect(
      shortEventLabel(item("AITA CS7 (Bihar)", { state: "Bihar", ladder: "Championship Series" }))
        .place
    ).toBe("Bihar");
    expect(shortEventLabel(item("Mystery Open")).place).toBe("Mystery Open");
  });

  it("does not repeat the name as its own level", () => {
    expect(shortEventLabel(item("Mystery Open")).level).toBeNull();
  });
});
