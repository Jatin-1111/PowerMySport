import { Request, Response } from "express";
import { Booking } from "../../client/models/Booking";
import { Coach, IPayoutMethod } from "../../client/models/Coach";
import { Venue } from "../../client/models/Venue";
import { User } from "../../client/models/User";
import { Expert } from "../../client/models/ExpertProfile";
import { ExpertSession } from "../../client/models/ExpertBooking";
import { markSessionPayoutDone } from "../../client/services/ExpertsService";
import { sendPayoutProcessedEmail } from "../../utils/email";
import mongoose from "mongoose";

const getPrimaryPayoutMethod = (
  payoutMethods?: IPayoutMethod[],
): IPayoutMethod | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null;
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
      .select("expertId amount")
      .lean();

    if (expertSessions.length > 0) {
      const expertIds = [...new Set(expertSessions.map((s) => s.expertId.toString()))];
      const experts = await Expert.find({ _id: { $in: expertIds } })
        .select("userId")
        .lean();
      const expertUserIdByExpertId = new Map(
        experts.map((e) => [e._id.toString(), e.userId.toString()]),
      );

      for (const session of expertSessions) {
        const expertUserId = expertUserIdByExpertId.get(session.expertId.toString());
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
        current.totalPendingAmount += session.amount || 0;
        current.bookingIds.push(session._id.toString());
      }
    }

    const pendingPayouts = Array.from(payoutMap.values());

    // Populate vendor details and payout methods
    const populatedPayouts = await Promise.all(
      pendingPayouts.map(async (payout) => {
        const user = await User.findById(payout.vendorId).select("name email phone").lean();

        let payoutMethod: IPayoutMethod | null = null;
        if (payout.vendorRole === "Coach") {
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

        return {
          ...payout,
          vendorName: user?.name || "Unknown",
          vendorEmail: user?.email || "Unknown",
          vendorPhone: user?.phone || "Unknown",
          payoutMethod,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Pending payouts retrieved",
      data: populatedPayouts,
    });
  } catch (error) {
    console.error("listPendingPayouts error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load payouts",
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

    if (!vendorId || !vendorRole || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "vendorId, vendorRole, and an array of bookingIds are required",
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
          console.warn(
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
            "payments.status": "PENDING"
          },
          {
            $set: {
              "payments.$[elem].status": "PAID",
              "payments.$[elem].paidAt": now
            }
          },
          {
            arrayFilters: [
              { "elem.userId": vendorId, "elem.userType": vendorRole, "elem.status": "PENDING" }
            ],
            session
          }
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
          console.error("Failed to send payout email:", emailError);
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
    console.error("markPayoutsAsPaid error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to process payout",
    });
  }
};
