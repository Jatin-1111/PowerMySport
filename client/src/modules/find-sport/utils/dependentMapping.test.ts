import { describe, expect, it } from "vitest";

import { EMPTY_ANSWERS, type SportResult, type WizardAnswers } from "../types";
import { buildDependentPayload, prefillFromPlayer } from "./dependentMapping";

const answers: WizardAnswers = {
  ...EMPTY_ANSWERS,
  childName: "Riya",
  dob: "2015-06-01",
  age: 11,
  gender: "girl",
  state: "Delhi",
  priorSports: ["Tennis"],
  consideringSports: ["Badminton", "Chess"],
  height: 140,
  weight: 35,
  energyType: "explosive",
  motorType: "gross",
  visualTracking: "strong",
  eyesight: "corrected",
  agility: "high",
  teamIndividual: 2,
  competitiveResponse: "fired-up",
  focusStyle: "bursts",
  decisionStyle: "react",
  pressureResponse: "thrives",
  repetitionTolerance: "high",
  contactComfort: "neutral",
  environment: "outdoor",
  waterComfort: "comfortable",
  budget: "3k-7k",
  ambition: "competitive",
  weeklyHours: "4-7",
};

const scored = [] as SportResult[];

describe("buildDependentPayload", () => {
  it("writes the profile fields flat and the quiz answers under quiz, the shape the server stores", () => {
    const payload = buildDependentPayload(answers, scored, "Riya");

    expect(payload).toMatchObject({
      name: "Riya",
      dob: "2015-06-01",
      age: 11,
      gender: "FEMALE",
      location: "Delhi",
      sportsFocus: ["Tennis"],
      consideringSports: ["Badminton", "Chess"],
      budgetRange: "3k-7k",
      ambition: "competitive",
      weeklyHoursCategory: "4-7",
    });
    expect(payload.quiz).toMatchObject({
      heightCm: 140,
      weightKg: 35,
      energyType: "explosive",
      eyesight: "corrected",
      teamIndividual: 2,
      waterComfort: "comfortable",
    });
  });

  it("keeps the quiz traits out of the top level, where they used to be", () => {
    const payload = buildDependentPayload(answers, scored, "Riya") as Record<string, unknown>;

    for (const key of ["heightCm", "energyType", "eyesight", "contactComfort", "teamIndividual"]) {
      expect(payload[key]).toBeUndefined();
    }
  });

  it("records a chosen sport only when one is given, so a retake never wipes an earlier decision", () => {
    expect(buildDependentPayload(answers, scored, "Riya").chosenSport).toBeUndefined();

    const withChoice = buildDependentPayload(answers, scored, "Riya", [], "Badminton");
    expect(withChoice.chosenSport).toBe("Badminton");
    expect(withChoice.chosenSportAt).toBeTruthy();
  });

  it("leaves a name out when none is given, so an edit does not blank it", () => {
    expect("name" in buildDependentPayload(answers, scored)).toBe(false);
  });

  it("maps the gender choices to the stored values", () => {
    expect(buildDependentPayload({ ...answers, gender: "boy" }, scored).gender).toBe("MALE");
    expect(buildDependentPayload({ ...answers, gender: "prefer-not" }, scored).gender).toBe(
      "OTHER"
    );
  });
});

describe("prefillFromPlayer", () => {
  it("reads the quiz answers from the child's quiz record", () => {
    const prefilled = prefillFromPlayer({
      quiz: { heightCm: 150, energyType: "endurance", teamIndividual: 4, waterComfort: "neutral" },
    });

    expect(prefilled).toMatchObject({
      height: 150,
      energyType: "endurance",
      teamIndividual: 4,
      waterComfort: "neutral",
    });
  });

  it("copes with a child who never took the quiz", () => {
    expect(prefillFromPlayer({ location: "Delhi" })).toMatchObject({ state: "Delhi" });
    expect(prefillFromPlayer({ quiz: null }).energyType).toBeUndefined();
  });

  it("keeps a team-or-solo answer of 0 distinct from no answer", () => {
    expect(prefillFromPlayer({ quiz: { teamIndividual: 0 } }).teamIndividual).toBe(0);
    expect(prefillFromPlayer({ quiz: {} }).teamIndividual).toBeUndefined();
  });

  it("round-trips: what the quiz writes is what a retake pre-fills", () => {
    const stored = buildDependentPayload(answers, scored, "Riya");
    const prefilled = prefillFromPlayer(stored);

    for (const key of [
      "height",
      "weight",
      "energyType",
      "motorType",
      "visualTracking",
      "eyesight",
      "agility",
      "teamIndividual",
      "competitiveResponse",
      "focusStyle",
      "decisionStyle",
      "pressureResponse",
      "repetitionTolerance",
      "contactComfort",
      "environment",
      "waterComfort",
      "budget",
      "ambition",
      "weeklyHours",
      "priorSports",
      "consideringSports",
      "state",
      "gender",
    ] as const) {
      expect(prefilled[key], key).toEqual(answers[key]);
    }
  });
});
