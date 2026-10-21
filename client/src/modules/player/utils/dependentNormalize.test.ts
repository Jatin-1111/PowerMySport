import { describe, expect, it } from "vitest";

import {
  denormalizeDependent,
  flattenQuiz,
  normalizeDependent,
  toApiPayload,
} from "./dependentNormalize";

describe("the quiz answers at the API boundary", () => {
  it("reads nested quiz answers into the grouped shape", () => {
    const dependent = normalizeDependent({
      name: "Riya",
      dob: "2015-01-01",
      quiz: { heightCm: 140, eyesight: "corrected", waterComfort: "neutral" },
    });
    expect(dependent.physical?.heightCm).toBe(140);
    expect(dependent.physical?.eyesight).toBe("corrected");
    expect(dependent.comfort?.waterComfort).toBe("neutral");
  });

  it("nests the quiz answers on the way out and leaves other fields flat", () => {
    const payload = toApiPayload({
      name: "Riya",
      location: "Delhi",
      eyesight: "sharp",
      agility: "high",
    });
    expect(payload).toEqual({
      name: "Riya",
      location: "Delhi",
      quiz: { eyesight: "sharp", agility: "high" },
    });
  });

  it("sends no quiz key when the edit carries no quiz answer", () => {
    const payload = toApiPayload(denormalizeDependent({ name: "Riya", location: "Delhi" }));
    expect("quiz" in payload).toBe(false);
  });

  it("round-trips a child through flatten and nest", () => {
    const api = { name: "Riya", quiz: { energyType: "explosive", teamIndividual: 4 } } as const;
    expect(toApiPayload(flattenQuiz({ ...api }))).toEqual(api);
  });
});
