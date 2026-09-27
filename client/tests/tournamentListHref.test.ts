import { describe, expect, it } from "vitest";

import { tournamentListHref } from "@/modules/tournaments/utils/listHref";

const base = { upcoming: true, page: 3, category: "championship-series", age: "Under-14" };

describe("tournamentListHref", () => {
  it("keeps the other filters and goes back to page 1 when one filter changes", () => {
    expect(tournamentListHref("tennis", base, { age: "Under-16" })).toBe(
      "/tournaments/sport/tennis?category=championship-series&age=Under-16"
    );
  });

  it("removes a filter set to undefined", () => {
    expect(tournamentListHref("tennis", base, { category: undefined })).toBe(
      "/tournaments/sport/tennis?age=Under-14"
    );
  });

  it("keeps the filters when only the page changes", () => {
    expect(tournamentListHref("tennis", base, { page: 2 })).toBe(
      "/tournaments/sport/tennis?category=championship-series&age=Under-14&page=2"
    );
  });

  it("drops the month when switching between upcoming and past", () => {
    expect(tournamentListHref("tennis", { ...base, month: "2026-10" }, { upcoming: false })).toBe(
      "/tournaments/sport/tennis?when=past&category=championship-series&age=Under-14"
    );
  });

  it("is the bare sport URL with nothing set", () => {
    expect(tournamentListHref("chess", { upcoming: true, page: 1 })).toBe(
      "/tournaments/sport/chess"
    );
  });
});
