import { describe, expect, it } from "vitest";

import { describeCost } from "../src/modules/admin/components/opportunity/ChangeRow";

describe("describeCost", () => {
  it("reads a fee as an amount and its note, not as key: value pairs", () => {
    expect(
      describeCost({ kind: "fee", amount: 125, currency: "INR", note: "City round only" })
    ).toBe("₹125. City round only");
  });

  it("reads free and varies with their notes", () => {
    expect(describeCost({ kind: "free", note: "Girls play free" })).toBe("Free. Girls play free");
    expect(describeCost({ kind: "varies", note: "By city" })).toBe("Varies. By city");
  });

  it("says just the kind when there is no note", () => {
    expect(describeCost({ kind: "free" })).toBe("Free");
    expect(describeCost({ kind: "varies" })).toBe("Varies");
  });

  it("does not invent a figure for a fee that has none", () => {
    expect(describeCost({ kind: "fee", note: "Small fee" })).toBe("A fee. Small fee");
  });

  it("leaves anything that is not a cost to the generic rendering", () => {
    expect(describeCost(undefined)).toBeNull();
    expect(describeCost("free")).toBeNull();
    expect(describeCost([{ kind: "free" }])).toBeNull();
    expect(describeCost({ kind: "cheap" })).toBeNull();
  });
});
