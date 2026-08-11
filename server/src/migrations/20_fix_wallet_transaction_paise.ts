import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Booking } from "../client/models/Booking";
import { BookingPaymentTransaction } from "../client/models/BookingPayment";
import {
  classifyAmount,
  nearlyEqual,
  toPaise,
} from "../utils/walletPaiseClassifier";

/**
 * Migration 20: Re-denominate historical wallet payment transactions to paise.
 *
 * BookingPaymentTransaction.amount is canonically PAISE — the PhonePe path
 * writes Math.round(rupees * 100), and every reader (RefundService,
 * timer.ts, scheduledJobs.ts) divides by 100 to get rupees back.
 *
 * payBookingWithWallet() stored the raw RUPEE figure instead, so every
 * wallet-paid booking has an amount 100x too small. Fixed forward in
 * bookingController.ts; this migration corrects the existing rows.
 *
 * HOW ROWS ARE CLASSIFIED
 * -----------------------
 * Magnitude alone cannot distinguish a ₹500 booking stored as 500 (rupees,
 * broken) from a ₹5 booking stored as 500 (paise, correct). So every row is
 * anchored against its parent Booking, which is the source of truth for the
 * rupee figure and is exactly what payBookingWithWallet() read:
 *
 *     expectedRupees = payments[] entry for this payer, else totalAmount
 *
 *   amount ≈ expectedRupees          -> RUPEES, convert (x100)
 *   amount ≈ expectedRupees * 100    -> already PAISE, skip
 *   neither                          -> UNCLASSIFIED, skip and report
 *
 * That makes the migration idempotent and safe to re-run: a converted row
 * classifies as already-PAISE on the second pass. Nothing is ever written on
 * a guess — anything that doesn't match the booking is reported, not touched.
 *
 * WHAT THIS MIGRATION DELIBERATELY DOES NOT FIX
 * ---------------------------------------------
 * `refundAmount` is left alone in all cases. Two of the three writers
 * (initiateBookingRefunds via buildRefundTargets, and the retry job in
 * scheduledJobs.ts) derive paise from booking.payments[] and were always
 * correct. The third — timer.ts expireOldBookings — passed the corrupt
 * transaction.amount straight to RefundService, which means PhonePe was
 * asked for, and the customer actually received, 1/100th of what they were
 * owed. Those are real cash shortfalls, not representation errors.
 *
 * Rewriting refundAmount there would erase the evidence of the shortfall and
 * make the books read as if the customer was made whole. So this migration
 * only REPORTS those rows (see the SHORTFALL section of the output) with the
 * outstanding balance per customer. They need a genuine top-up refund, which
 * is a finance decision and a money-moving action — not something a data
 * migration should do unattended.
 *
 * USAGE
 * -----
 *   npm run migrate:wallet-paise                 # dry run (default)
 *   npm run migrate:wallet-paise -- --apply      # write changes
 *   npm run migrate:wallet-paise -- --down --report=<file>   # roll back
 *
 * A dry run is the default because this writes to money records. Applying
 * emits a timestamped JSON report of every changed _id with before/after
 * values; `down()` consumes that report to revert precisely those rows
 * (it will not guess, because post-fix rows are indistinguishable from
 * migrated ones once converted).
 */

const WALLET_PREFIX = /^WALLET-/;

interface ChangedRow {
  transactionId: string;
  bookingId: string;
  merchantOrderId: string;
  before: number;
  after: number;
}

interface ShortfallRow {
  transactionId: string;
  bookingId: string;
  userId: string;
  refundState: string;
  refundedPaise: number;
  refundedRupees: number;
  owedRupees: number;
}

interface UnclassifiedRow {
  transactionId: string;
  bookingId: string;
  amount: number;
  expectedRupees: number | null;
  reason: string;
}

/**
 * The rupee figure payBookingWithWallet() would have charged this payer:
 * their own split entry if there is one, otherwise the full booking total.
 */
const expectedRupeesFor = (
  booking: { payments?: Array<{ userId: unknown; amount: number }> } & {
    totalAmount: number;
  },
  payerUserId: string,
): number => {
  const share = booking.payments?.find(
    (payment) => payment.userId?.toString() === payerUserId,
  );
  return share ? share.amount : booking.totalAmount;
};

export const up = async (options: { apply?: boolean } = {}) => {
  const apply = Boolean(options.apply);

  console.log(
    `Starting migration 20: wallet transaction paise re-denomination (${
      apply ? "APPLY" : "DRY RUN"
    })...`,
  );

  const transactions = await BookingPaymentTransaction.find({
    merchantOrderId: WALLET_PREFIX,
  }).sort({ createdAt: 1 });

  console.log(`Found ${transactions.length} wallet payment transactions.`);

  const changed: ChangedRow[] = [];
  const shortfalls: ShortfallRow[] = [];
  const unclassified: UnclassifiedRow[] = [];
  let alreadyPaise = 0;

  for (const transaction of transactions) {
    const transactionId = transaction._id.toString();
    const bookingId = transaction.bookingId?.toString() || "";
    const amount = transaction.amount;

    if (!bookingId) {
      unclassified.push({
        transactionId,
        bookingId: "",
        amount,
        expectedRupees: null,
        reason: "transaction has no bookingId — cannot anchor to a rupee value",
      });
      continue;
    }

    // The booking is the anchor. Without it there is no trustworthy way to
    // tell rupees from paise, so we refuse to touch the row.
    const booking = await Booking.findById(bookingId).select(
      "totalAmount payments",
    );

    if (!booking) {
      unclassified.push({
        transactionId,
        bookingId,
        amount,
        expectedRupees: null,
        reason: "parent booking not found (deleted?) — cannot verify unit",
      });
      continue;
    }

    const payerUserId = transaction.userId?.toString() || "";
    const expectedRupees = expectedRupeesFor(booking, payerUserId);

    const expectedPaise = toPaise(expectedRupees);
    const verdict = classifyAmount(amount, expectedRupees);

    if (verdict.kind === "UNCLASSIFIED") {
      unclassified.push({
        transactionId,
        bookingId,
        amount,
        expectedRupees,
        reason: verdict.reason,
      });
      continue;
    }

    if (verdict.kind === "ALREADY_PAISE") {
      // Written after the code fix, or already migrated. Idempotent no-op.
      alreadyPaise++;
    } else {
      changed.push({
        transactionId,
        bookingId,
        merchantOrderId: transaction.merchantOrderId,
        before: amount,
        after: verdict.correctedPaise,
      });

      if (apply) {
        transaction.amount = verdict.correctedPaise;
        await transaction.save();
      }
    }

    // Independently of the unit fix: did a refund already go out against the
    // corrupt amount? Only timer.ts could do that, and it refunded
    // transaction.amount/100 — i.e. rupees/100 — so the customer got 1/100th.
    // Detect by refundAmount sitting at the rupee magnitude rather than paise.
    if (
      transaction.refundState &&
      transaction.refundState !== "FAILED" &&
      typeof transaction.refundAmount === "number" &&
      transaction.refundAmount > 0 &&
      transaction.refundAmount < expectedPaise &&
      nearlyEqual(transaction.refundAmount, expectedRupees)
    ) {
      const refundedRupees = transaction.refundAmount / 100;
      shortfalls.push({
        transactionId,
        bookingId,
        userId: payerUserId,
        refundState: transaction.refundState,
        refundedPaise: transaction.refundAmount,
        refundedRupees,
        owedRupees: Math.round((expectedRupees - refundedRupees) * 100) / 100,
      });
    }
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`Rows needing conversion : ${changed.length}`);
  console.log(`Already in paise        : ${alreadyPaise}`);
  console.log(`Unclassified (skipped)  : ${unclassified.length}`);
  console.log("-".repeat(60));

  if (changed.length > 0) {
    console.log();
    console.log(apply ? "CONVERTED:" : "WOULD CONVERT:");
    for (const row of changed) {
      console.log(
        `  ${row.transactionId}  ${row.before} -> ${row.after} paise  (booking ${row.bookingId})`,
      );
    }
  }

  if (unclassified.length > 0) {
    console.log();
    console.log(
      "UNCLASSIFIED — left untouched, these need a human to look at them:",
    );
    for (const row of unclassified) {
      console.log(
        `  ${row.transactionId}  amount=${row.amount}  expected=${row.expectedRupees ?? "n/a"}  — ${row.reason}`,
      );
    }
  }

  if (shortfalls.length > 0) {
    const totalOwed = shortfalls.reduce((sum, row) => sum + row.owedRupees, 0);
    console.log();
    console.log("=".repeat(60));
    console.log(
      `SHORTFALL: ${shortfalls.length} customer(s) were under-refunded.`,
    );
    console.log(
      "These bookings expired unconfirmed and were auto-refunded through",
    );
    console.log(
      "timer.ts using the corrupt amount, so PhonePe actually paid out",
    );
    console.log(
      "1/100th of what was owed. This migration does NOT alter these rows —",
    );
    console.log(
      "refundAmount records what was really paid. They need a genuine",
    );
    console.log("top-up refund.");
    console.log("=".repeat(60));
    for (const row of shortfalls) {
      console.log(
        `  booking ${row.bookingId}  user ${row.userId}  refunded ₹${row.refundedRupees}  STILL OWED ₹${row.owedRupees}  (${row.refundState})`,
      );
    }
    console.log(
      `  TOTAL OUTSTANDING: ₹${Math.round(totalOwed * 100) / 100}`,
    );
  }

  if (apply && changed.length > 0) {
    // Post-conversion, a migrated row is indistinguishable from one written
    // correctly by the fixed code — so rollback needs an explicit record of
    // what this run touched rather than re-deriving it.
    const reportPath = path.join(
      process.cwd(),
      `migration-20-wallet-paise-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ changed, shortfalls, unclassified }, null, 2),
    );
    console.log();
    console.log(`Rollback report written to ${reportPath}`);
    console.log("Keep this file — down() requires it.");
  }

  if (!apply) {
    console.log();
    console.log("Dry run — nothing was written. Re-run with --apply to commit.");
  }

  console.log();
  console.log("Migration 20 completed.");

  return { changed, shortfalls, unclassified, alreadyPaise };
};

export const down = async (
  options: { reportPath?: string | undefined } = {},
) => {
  const { reportPath } = options;

  if (!reportPath) {
    throw new Error(
      "down() requires --report=<file> — the JSON report written by the --apply run. " +
        "Migrated rows cannot be told apart from correctly-written ones after conversion, " +
        "so rollback will not guess.",
    );
  }

  console.log(`Rolling back migration 20 using ${reportPath}...`);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
    changed: ChangedRow[];
  };

  let reverted = 0;
  let mismatched = 0;

  for (const row of report.changed) {
    const transaction = await BookingPaymentTransaction.findById(
      row.transactionId,
    );

    if (!transaction) {
      console.warn(`  transaction ${row.transactionId} no longer exists`);
      mismatched++;
      continue;
    }

    // Only revert if the row still holds exactly what we wrote — otherwise
    // something changed it since and we'd be clobbering newer data.
    if (transaction.amount !== row.after) {
      console.warn(
        `  transaction ${row.transactionId} is ${transaction.amount}, expected ${row.after} — changed since migration, skipping`,
      );
      mismatched++;
      continue;
    }

    transaction.amount = row.before;
    await transaction.save();
    reverted++;
  }

  console.log(`Reverted ${reverted} transaction(s) to their rupee values.`);
  if (mismatched > 0) {
    console.log(`Skipped ${mismatched} row(s) — see warnings above.`);
  }
  console.log(
    "Note: the code fix in bookingController.ts must also be reverted, or new " +
      "wallet payments will keep writing paise.",
  );
  console.log("Rollback completed.");
};

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/powermysport";

  const rollback = process.argv.includes("--down");
  const apply = process.argv.includes("--apply");
  const reportArg = process.argv.find((arg) => arg.startsWith("--report="));
  const reportPath = reportArg ? reportArg.slice("--report=".length) : undefined;

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      if (rollback) {
        await down({ reportPath });
      } else {
        await up({ apply });
      }
    })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
