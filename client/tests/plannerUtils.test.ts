import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "@/modules/planner/utils/calendarLinks";
import {
  deadlineState,
  groupByMonth,
  planWarnings,
  DEADLINE_SOON_DAYS,
} from "@/modules/planner/utils/timeline";

/**
 * The claims these pin are the ones that reach a parent's phone: a calendar
 * event on the wrong day, a deadline reported as live after it closed, or two
 * overlapping events called fine.
 */

const edition = (over = {}) => ({
  slug: "aita-cs7-sonipat-2026-10-05",
  name: "AITA CS7 (Sonipat)",
  startDate: "2026-10-05T00:00:00.000Z",
  endDate: "2026-10-10T00:00:00.000Z",
  city: "Sonipat",
  state: "Haryana",
  ageGroups: ["Under-14"],
  ...over,
});

describe("googleCalendarUrl", () => {
  const params = (url: string) => new URL(url).searchParams;

  it("uses an exclusive end date, so a 5th to 10th event covers the 10th", () => {
    expect(params(googleCalendarUrl(edition())).get("dates")).toBe("20261005/20261011");
  });

  it("is a one-day event when the calendar gives no end date", () => {
    const url = googleCalendarUrl(edition({ endDate: undefined }));
    expect(params(url).get("dates")).toBe("20261005/20261006");
  });

  it("treats an end before the start as a one-day event rather than a negative range", () => {
    const url = googleCalendarUrl(edition({ endDate: "2026-10-01T00:00:00.000Z" }));
    expect(params(url).get("dates")).toBe("20261005/20261006");
  });

  it("reads the stored date in UTC, so no timezone shifts it to the day before", () => {
    // Midnight UTC is still the 5th in London and the 4th in Los Angeles; the
    // calendar date the federation printed is the 5th everywhere.
    const url = googleCalendarUrl(edition({ startDate: "2026-10-05T00:00:00.000Z" }));
    expect(params(url).get("dates")?.startsWith("20261005")).toBe(true);
  });

  it("carries the location and the tournament page, and never invents a time", () => {
    const url = params(googleCalendarUrl(edition()));
    expect(url.get("location")).toBe("Sonipat, Haryana");
    expect(url.get("details")).toContain("/tournaments/aita-cs7-sonipat-2026-10-05");
    expect(url.get("dates")).not.toMatch(/T\d/);
  });

  it("omits the location parameter when none is known", () => {
    const url = googleCalendarUrl(edition({ city: undefined, state: undefined }));
    expect(params(url).has("location")).toBe(false);
  });
});

describe("buildIcs", () => {
  const NOW = new Date(Date.UTC(2026, 9, 1, 8, 30, 0));

  it("is a well-formed calendar with CRLF line endings", () => {
    const ics = buildIcs([edition()], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("writes all-day events with an exclusive end", () => {
    const ics = buildIcs([edition()], NOW);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261005");
    expect(ics).toContain("DTEND;VALUE=DATE:20261011");
  });

  it("derives the UID from the slug, so importing twice updates rather than duplicates", () => {
    const a = buildIcs([edition()], NOW);
    const b = buildIcs([edition()], new Date(Date.UTC(2026, 9, 2)));
    const uid = (ics: string) => /UID:(.*)\r\n/.exec(ics)?.[1];
    expect(uid(a)).toBe("aita-cs7-sonipat-2026-10-05@powermysport.com");
    expect(uid(a)).toBe(uid(b));
  });

  it("escapes the characters that would break a text field", () => {
    const ics = buildIcs([edition({ name: "Open; Boys, U-14\\Girls", slug: "x" })], NOW);
    expect(ics).toContain("SUMMARY:Open\\; Boys\\, U-14\\\\Girls");
  });

  it("folds lines over 75 octets and never splits a multi-byte character", () => {
    const ics = buildIcs([edition({ name: "Çhampionship ".repeat(12), slug: "long" })], NOW);
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Unfolding must give the original back, with no replacement characters.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${"Çhampionship ".repeat(12)}`);
    expect(unfolded).not.toContain("�");
  });

  it("builds one event per tournament", () => {
    const ics = buildIcs([edition(), edition({ slug: "second", name: "Second" })], NOW);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe("groupByMonth", () => {
  it("groups by the month an event starts in, in calendar order", () => {
    const groups = groupByMonth(
      [
        { id: "c", startDate: "2026-11-02T00:00:00.000Z" },
        { id: "a", startDate: "2026-10-05T00:00:00.000Z" },
        { id: "b", startDate: "2026-10-28T00:00:00.000Z" },
      ],
      (item) => item.startDate
    );
    expect(groups.map((group) => group.label)).toEqual(["October 2026", "November 2026"]);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("returns nothing for nothing", () => {
    expect(groupByMonth([], () => "")).toEqual([]);
  });
});

describe("deadlineState", () => {
  const NOW = new Date(Date.UTC(2026, 9, 10, 15, 0, 0));

  it("says the deadline is unpublished rather than implying there is none", () => {
    expect(deadlineState(null, NOW).kind).toBe("unpublished");
    expect(deadlineState(undefined, NOW).kind).toBe("unpublished");
  });

  it("keeps a deadline live for the whole of its own day", () => {
    const state = deadlineState("2026-10-10T00:00:00.000Z", NOW);
    expect(state.kind).toBe("soon");
    expect(state.kind === "soon" && state.daysLeft).toBe(0);
  });

  it("marks yesterday's deadline as passed", () => {
    expect(deadlineState("2026-10-09T00:00:00.000Z", NOW).kind).toBe("passed");
  });

  it("calls a deadline soon inside the window and open beyond it", () => {
    const edge = new Date(NOW.getTime() + DEADLINE_SOON_DAYS * 86_400_000).toISOString();
    const beyond = new Date(NOW.getTime() + (DEADLINE_SOON_DAYS + 1) * 86_400_000).toISOString();
    expect(deadlineState(edge, NOW).kind).toBe("soon");
    expect(deadlineState(beyond, NOW).kind).toBe("open");
  });
});

describe("planWarnings", () => {
  const event = (slug: string, start: string, end?: string) => ({
    slug,
    name: slug.toUpperCase(),
    startDate: `${start}T00:00:00.000Z`,
    ...(end ? { endDate: `${end}T00:00:00.000Z` } : {}),
  });

  it("flags events that overlap, against the later one", () => {
    const warnings = planWarnings([
      event("a", "2026-10-05", "2026-10-10"),
      event("b", "2026-10-08"),
    ]);
    expect(warnings).toEqual([{ slug: "b", message: "Overlaps with A." }]);
  });

  it("treats a same-day finish and start as an overlap", () => {
    const warnings = planWarnings([
      event("a", "2026-10-05", "2026-10-10"),
      event("b", "2026-10-10"),
    ]);
    expect(warnings[0]?.message).toBe("Overlaps with A.");
  });

  it("flags a start the day after the last one ends", () => {
    const warnings = planWarnings([
      event("a", "2026-10-05", "2026-10-10"),
      event("b", "2026-10-11"),
    ]);
    expect(warnings[0]?.message).toBe("Starts the day after A ends.");
  });

  it("flags a single clear day, and says it is one", () => {
    const warnings = planWarnings([
      event("a", "2026-10-05", "2026-10-10"),
      event("b", "2026-10-12"),
    ]);
    expect(warnings[0]?.message).toBe("Only 1 clear day after A ends.");
  });

  it("is quiet when there is room", () => {
    expect(
      planWarnings([event("a", "2026-10-05", "2026-10-10"), event("b", "2026-10-13")])
    ).toEqual([]);
  });

  it("does not depend on the order it is given", () => {
    const warnings = planWarnings([
      event("b", "2026-10-08"),
      event("a", "2026-10-05", "2026-10-10"),
    ]);
    expect(warnings).toEqual([{ slug: "b", message: "Overlaps with A." }]);
  });

  it("has nothing to say about zero or one event", () => {
    expect(planWarnings([])).toEqual([]);
    expect(planWarnings([event("a", "2026-10-05")])).toEqual([]);
  });
});
