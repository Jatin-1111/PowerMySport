import assert from "node:assert/strict";
import test from "node:test";
import { classifyAmount } from "../utils/walletPaiseClassifier";

test("a rupee-denominated row is flagged for conversion", () => {
  // ₹500 booking stored as 500 by the old payBookingWithWallet().
  const verdict = classifyAmount(500, 500);
  assert.deepEqual(verdict, { kind: "RUPEES", correctedPaise: 50000 });
});

test("a paise-denominated row is left alone", () => {
  // Same ₹500 booking, written correctly by the PhonePe path / fixed code.
  assert.deepEqual(classifyAmount(50000, 500), { kind: "ALREADY_PAISE" });
});

test("migration is idempotent — a converted row is not converted again", () => {
  const first = classifyAmount(500, 500);
  assert.equal(first.kind, "RUPEES");
  const corrected = (first as { correctedPaise: number }).correctedPaise;

  // Second pass over the same row must be a no-op, not another x100.
  assert.deepEqual(classifyAmount(corrected, 500), { kind: "ALREADY_PAISE" });
});

test("the ambiguous magnitude case is resolved by the booking anchor", () => {
  // 500 is a valid stored value for BOTH a ₹500 booking (rupees, broken) and
  // a ₹5 booking (paise, correct). Magnitude alone cannot tell them apart;
  // the expected rupee figure from the booking does.
  assert.deepEqual(classifyAmount(500, 500), {
    kind: "RUPEES",
    correctedPaise: 50000,
  });
  assert.deepEqual(classifyAmount(500, 5), { kind: "ALREADY_PAISE" });
});

test("fractional rupee amounts convert without float drift", () => {
  // Venue pricing produces 2-decimal rupee figures (Math.round(x*100)/100).
  assert.deepEqual(classifyAmount(1234.56, 1234.56), {
    kind: "RUPEES",
    correctedPaise: 123456,
  });
  assert.deepEqual(classifyAmount(0.1 + 0.2, 0.3), {
    kind: "RUPEES",
    correctedPaise: 30,
  });
});

test("sub-rupee amounts prefer the already-paise reading", () => {
  // For a ₹0.01 booking both candidates round to 1. Reading it as rupees
  // would inflate a correct row 100x — worse than the bug being fixed — so
  // the paise check has to win.
  assert.deepEqual(classifyAmount(1, 0.01), { kind: "ALREADY_PAISE" });
});

test("an amount matching neither reading is refused, not guessed", () => {
  // e.g. the booking total was edited after payment.
  const verdict = classifyAmount(777, 500);
  assert.equal(verdict.kind, "UNCLASSIFIED");
  assert.match(
    (verdict as { reason: string }).reason,
    /matches neither 500 \(rupees\) nor 50000 \(paise\)/,
  );
});

test("a zero or negative expected amount is refused", () => {
  // 0 === 0 * 100, so there is no anchor to classify against.
  for (const expected of [0, -100]) {
    const verdict = classifyAmount(0, expected);
    assert.equal(verdict.kind, "UNCLASSIFIED");
    assert.match((verdict as { reason: string }).reason, /nothing to anchor to/);
  }
});

test("non-finite input is refused", () => {
  assert.equal(classifyAmount(NaN, 500).kind, "UNCLASSIFIED");
  assert.equal(classifyAmount(500, Infinity).kind, "UNCLASSIFIED");
});
