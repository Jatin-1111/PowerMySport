import {
  editionSnippet,
  formatLocation,
  upcomingEditionSnippet,
} from "@/modules/tournaments/utils/editionFormat";
import { describe, expect, it } from "vitest";

describe("upcomingEditionSnippet", () => {
  const base = { title: "YONEX French Open 2026", startLabel: "20 Oct 2026", where: "Paris" };

  it("ends the lead sentence cleanly when nothing else is known", () => {
    expect(upcomingEditionSnippet(base)).toBe(
      "YONEX French Open 2026 starts 20 Oct 2026 at Paris."
    );
  });

  it("adds age groups, organiser and the entry deadline as separate sentences", () => {
    expect(
      upcomingEditionSnippet({
        ...base,
        ageGroups: ["Under-12", "Under-14"],
        organiser: "AITA",
        entriesCloseLabel: "10 Oct",
      })
    ).toBe(
      "YONEX French Open 2026 starts 20 Oct 2026 at Paris for Under-12, Under-14. Organised by AITA. Entries close 10 Oct."
    );
  });

  it("omits the venue when there is none", () => {
    expect(upcomingEditionSnippet({ ...base, where: null })).toBe(
      "YONEX French Open 2026 starts 20 Oct 2026."
    );
  });
});

describe("formatLocation", () => {
  it("joins venue and city", () => {
    expect(formatLocation("Siri Fort Complex", "Delhi")).toBe("Siri Fort Complex, Delhi");
  });

  it("does not repeat a city the venue already names", () => {
    expect(formatLocation("Delhi Lawn Tennis Association", "Delhi")).toBe(
      "Delhi Lawn Tennis Association"
    );
  });

  it("falls back to the city for a placeholder venue", () => {
    expect(formatLocation("TBC", "Jaipur")).toBe("Jaipur");
  });

  it("returns null, not the placeholder, when there is no city to fall back to", () => {
    expect(formatLocation("TBC", undefined)).toBeNull();
    expect(formatLocation("To be announced", "")).toBeNull();
  });

  it("ignores a placeholder city", () => {
    expect(formatLocation("Stadium Road Courts", "TBD")).toBe("Stadium Road Courts");
  });

  it("handles missing parts", () => {
    expect(formatLocation(undefined, "Paris")).toBe("Paris");
    expect(formatLocation(undefined, undefined)).toBeNull();
  });
});

describe("editionSnippet", () => {
  const fmt = (d: string) => d.slice(0, 10);
  const edition = {
    startDate: "2026-10-24T00:00:00.000Z",
    sportSlug: "tennis",
    city: "Jaipur",
    registrationDeadlineDate: "2026-10-05T00:00:00.000Z",
  };
  const input = { edition, title: "CS7 Jaipur", where: "Jaipur", finished: false };

  it("leaves out an entry deadline that has already passed", () => {
    const out = editionSnippet(input, fmt, new Date("2026-10-20T10:00:00Z"));
    expect(out).toBe("CS7 Jaipur starts 2026-10-24 at Jaipur.");
  });

  it("keeps an entry deadline that is still ahead, including the day itself", () => {
    const out = editionSnippet(input, fmt, new Date("2026-10-05T18:00:00Z"));
    expect(out).toContain("Entries close 2026-10-05.");
  });

  it("names the next edition for a finished event", () => {
    const out = editionSnippet(
      { ...input, finished: true, nextStartDate: "2027-10-23T00:00:00.000Z" },
      fmt
    );
    expect(out).toBe(
      "CS7 Jaipur took place on 2026-10-24 at Jaipur. The next edition is 2027-10-23."
    );
  });
});
