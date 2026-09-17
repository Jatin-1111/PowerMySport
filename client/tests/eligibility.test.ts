import { describe, expect, it } from "vitest";
import { buildShortlist, judgeEdition } from "@/modules/planner/utils/eligibility";
import type { PlannerEdition } from "@/modules/planner/utils/eligibility";

/**
 * The rules this pins are the ones a parent would otherwise discover at the
 * entry desk: that a good rank closes the entry level, that playing down is not
 * allowed, and that an adult prize-money event is not a junior fixture however
 * convenient its date.
 */

const edition = (over: Partial<PlannerEdition> = {}): PlannerEdition => ({
  name: "AITA CS7 (Sonipat)",
  startDate: "2026-10-05T00:00:00.000Z",
  city: "Sonipat",
  ageGroups: ["Under-14"],
  ladder: "Championship Series",
  grade: 7,
  kind: "junior-ladder",
  ...over,
});

describe("what a junior plan may contain", () => {
  it("drops the senior prize-money circuit entirely", () => {
    // Not "closed" — a different circuit. 14% of the real tennis calendar.
    const result = judgeEdition(
      edition({
        name: "AITA Rs 1 Lakh (Pune)",
        kind: "senior-prize-money",
        ladder: null,
        ageGroups: ["Men"],
      }),
      { bracket: "U-14", rank: 312 }
    );
    expect(result).toBeNull();
  });

  it("drops an event whose series could not be read", () => {
    // Being wrong here means an adult event in a child's plan, so an
    // unclassifiable event is not offered at all.
    expect(
      judgeEdition(edition({ kind: "unknown", ladder: null }), { bracket: "U-14", rank: 312 })
    ).toBeNull();
  });

  it("keeps international junior events", () => {
    const result = judgeEdition(
      edition({
        name: "AITA Asian (Ahmedabad)",
        kind: "international-junior",
        ladder: null,
        ageGroups: ["Under-16"],
      }),
      { bracket: "U-14", rank: 312 }
    );
    expect(result?.status).toBe("open");
  });
});

describe("age groups", () => {
  it("allows playing up and says so", () => {
    const result = judgeEdition(edition({ ageGroups: ["Under-16"] }), {
      bracket: "U-14",
      rank: 312,
    });
    expect(result?.status).toBe("open");
    expect(result?.playingUp).toBe(true);
    expect(result?.notes.join(" ")).toMatch(/same annual allowance/i);
  });

  it("refuses playing down", () => {
    const result = judgeEdition(edition({ ageGroups: ["Under-12"] }), {
      bracket: "U-14",
      rank: 312,
    });
    expect(result?.status).toBe("closed");
    expect(result?.reason).toMatch(/below Under-14/);
  });

  it("takes the matching group when an event runs several", () => {
    const result = judgeEdition(edition({ ageGroups: ["Under-12", "Under-14"] }), {
      bracket: "U-14",
      rank: 312,
    });
    expect(result?.status).toBe("open");
    // U-14 is the child's own group, so this is not playing up.
    expect(result?.playingUp).toBe(false);
  });

  it("says it does not know rather than guessing", () => {
    const result = judgeEdition(edition({ ageGroups: [] }), { bracket: "U-14", rank: 312 });
    expect(result?.status).toBe("unknown");
    expect(result?.reason).toMatch(/fact sheet/i);
  });
});

describe("the reverse gate", () => {
  it("closes Talent Series for a top-75 player", () => {
    const result = judgeEdition(
      edition({ name: "AITA TS7 (Bengaluru)", ladder: "Talent Series" }),
      { bracket: "U-14", rank: 40 }
    );
    expect(result?.status).toBe("closed");
    expect(result?.reason).toMatch(/Talent Series is closed at rank 40/);
  });

  it("leaves Talent Series open below the bar, with the zone caveat", () => {
    const result = judgeEdition(
      edition({ name: "AITA TS7 (Bengaluru)", ladder: "Talent Series" }),
      { bracket: "U-14", rank: 312 }
    );
    expect(result?.status).toBe("open");
    // The zone restriction is a real gate we cannot evaluate, so it is said
    // rather than ignored.
    expect(result?.notes.join(" ")).toMatch(/zone/i);
  });

  it("never closes Championship Series on rank", () => {
    // The 2026 rules removed this bar; a stale assumption would wrongly hide
    // the most common event on the calendar from strong players.
    const result = judgeEdition(edition(), { bracket: "U-14", rank: 3 });
    expect(result?.status).toBe("open");
  });
});

describe("the shortlist", () => {
  it("splits by status and orders by date", () => {
    const result = buildShortlist(
      [
        edition({ name: "later", startDate: "2026-11-01T00:00:00.000Z" }),
        edition({ name: "sooner", startDate: "2026-10-01T00:00:00.000Z" }),
        edition({ name: "too young", ageGroups: ["Under-12"] }),
        edition({ name: "senior", kind: "senior-prize-money" }),
      ],
      { bracket: "U-14", rank: 312 }
    );

    expect(result.ownGroup.map((e) => e.edition.name)).toEqual(["sooner", "later"]);
    expect(result.closed).toHaveLength(1);
    // The senior event is absent from every bucket, not filed under closed.
    expect(
      result.ownGroup.length +
        result.playingUp.length +
        result.closed.length +
        result.unknown.length
    ).toBe(3);
  });

  it("keeps playing-up events out of the primary list", () => {
    // Found by running this against the real calendar: older age groups hold
    // more events, so date-ordering alone put other children's fixtures at the
    // top of a twelve-year-old's list.
    const result = buildShortlist(
      [
        edition({
          name: "own group",
          ageGroups: ["Under-12"],
          startDate: "2026-11-01T00:00:00.000Z",
        }),
        edition({ name: "older", ageGroups: ["Under-16"], startDate: "2026-10-01T00:00:00.000Z" }),
      ],
      { bracket: "U-12", rank: 400 }
    );

    expect(result.ownGroup.map((e) => e.edition.name)).toEqual(["own group"]);
    expect(result.playingUp.map((e) => e.edition.name)).toEqual(["older"]);
  });
});
