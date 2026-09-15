import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  familyLine,
  hasSomethingToShow,
} from "@/modules/community/components/DependentSummaryList";
import type { CommunityDependentSummary } from "@/modules/community/types";

/**
 * How a parent's children read on a Discover card and in the profile modal.
 *
 * The rule these pin: a card never presents one child as if they were the
 * family. It used to show the oldest-added child's category and city with the
 * rest reduced to "+1".
 */

const child = (fields: Partial<CommunityDependentSummary> = {}): CommunityDependentSummary => ({
  sport: null,
  ageBand: null,
  gender: null,
  city: null,
  ...fields,
});

describe("categoryLabel", () => {
  it("prints the category the way a draw sheet does", () => {
    expect(categoryLabel(child({ gender: "Boy", ageBand: "U-16" }))).toBe("Boys U-16");
    expect(categoryLabel(child({ gender: "Girl", ageBand: "U-12" }))).toBe("Girls U-12");
  });

  it("degrades to whichever half it has", () => {
    expect(categoryLabel(child({ ageBand: "U-16" }))).toBe("U-16");
    expect(categoryLabel(child({ gender: "Boy" }))).toBe("Boy");
    expect(categoryLabel(child())).toBeNull();
  });
});

describe("familyLine", () => {
  it("renders an only child as themselves", () => {
    expect(familyLine([child({ gender: "Boy", ageBand: "U-16", city: "Chandigarh" })])).toBe(
      "Boys U-16 · Chandigarh"
    );
  });

  it("rolls two children up to the family instead of picking one", () => {
    const line = familyLine([
      child({ sport: "Tennis", gender: "Boy", ageBand: "U-16", city: "Chandigarh" }),
      child({ sport: "Badminton", gender: "Girl", ageBand: "U-12", city: "Chandigarh" }),
    ]);

    expect(line).toBe("2 children · Chandigarh");
    // The old format named one child's category as though it were the family's.
    expect(line).not.toContain("Boys U-16");
    expect(line).not.toContain("+1");
  });

  it("lists both cities when siblings train in different places", () => {
    expect(
      familyLine([
        child({ ageBand: "U-16", city: "Chandigarh" }),
        child({ ageBand: "U-12", city: "Mohali" }),
      ])
    ).toBe("2 children · Chandigarh, Mohali");
  });

  it("counts cities past two rather than letting the line grow and truncate", () => {
    expect(
      familyLine([
        child({ city: "Chandigarh" }),
        child({ city: "Mohali" }),
        child({ city: "Panchkula" }),
        child({ city: "Zirakpur" }),
      ])
    ).toBe("4 children · Chandigarh, Mohali +2");
  });

  it("still names the count when no city is known", () => {
    expect(familyLine([child({ ageBand: "U-16" }), child({ ageBand: "U-12" })])).toBe("2 children");
  });

  it("counts only children it would actually show, so the card cannot over-promise", () => {
    // An empty child is dropped by the modal's list; the card must drop it too,
    // or "2 children" opens a modal showing one.
    expect(familyLine([child({ ageBand: "U-16", city: "Pune" }), child()])).toBe("U-16 · Pune");
    expect(hasSomethingToShow(child())).toBe(false);
  });

  it("says nothing at all for a member with no children on file", () => {
    expect(familyLine([])).toBeNull();
    expect(familyLine(undefined)).toBeNull();
  });
});
