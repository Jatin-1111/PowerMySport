import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasFactSheetDetails,
  parseDraws,
  parseFactSheetDetails,
} from "../shared/services/aita/factSheetSections";
import { FACT_SHEET_SECTIONS, FACT_SHEET_WITHOUT_SECTIONS } from "./fixtures/aitaFactSheetSections";

describe("fact sheet draws table", () => {
  const draws = parseDraws(FACT_SHEET_SECTIONS);

  it("reads one row per draw, with qualifying rows belonging to the draw above", () => {
    assert.equal(draws.length, 5);
    assert.deepEqual(
      draws.map((d) => `${d.code}/${d.stage}`),
      ["BS18/main", "BS18/qualifying", "GS18/main", "GS18/qualifying", "BD18/main"]
    );
  });

  it("reads sizes, dates and the sign-in deadline, and null for a dash", () => {
    assert.equal(draws[0]!.size, 64);
    assert.equal(draws[0]!.startDate, "2026-10-26");
    assert.equal(draws[0]!.signIn, null);
    assert.deepEqual(draws[1]!.signIn, { date: "2026-10-23", time: "18:00" });
    assert.deepEqual(draws[4]!.signIn, { date: "2026-10-26", time: "12:00" });
    assert.equal(draws[1]!.size, 48);
    assert.equal(draws[1]!.endDate, "2026-10-25");
  });

  it("returns none for a page with no draws table", () => {
    assert.deepEqual(parseDraws(FACT_SHEET_WITHOUT_SECTIONS), []);
  });
});

describe("fact sheet blocks", () => {
  const d = parseFactSheetDetails(FACT_SHEET_SECTIONS);

  it("reads the organising association", () => {
    assert.equal(d.organisation?.name, "Example State Tennis Association");
    assert.equal(d.organisation?.contact, "A. Contact");
    assert.equal(d.organisation?.postalCode, "500001");
    assert.equal(d.organisation?.phone, "0400000000");
    assert.equal(d.organisation?.email, "association@example.test");
  });

  it("reads the director and the referee, with the referee badge", () => {
    assert.deepEqual(d.director, {
      name: "Director Example",
      phone: "9000000001",
      email: "director@example.test",
    });
    assert.equal(d.referee?.name, "Referee Example");
    assert.equal(d.referee?.certification, "ITF White Badge Referee");
  });

  it("keeps the host academy and the venue apart", () => {
    assert.equal(d.academy?.name, "Example Tennis Academy");
    assert.equal(d.academy?.website, "www.example-academy.test");
    assert.equal(d.academy?.postalCode, "501504");
    assert.equal(d.venue?.name, "Example Tennis Academy");
    assert.equal(d.venue?.address, "2-64, Near Sample Gardens,, Sampleville, Samplepura,");
    assert.equal(d.venue?.phone, "9000000003");
  });

  it("reads the travel and hotel blocks", () => {
    assert.deepEqual(d.travel, {
      airport: "Example International Airport",
      trainStation: "Example Junction Railway Station",
    });
    assert.equal(d.hotel?.name, "Example Tennis Academy");
    assert.equal(d.hotel?.distanceFromVenue, "Inside the venue");
    assert.deepEqual(d.hotel?.doublePrice, { amount: 3400, note: "Without Tax" });
    assert.equal(d.hotel?.breakfastIncluded, true);
    assert.equal(d.hotel?.contact, "Hotel Contact");
  });

  it("gives null for blocks the page does not have, not empty records", () => {
    const none = parseFactSheetDetails(FACT_SHEET_WITHOUT_SECTIONS);
    assert.equal(none.organisation, null);
    assert.equal(none.hotel, null);
    assert.equal(hasFactSheetDetails(none), false);
    assert.equal(hasFactSheetDetails(d), true);
  });
});
