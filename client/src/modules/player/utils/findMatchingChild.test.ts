import { describe, expect, it } from "vitest";

import { findMatchingChild } from "./findMatchingChild";

const riya = { name: "Riya", dob: "2015-06-01T00:00:00.000Z" };
const riyaOlder = { name: "Riya", dob: "2012-02-10T00:00:00.000Z" };
const meera = { name: "Meera", dob: null };

describe("findMatchingChild", () => {
  it("matches a name without regard to case or surrounding spaces", () => {
    expect(findMatchingChild([meera, riya], { name: "  rIYA " })).toBe(riya);
  });

  it("prefers the child whose date of birth also matches", () => {
    const match = findMatchingChild([riyaOlder, riya], { name: "Riya", dateOfBirth: "2015-06-01" });

    expect(match).toBe(riya);
  });

  it("falls back to the name alone when the date of birth matches no one", () => {
    const match = findMatchingChild([riyaOlder, riya], { name: "Riya", dateOfBirth: "2000-01-01" });

    expect(match).toBe(riyaOlder);
  });

  it("matches on name when no date of birth was typed", () => {
    expect(findMatchingChild([riya], { name: "Riya" })).toBe(riya);
  });

  it("returns null for a blank name or an unknown one", () => {
    expect(findMatchingChild([riya], { name: "   " })).toBeNull();
    expect(findMatchingChild([riya], { name: "Aarav" })).toBeNull();
    expect(findMatchingChild([], { name: "Riya" })).toBeNull();
  });

  it("copes with a child saved without a name or date of birth", () => {
    expect(findMatchingChild([{ name: null, dob: "garbage" }], { name: "Riya" })).toBeNull();
    expect(
      findMatchingChild([{ name: "Riya", dob: "garbage" }], {
        name: "Riya",
        dateOfBirth: "2015-06-01",
      })
    ).toMatchObject({ name: "Riya" });
  });
});
