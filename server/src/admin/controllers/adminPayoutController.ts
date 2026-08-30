import { Request, Response } from "express";
import { Booking } from "../../client/models/Booking";
import { Coach, IPayoutMethod } from "../../client/models/Coach";
import { Venue } from "../../client/models/Venue";
import { User } from "../../client/models/User";
import { Expert } from "../../client/models/ExpertProfile";
import { ExpertSession } from "../../client/models/ExpertBooking";
import { markSessionPayoutDone } from "../../client/services/ExpertsService";
import { CoachSessionOccurrence } from "../../client/models/CoachSessionOccurrence";
import { markPayoutPaid } from "../../client/services/CoachSessionLifecycleService";
import { sendPayoutProcessedEmail } from "../../utils/email";
import { decryptValue } from "../../shared/utils/encryption";
import mongoose from "mongoose";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("adminPayout");

const decryptPayoutMethod = (m: IPayoutMethod): IPayoutMethod => {
  const out: IPayoutMethod = { ...m };
  if (out.accountNumber) out.accountNumber = decryptValue(out.accountNumber);
  if (out.ifscCode) out.ifscCode = decryptValue(out.ifscCode);
  if (out.upiId) out.upiId = decryptValue(out.upiId);
  return out;
};

const getPrimaryPayoutMethod = (
  payoutMethods?: IPayoutMethod[],
): IPayoutMethod | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return (
    payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null
  );
};

/**
 * Admin: Get all pending payouts grouped by vendor
 * GET /api/admin/payouts/pending
 */
export const listPendingPayouts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Find all completed bookings with pending payments for coaches or venue listers
    const bookings = await Booking.find({
      status: "COMPLETED",
      "payments.status": "PENDING",
      "payments.userType": { $in: ["VenueLister", "Coach"] },
    }).lean();

    const payoutMap = new Map<string, any>();

    bookings.forEach((booking) => {
      booking.payments.forEach((payment) => {
        if (
          payment.status === "PENDING" &&
          (payment.userType === "VenueLister" || payment.userType === "Coach")
        ) {
          const userIdStr = payment.userId.toString();
          const key = `${userIdStr}_${payment.userType}`;

          if (!payoutMap.has(key)) {
            payoutMap.set(key, {
              vendorId: userIdStr,
              vendorRole: payment.userType,
              totalPendingAmount: 0,
              bookingIds: [],
            });
          }

          const current = payoutMap.get(key)!;
          current.totalPendingAmount += payment.amount;
          current.bookingIds.push(booking._id.toString());
        }
      });
    });

    // Expert sessions carry their payout owed directly on the session
    // (no nested payments array like Booking), so they're gathered separately.
    const expertSessions = await ExpertSession.find({
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
      payoutStatus: "PENDING",
    })
      .select("expertId amount payoutNetAmount")
      .lean();

    if (expertSessions.length > 0) {
      const expertIds = [
        ...new Set(expertSessions.map((s) => s.expertId.toString())),
      ];
      const experts = await Expert.find({ _id: { $in: expertIds } })
        .select("userId")
        .lean();
      const expertUserIdByExpertId = new Map(
        experts.map((e) => [e._id.toString(), e.userId.toString()]),
      );

      for (const session of expertSessions) {
        const expertUserId = expertUserIdByExpertId.get(
          session.expertId.toString(),
        );
        if (!expertUserId) continue;
        const key = `${expertUserId}_Expert`;
        if (!payoutMap.has(key)) {
          payoutMap.set(key, {
            vendorId: expertUserId,
            vendorRole: "Expert",
            totalPendingAmount: 0,
            bookingIds: [],
          });
        }
        const current = payoutMap.get(key)!;
        // The NET, after the platform's commission and its GST. Sessions
        // completed before commission existed have no net recorded, so they
        // fall back to the gross they were promised at the time.
        current.totalPendingAmount +=
          session.payoutNetAmount ?? session.amount ?? 0;
        current.bookingIds.push(session._id.toString());
      }
    }

    // Recurring-coaching payouts are earned per delivered session and live on
    // the occurrence, not in a booking's payments array.
    //
    // They get their OWN vendorRole rather than joining the `_Coach` bucket:
    // that bucket's ids are booking ids, and mark-paid resolves them as such.
    // Mixing occurrence ids in would make it try to pay a booking that does not
    // exist — silently, since it filters by id.
    //
    // Only RELEASED is listed. PENDING means the 24h hold since delivery has
    // not elapsed, and paying it early would pay for a session a student may
    // still dispute.
    const sessionPayouts = await CoachSessionOccurrence.find({
      status: "COMPLETED",
      "payout.status": "RELEASED",
    })
      .select("coachId payout.amountPaise")
      .lean();

    if (sessionPayouts.length > 0) {
      const coachIds = [
        ...new Set(sessionPayouts.map((s) => s.coachId.toString())),
      ];
      const coaches = await Coach.find({ _id: { $in: coachIds } })
        .select("userId")
        .lean();
      const coachUserIdByCoachId = new Map(
        coaches.map((c) => [c._id.toString(), c.userId.toString()]),
      );

      for (const occurrence of sessionPayouts) {
        const coachUserId = coachUserIdByCoachId.get(
          occurrence.coachId.toString(),
        );
        if (!coachUserId) continue;

        const key = `${coachUserId}_CoachSession`;
        if (!payoutMap.has(key)) {
          payoutMap.set(key, {
            vendorId: coachUserId,
            vendorRole: "CoachSession",
            totalPendingAmount: 0,
            bookingIds: [],
          });
        }
        const current = payoutMap.get(key)!;
        // Everything else in this map is rupees; session payouts are stored in
        // paise, so convert rather than adding two different units together.
        current.totalPendingAmount +=
          (occurrence.payout?.amountPaise ?? 0) / 100;
        current.bookingIds.push(occurrence._id.toString());
      }
    }

    const pendingPayouts = Array.from(payoutMap.values());

    // Populate vendor details and payout methods
    const populatedPayouts = await Promise.all(
      pendingPayouts.map(async (payout) => {
        const user = await User.findById(payout.vendorId)
          .select("name email phone")
          .lean();

        let payoutMethod: IPayoutMethod | null = null;
        if (payout.vendorRole === "Coach") {
          const coach = await Coach.findOne({ userId: payout.vendorId })
            .select("payoutMethods")
            .lean();
          payoutMethod = getPrimaryPayoutMethod(
            coach?.payoutMethods as IPayoutMethod[] | undefined,
          );
        } else if (payout.vendorRole === "CoachSession") {
          const coach = await Coach.findOne({ userId: payout.vendorId })
            .select("payoutMethods")
            .lean();
          payoutMethod = getPrimaryPayoutMethod(
            coach?.payoutMethods as IPayoutMethod[] | undefined,
          );
        } else if (payout.vendorRole === "VenueLister") {
          const venue = await Venue.findOne({ ownerId: payout.vendorId })
            .select("payoutMethods")
            .lean();
          payoutMethod = getPrimaryPayoutMethod(
            venue?.payoutMethods as IPayoutMethod[] | undefined,
          );
        } else if (payout.vendorRole === "Expert") {
          const expert = await Expert.findOne({ userId: payout.vendorId })
            .select("payoutMethods")
            .lean();
          payoutMethod = getPrimaryPayoutMethod(
            expert?.payoutMethods as unknown as IPayoutMethod[] | undefined,
          );
        }
        // .lean() bypasses the models' schema-level decrypt getters — admin
        // needs the real, unmasked value here to actually process the payout.
        if (payoutMethod) payoutMethod = decryptPayoutMethod(payoutMethod);

        return {
          ...payout,
          vendorName: user?.name || "Unknown",
          vendorEmail: user?.email || "Unknown",
          vendorPhone: user?.phone || "Unknown",
          payoutMethod,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Pending payouts retrieved",
      data: populatedPayouts,
    });
  } catch (error) {
    log.error("listPendingPayouts error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load payouts",
    });
  }
};

/**
 * Admin: Mark a vendor's pending payouts as paid
 * POST /api/admin/payouts/mark-paid
 */
export const markPayoutsAsPaid = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { vendorId, vendorRole, bookingIds } = req.body;

    if (
      !vendorId ||
      !vendorRole ||
      !Array.isArray(bookingIds) ||
      bookingIds.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "vendorId, vendorRole, and an array of bookingIds are required",
      });
      return;
    }

    // Expert session payouts live directly on ExpertSession (no nested payments
    // array), so they're released one at a time via the same guarded service
    // function the per-session admin/auto-release paths use.
    if (vendorRole === "Expert") {
      let updatedCount = 0;
      for (const sessionId of bookingIds) {
        try {
          await markSessionPayoutDone(sessionId);
          updatedCount++;
        } catch (err) {
          log.warn(
            `Skipping expert payout for session ${sessionId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      res.status(200).json({
        success: true,
        message: `Successfully marked ${updatedCount} expert session payout(s) as PAID.`,
      });
      return;
    }

    // Coaching-session payouts live on the occurrence and are released one at
    // a time through the guarded service function, which refuses anything not
    // in RELEASED — so a stale id from an old page load cannot pay twice.
    if (vendorRole === "CoachSession") {
      let updatedCount = 0;
      for (const occurrenceId of bookingIds) {
        try {
          await markPayoutPaid({
            occurrenceId: new mongoose.Types.ObjectId(String(occurrenceId)),
          });
          updatedCount++;
        } catch (err) {
          log.warn(
            `Skipping coach session payout for ${occurrenceId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      res.status(200).json({
        success: true,
        message: `Successfully marked ${updatedCount} coaching session payout(s) as PAID.`,
      });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const now = new Date();
      let updatedCount = 0;

      for (const bookingId of bookingIds) {
        const result = await Booking.updateOne(
          {
            _id: bookingId,
            status: "COMPLETED",
            "payments.userId": vendorId,
            "payments.userType": vendorRole,
            "payments.status": "PENDING",
          },
          {
            $set: {
              "payments.$[elem].status": "PAID",
              "payments.$[elem].paidAt": now,
            },
          },
          {
            arrayFilters: [
              {
                "elem.userId": vendorId,
                "elem.userType": vendorRole,
                "elem.status": "PENDING",
              },
            ],
            session,
          },
        );

        if (result.modifiedCount > 0) {
          updatedCount++;
        }
      }

      await session.commitTransaction();

      // Notify the vendor of the payout (fire-and-forget).
      void (async () => {
        try {
          const vendorUser = await User.findById(vendorId)
            .select("name email")
            .lean();
          if (vendorUser?.email) {
            const paidBookings = await Booking.find({
              _id: { $in: bookingIds },
            })
              .select("payments")
              .lean();
            let total = 0;
            for (const b of paidBookings) {
              for (const p of b.payments || []) {
                if (
                  p.userId?.toString() === vendorId &&
                  p.userType === vendorRole &&
                  p.status === "PAID"
                ) {
                  total += p.amount || 0;
                }
              }
            }
            await sendPayoutProcessedEmail({
              name: vendorUser.name,
              email: vendorUser.email,
              amount: total,
              bookingCount: bookingIds.length,
              role: vendorRole as "Coach" | "VenueLister",
            });
          }
        } catch (emailError) {
          log.error("Failed to send payout email:", emailError);
        }
      })();

      res.status(200).json({
        success: true,
        message: `Successfully marked ${updatedCount} booking payments as PAID.`,
      });
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    log.error("markPayoutsAsPaid error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process payout",
    });
  }
};
