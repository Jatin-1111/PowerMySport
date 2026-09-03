import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMISSION_GST_RATE,
  COMMISSION_RATE,
  commissionAdjustmentForRefund,
  commissionOn,
  commissionOnRetained,
} from "../client/services/CommissionService";

/**
 * The platform's commission, checked against the Partner Terms it implements.
 *
 * The worked example in those terms is a published promise to every partner, so
 * it is pinned here literally: if this test fails, the platform is paying
 * something other than what it told people it would pay.
 */

test("the published worked example reproduces exactly", () => {
  // Partner Terms: 1000.00 fee - 150.00 commission - 27.00 GST = 823.00 net.
  const result = commissionOn(100_000);

  assert.equal(result.commissionPaise, 15_000);
  assert.equal(result.gstOnCommissionPaise, 2_700);
  assert.equal(result.netPayablePaise, 82_300);
});

test("the defined rates are 15% and 18%", () => {
  assert.equal(COMMISSION_RATE, 0.15);
  assert.equal(COMMISSION_GST_RATE, 0.18);
});

test("one rate applies to every role", () => {
  // There is a single rate by design, so this is really asserting that no
  // per-role knob has crept back in: the same fee must cost the same
  // commission whichever kind of partner earned it.
  const fee = 100_000;
  assert.equal(commissionOn(fee).commissionPaise, 15_000);
  assert.equal(commissionOn(fee).rate, COMMISSION_RATE);
});

test("commission, GST and net always reconstruct the fee exactly", () => {
  // Net is derived by subtraction rather than its own rounding, so no paisa can
  // appear or vanish between the partner's statement and the platform's books.
  for (const fee of [1, 7, 99, 100, 4_999, 100_000, 123_457, 999_999]) {
    const r = commissionOn(fee);
    assert.equal(
      r.commissionPaise + r.gstOnCommissionPaise + r.netPayablePaise,
      fee,
      `the split of ${fee} paise did not reconstruct`
    );
  }
});

test("a partner is never left owing money on a tiny fee", () => {
  for (const fee of [0, 1, 2, 3, 10]) {
    const r = commissionOn(fee);
    assert.ok(r.netPayablePaise >= 0, `net went negative at ${fee} paise`);
  }
});

test("a zero fee costs nothing", () => {
  const r = commissionOn(0);
  assert.equal(r.commissionPaise, 0);
  assert.equal(r.gstOnCommissionPaise, 0);
  assert.equal(r.netPayablePaise, 0);
});

test("commission refuses fractional paise rather than rounding silently", () => {
  assert.throws(() => commissionOn(100.5), /whole paise/);
});

test("commission refuses a negative fee", () => {
  assert.throws(() => commissionOn(-1), /non-negative/);
});

// ───────────────── refunds ─────────────────

test("a fully refunded transaction is charged NO commission", () => {
  // The terms say this outright. A proportional calculation would still leave a
  // few paise of commission on a cancelled booking, which is not what was
  // promised.
  const r = commissionOnRetained({
    originalFeePaise: 100_000,
    refundedPaise: 100_000,
  });

  assert.equal(r.commissionPaise, 0);
  assert.equal(r.gstOnCommissionPaise, 0);
});

test("a partial refund recomputes commission on the retained amount", () => {
  // 1000 charged, 400 refunded -> commission is on the 600 retained.
  const r = commissionOnRetained({
    originalFeePaise: 100_000,
    refundedPaise: 40_000,
  });

  assert.equal(r.partnerFeePaise, 60_000);
  assert.equal(r.commissionPaise, 9_000);
  assert.equal(r.gstOnCommissionPaise, 1_620);
});

test("the platform hands back the commission it over-collected", () => {
  const adjustment = commissionAdjustmentForRefund({
    originalFeePaise: 100_000,
    refundedPaise: 40_000,
  });

  // Charged 15000 + 2700 on the full fee; owes 9000 + 1620 on the retained.
  assert.equal(adjustment.refundToPartnerPaise, 15_000 + 2_700 - 9_000 - 1_620);
});

test("a full refund returns the whole commission", () => {
  const adjustment = commissionAdjustmentForRefund({
    originalFeePaise: 100_000,
    refundedPaise: 100_000,
  });

  assert.equal(adjustment.refundToPartnerPaise, 17_700);
});

test("refunding more than was charged does not invent a debt", () => {
  const adjustment = commissionAdjustmentForRefund({
    originalFeePaise: 100_000,
    refundedPaise: 150_000,
  });

  assert.equal(adjustment.after.partnerFeePaise, 0);
  assert.ok(adjustment.refundToPartnerPaise >= 0);
});
