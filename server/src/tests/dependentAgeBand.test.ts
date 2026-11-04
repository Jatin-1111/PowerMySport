import assert from "node:assert/strict";
import test from "node:test";

import { ageBandFor } from "../community/services/dependentSummary";

/**
 * The age band shown on a community profile.
 *
 * This is the only number about somebody's child that the platform publishes to
 * strangers, and it is published in the vocabulary of that child's own
 * federation — a tennis parent reads U-14 and a badminton parent reads U-15 for
 * the SAME thirteen-year-old. Getting it wrong is not a rounding error, it is
 * telling a parent their child competes in a category that does not exist.
 *
 * The ladders themselves still want a review pass per sport. These tests pin the
 * ones we are confident about and, more importantly, pin the rules that must
 * hold whatever the ladders turn out to be.
 */

test("a band is the smallest cut-off the child is still under", () => {
  // AITA runs tennis at U-12/14/16/18. A thirteen-year-old is under 14.
  assert.equal(ageBandFor(13, "Tennis"), "U-14");
  // ...and a fourteen-year-old is not, so they move up.
  assert.equal(ageBandFor(14, "Tennis"), "U-16");
  assert.equal(ageBandFor(11, "Tennis"), "U-12");
});

test("the same child reads differently in a sport with a different ladder", () => {
  // BAI runs badminton at U-13/15/17/19. This is the whole reason the ladder is
  // per-sport rather than one constant.
  assert.equal(ageBandFor(13, "Badminton"), "U-15");
  assert.equal(ageBandFor(13, "Tennis"), "U-14");
});

test("sport names match however they are spelled", () => {
  // `sportsFocus` is free text a parent typed or a wizard wrote, so the casing
  // and separators are whatever they happened to be.
  assert.equal(ageBandFor(12, "Table Tennis"), "U-13");
  assert.equal(ageBandFor(12, "table-tennis"), "U-13");
  assert.equal(ageBandFor(12, "TABLE TENNIS"), "U-13");
});

test("ladders with an unusual top band keep it", () => {
  // Cricket tops out at U-19 and athletics at U-20, which is exactly the tail a
  // generic U-18 ladder gets wrong.
  assert.equal(ageBandFor(17, "Cricket"), "U-19");
  assert.equal(ageBandFor(19, "Athletics"), "U-20");
});

test("an unclassified sport still gets a sensible band rather than nothing", () => {
  assert.equal(ageBandFor(13, "Underwater Hockey"), "U-14");
  assert.equal(ageBandFor(13, null), "U-14");
});

test("a child past every junior band is a senior, not a wrong band", () => {
  assert.equal(ageBandFor(18, "Tennis"), "Senior");
  assert.equal(ageBandFor(20, "Badminton"), "Senior");
});

test("an unknown age produces no band at all", () => {
  // A band is the only number on the card. An invented one is worse than a
  // missing one, so every unusable input has to fall through to null rather
  // than to a default band.
  assert.equal(ageBandFor(null, "Tennis"), null);
  assert.equal(ageBandFor(undefined, "Tennis"), null);
  assert.equal(ageBandFor(0, "Tennis"), null);
  assert.equal(ageBandFor(-3, "Tennis"), null);
  assert.equal(ageBandFor(Number.NaN, "Tennis"), null);
  // Far past any junior category — almost certainly a typo in the age field
  // rather than a real athlete, and "Senior" would dress it up as a fact.
  assert.equal(ageBandFor(140, "Tennis"), null);
});
