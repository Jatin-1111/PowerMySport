import { Request, Response } from "express";
import type { PaymentUserType } from "@prisma/client";
import prisma from "../../lib/prisma";
import { markSessionPayoutDone } from "../../client/services/ExpertsService";
import { sendPayoutProcessedEmail } from "../../utils/email";

/**
 * Returns the default payout method (or the first one) from a list of payout
 * method rows. Works for coach/venue/expert payout methods (structurally
 * identical child tables).
 */
const getPrimaryPayoutMethod = <T extends { isDefault: boolean }>(
  payoutMethods?: T[],
): T | null => {
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
    // Find all completed bookings that carry pending payment legs for coaches
    // or venue listers. Payment legs are normalized into their own table, so we
    // filter on the relation and include the legs to iterate them.
    const bookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        payments: {
          some: {
            status: "PENDING",
            userType: { in: ["VenueLister", "Coach"] },
          },
        },
      },
      include: { payments: true },
    });

    const payoutMap = new Map<string, any>();

    bookings.forEach((booking) => {
      booking.payments.forEach((payment) => {
        if (
          payment.status === "PENDING" &&
          (payment.userType === "VenueLister" || payment.userType === "Coach")
        ) {
          const userIdStr = payment.userId;
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
          current.bookingIds.push(booking.id);
        }
      });
    });

    // Expert sessions carry their payout owed directly on the session
    // (no nested payments array like Booking), so they're gathered separately.
    const expertSessions = await prisma.expertSession.findMany({
      where: {
        status: "COMPLETED",
        paymentStatus: "COMPLETED",
        payoutStatus: "PENDING",
      },
      select: { id: true, expertId: true, amount: true },
    });

    if (expertSessions.length > 0) {
      const expertIds = [...new Set(expertSessions.map((s) => s.expertId))];
      const experts = await prisma.expert.findMany({
        where: { id: { in: expertIds } },
        select: { id: true, userId: true },
      });
      const expertUserIdByExpertId = new Map(
        experts.map((e) => [e.id, e.userId]),
      );

      for (const session of expertSessions) {
        const expertUserId = expertUserIdByExpertId.get(session.expertId);
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
        current.bookingIds.push(session.id);
      }
    }

    const pendingPayouts = Array.from(payoutMap.values());

    // Populate vendor details and payout methods
    const populatedPayouts = await Promise.all(
      pendingPayouts.map(async (payout) => {
        const user = await prisma.user.findUnique({
          where: { id: payout.vendorId },
          select: { name: true, email: true, phone: true },
        });

        let payoutMethod: {
          isDefault: boolean;
          [key: string]: unknown;
        } | null = null;
        if (payout.vendorRole === "Coach") {
          const coach = await prisma.coach.findFirst({
            where: { userId: payout.vendorId },
            select: { payoutMethods: true },
          });
          payoutMethod = getPrimaryPayoutMethod(coach?.payoutMethods);
        } else if (payout.vendorRole === "VenueLister") {
          const venue = await prisma.venue.findFirst({
            where: { ownerId: payout.vendorId },
            select: { payoutMethods: true },
          });
          payoutMethod = getPrimaryPayoutMethod(venue?.payoutMethods);
        } else if (payout.vendorRole === "Expert") {
          const expert = await prisma.expert.findFirst({
            where: { userId: payout.vendorId },
            select: { payoutMethods: true },
          });
          payoutMethod = getPrimaryPayoutMethod(expert?.payoutMethods);
        }

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
    console.error("listPendingPayouts error:", error);
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

    const now = new Date();

    // Release the pending payment legs for the given bookings inside a single
    // transaction. Each booking must be COMPLETED (guard preserved from the
    // Mongo arrayFilters query) and only legs owned by this vendor/role that are
    // still PENDING are flipped to PAID.
    const updatedCount = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const bookingId of bookingIds) {
        const booking = await tx.booking.findFirst({
          where: { id: bookingId, status: "COMPLETED" },
          select: { id: true },
        });
        if (!booking) {
          continue;
        }

        const result = await tx.bookingPaymentLeg.updateMany({
          where: {
            bookingId,
            userId: vendorId,
            userType: vendorRole as PaymentUserType,
            status: "PENDING",
          },
          data: {
            status: "PAID",
            paidAt: now,
          },
        });

        if (result.count > 0) {
          count++;
        }
      }

      return count;
    });

    // Notify the vendor of the payout (fire-and-forget).
    void (async () => {
      try {
        const vendorUser = await prisma.user.findUnique({
          where: { id: vendorId },
          select: { name: true, email: true },
        });
        if (vendorUser?.email) {
          const paidBookings = await prisma.booking.findMany({
            where: { id: { in: bookingIds } },
            include: { payments: true },
          });
          let total = 0;
          for (const b of paidBookings) {
            for (const p of b.payments || []) {
              if (
                p.userId === vendorId &&
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
  } catch (error) {
    console.error("markPayoutsAsPaid error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process payout",
    });
  }
};
