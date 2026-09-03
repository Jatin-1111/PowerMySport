import mongoose from "mongoose";
import { Booking, BookingDocument } from "../../models/Booking";
import { Coach } from "../../models/Coach";
import { User } from "../../models/User";
import { Venue } from "../../models/Venue";
import friendService from "../FriendService";
import BookingInvitation from "../../models/BookingInvitation";
import { sendBookingInvitationEmail } from "../../../utils/email";
import { calculateGroupPaymentSplits } from "../../../utils/payment";
import { recordBookingEventFor } from "../BookingEventService";
import { NotificationService } from "../NotificationService";
import { log, toPaise, type InitiateBookingPayload, type InitiateBookingResponse } from "./shared";
import { initiateBooking } from "./creation";

// ============================================
// GROUP BOOKING FUNCTIONS
// ============================================

export interface InitiateGroupBookingPayload extends InitiateBookingPayload {
  invitedFriendIds: string[];
  paymentType: "SINGLE" | "SPLIT";
}

/**
 * Initiate a group booking with friends
 */
export const initiateGroupBooking = async (
  payload: InitiateGroupBookingPayload
): Promise<InitiateBookingResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate friend list
    if (!payload.invitedFriendIds || payload.invitedFriendIds.length === 0) {
      throw new Error("At least one friend must be invited for group booking");
    }

    // Verify all invitees are accepted friends
    for (const friendId of payload.invitedFriendIds) {
      const areFriends = await friendService.areFriends(payload.userId, friendId);
      if (!areFriends) {
        const friendUser = await User.findById(friendId);
        throw new Error(`${friendUser?.name || "User"} is not your friend`);
      }
    }

    // Fetch invitee details (Parent counts as a Player here too, preserving
    // existing behavior from when both shared role:"Player")
    const invitees = await User.find({
      _id: { $in: payload.invitedFriendIds },
      role: { $in: ["Player", "Parent"] },
    });

    if (invitees.length !== payload.invitedFriendIds.length) {
      throw new Error("Some invited users are not valid players");
    }

    // Create the base booking using the standard flow
    const baseBookingResult = await initiateBooking(payload);
    const booking = baseBookingResult.booking;

    // Convert to group booking
    booking.bookingType = "GROUP";
    booking.organizerId = new mongoose.Types.ObjectId(payload.userId);
    booking.paymentType = payload.paymentType;
    booking.splitMethod = "EQUAL";

    // Set status to pending invites
    booking.status = "PENDING_INVITES";

    // Add organizer as first participant (auto-accepted)
    const organizer = await User.findById(payload.userId);
    if (!organizer) {
      throw new Error("Organizer not found");
    }

    booking.participants = [
      {
        userId: new mongoose.Types.ObjectId(payload.userId),
        name: organizer.name,
        status: "ACCEPTED",
        invitedAt: new Date(),
        respondedAt: new Date(),
      },
    ];

    // Add invited friends as participants
    for (const invitee of invitees) {
      booking.participants.push({
        userId: invitee._id as mongoose.Types.ObjectId,
        name: invitee.name,
        status: "INVITED",
        invitedAt: new Date(),
      });
    }

    // Calculate payment splits if split payment
    if (payload.paymentType === "SPLIT") {
      // Get venue and coach info for payments
      let venueOwnerId: string | undefined;
      let venuePrice = 0;
      let coachUserId: string | undefined;
      let coachPrice = 0;

      if (booking.venueId) {
        const venue = await Venue.findById(booking.venueId).populate("ownerId");
        if (venue && venue.ownerId) {
          venueOwnerId = (venue.ownerId as any)._id.toString();
          // Calculate venue price from booking
          const subtotal =
            booking.totalAmount -
            (booking.serviceFee || 0) -
            (booking.taxAmount || 0) +
            (booking.discountAmount || 0);
          if (booking.coachId) {
            const coach = await Coach.findById(booking.coachId).populate("userId");
            if (coach && coach.userId) {
              coachUserId = (coach.userId as any)._id.toString();
              // Rough estimation: split subtotal proportionally
              // This is simplified; in production you'd track exact venue/coach prices
              venuePrice = Math.round(subtotal * 0.6); // Assume 60% venue
              coachPrice = subtotal - venuePrice;
            }
          } else {
            venuePrice = subtotal;
          }
        }
      }

      // All participants (including organizer)
      const allParticipantIds = [payload.userId, ...payload.invitedFriendIds];

      if (venueOwnerId) {
        const paymentSplits = calculateGroupPaymentSplits(
          booking.totalAmount,
          venuePrice,
          venueOwnerId,
          allParticipantIds,
          coachPrice > 0 ? coachPrice : undefined,
          coachUserId
        );

        // Convert IPayment[] to BookingPayment[] (string userId to ObjectId)
        booking.payments = paymentSplits.map((payment) => ({
          ...payment,
          userId: new mongoose.Types.ObjectId(payment.userId),
        }));
      }
    } else {
      // Single payment - organizer pays everything
      // Keep existing payment structure (venue + optional coach)
    }

    await booking.save({ session });

    // Create booking invitations
    const invitations = invitees.map((invitee) => ({
      bookingId: booking._id,
      inviterId: new mongoose.Types.ObjectId(payload.userId),
      inviteeId: invitee._id,
      venueId: booking.venueId,
      ...(booking.coachId ? { coachId: booking.coachId } : {}),
      sport: booking.sport,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      estimatedAmount:
        payload.paymentType === "SPLIT"
          ? Math.round((booking.totalAmount / (invitees.length + 1)) * 100) / 100
          : 0,
      status: "PENDING",
    }));

    const insertedInvitations = await BookingInvitation.insertMany(invitations, { session });

    // Send invitation emails/notifications
    const venue = await Venue.findById(booking.venueId).session(session);
    const inviter = await User.findById(payload.userId).session(session);

    if (venue && inviter) {
      // Send emails to all invitees (async, don't wait)
      for (const invitee of invitees) {
        const invitation = insertedInvitations.find(
          (inv) => inv.inviteeId.toString() === invitee._id.toString()
        );
        if (invitation) {
          sendBookingInvitationEmail({
            inviteeName: invitee.name,
            inviteeEmail: invitee.email,
            inviterName: inviter.name,
            venueName: venue.name,
            sport: booking.sport,
            date: booking.date.toISOString(),
            startTime: booking.startTime,
            endTime: booking.endTime,
            estimatedAmount: invitation.estimatedAmount,
          }).catch((err: Error) =>
            log.error(`Failed to send booking invitation email to ${invitee.email}:`, err)
          );

          // Send real-time notification
          NotificationService.send({
            userId: invitee._id.toString(),
            type: "BOOKING_INVITATION",
            title: "New Booking Invitation",
            message: `${inviter.name} invited you to play ${booking.sport} at ${venue.name}`,
            data: {
              bookingId: booking._id.toString(),
              organizerId: payload.userId,
              organizerName: inviter.name,
              venueName: venue.name,
              sport: booking.sport,
              date: booking.date.toISOString(),
              startTime: booking.startTime,
              endTime: booking.endTime,
              estimatedAmount: invitation.estimatedAmount,
            },
          }).catch((err: Error) =>
            log.error(`Failed to send booking invitation notification to ${invitee._id}:`, err)
          );
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Recorded after commit — initiateBooking already logged CREATED, so this
    // captures the conversion to a group booking and who was invited.
    await recordBookingEventFor(booking, {
      type: "INVITE_SENT",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: payload.userId,
      channel: "CLIENT_WEB",
      amountPaise: toPaise(booking.totalAmount),
      summary: `Group booking — ${invitees.length} invitation(s) sent, ${payload.paymentType} payment`,
      metadata: {
        bookingType: "GROUP",
        paymentType: payload.paymentType,
        splitMethod: booking.splitMethod,
        inviteeIds: invitees.map((invitee) => invitee._id.toString()),
        inviteeCount: invitees.length,
      },
    });

    return { booking };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(
      `Failed to initiate group booking: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Respond to a booking invitation (accept or decline)
 */
export const respondToBookingInvitation = async (
  userId: string,
  invitationId: string,
  accept: boolean
): Promise<BookingDocument> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invitation = await BookingInvitation.findById(invitationId).session(session);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.inviteeId.toString() !== userId) {
      throw new Error("Not authorized to respond to this invitation");
    }

    if (invitation.status !== "PENDING") {
      throw new Error("Invitation has already been responded to");
    }

    // Update invitation status
    invitation.status = accept ? "ACCEPTED" : "DECLINED";
    invitation.respondedAt = new Date();
    await invitation.save({ session });

    // Update booking participant status
    const booking = await Booking.findById(invitation.bookingId).session(session);
    if (!booking) {
      throw new Error("Booking not found");
    }

    const participant = booking.participants.find((p) => p.userId.toString() === userId);

    if (!participant) {
      throw new Error("Participant not found in booking");
    }

    participant.status = accept ? "ACCEPTED" : "DECLINED";
    participant.respondedAt = new Date();

    // If declined and payment is split, recalculate payments
    if (!accept && booking.paymentType === "SPLIT") {
      // Remove this user's payment
      booking.payments = booking.payments.filter(
        (p) => p.userId.toString() !== userId || p.userType !== "Player"
      );

      // Recalculate split among remaining accepted participants
      const acceptedParticipants = booking.participants.filter((p) => p.status === "ACCEPTED");

      if (acceptedParticipants.length > 0) {
        const playerPayments = booking.payments.filter((p) => p.userType === "Player");
        const totalPlayerAmount = playerPayments.reduce((sum, p) => sum + p.amount, 0);

        // Redistribute total among accepted participants
        const amountPerPerson =
          Math.round((totalPlayerAmount / acceptedParticipants.length) * 100) / 100;
        const sumOfSplits = amountPerPerson * (acceptedParticipants.length - 1);
        const lastPersonAmount = Math.round((totalPlayerAmount - sumOfSplits) * 100) / 100;

        // Update player payments
        const nonPlayerPayments = booking.payments.filter((p) => p.userType !== "Player");
        booking.payments = [
          ...nonPlayerPayments,
          ...acceptedParticipants.map((p, index) => ({
            userId: p.userId,
            userType: "Player" as const,
            amount: index === acceptedParticipants.length - 1 ? lastPersonAmount : amountPerPerson,
            status: "PENDING" as const,
          })),
        ];
      }
    }

    // Check if all invitations have been responded to
    const allInvitations = await BookingInvitation.find({
      bookingId: booking._id,
    }).session(session);

    const allResponded = allInvitations.every((inv: any) => inv.status !== "PENDING");

    const anyAccepted = booking.participants.some(
      (p) => p.status === "ACCEPTED" && p.userId.toString() !== booking.organizerId.toString()
    );

    const statusBeforeResponse = booking.status;

    // Update booking status if all have responded
    if (allResponded) {
      if (anyAccepted || booking.participants.length === 1) {
        // At least one person accepted, or organizer booking alone after declines
        booking.status = "AWAITING_PAYMENT";
      } else {
        // Everyone declined
        booking.status = "CANCELLED";
        booking.cancelledAt = new Date();
        booking.cancellationReason = "All invitations declined";
      }
    }

    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    await recordBookingEventFor(booking, {
      type: "INVITE_RESPONDED",
      fromStatus: statusBeforeResponse,
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: userId,
      channel: "CLIENT_WEB",
      summary: `Invitee ${accept ? "accepted" : "declined"} the group booking invitation${
        allResponded ? " — all invitations now resolved" : ""
      }`,
      metadata: {
        invitationId,
        accepted: accept,
        allResponded,
        anyAccepted,
        // A decline on a SPLIT booking redistributes everyone's share, so the
        // resulting split is worth capturing at the moment it changed.
        ...(!accept && booking.paymentType === "SPLIT"
          ? {
              redistributedSplit: booking.payments
                .filter((payment) => payment.userType === "Player")
                .map((payment) => ({
                  userId: payment.userId.toString(),
                  amountPaise: toPaise(payment.amount),
                })),
            }
          : {}),
      },
    });

    // Send notifications after successful transaction
    const invitee = await User.findById(userId);
    const organizer = await User.findById(booking.organizerId);
    const venue = await Venue.findById(booking.venueId);

    if (accept && invitee && organizer && venue) {
      // Notify organizer that someone accepted
      NotificationService.send({
        userId: booking.organizerId.toString(),
        type: "BOOKING_CONFIRMED",
        title: "Booking Invitation Accepted",
        message: `${invitee.name} accepted your invitation to play ${booking.sport} at ${venue.name}`,
        data: {
          bookingId: booking._id.toString(),
          participantId: userId,
          participantName: invitee.name,
          venueName: venue.name,
          sport: booking.sport,
          date: booking.date.toISOString(),
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      }).catch((err: Error) =>
        log.error(`Failed to send booking acceptance notification to organizer:`, err)
      );

      // If booking is now pending confirmation, notify all accepted participants
      if (booking.status === "AWAITING_PAYMENT") {
        const acceptedParticipants = booking.participants.filter(
          (p) => p.status === "ACCEPTED" && p.userId.toString() !== booking.organizerId.toString()
        );

        for (const participant of acceptedParticipants) {
          const participantUser = await User.findById(participant.userId);
          if (participantUser) {
            NotificationService.send({
              userId: participant.userId.toString(),
              type: "BOOKING_STATUS_UPDATED",
              title: "Booking awaiting confirmation",
              message: `Your booking for ${booking.sport} at ${venue.name} is awaiting provider confirmation.`,
              data: {
                bookingId: booking._id.toString(),
                venueName: venue.name,
                sport: booking.sport,
                date: booking.date.toISOString(),
                startTime: booking.startTime,
                endTime: booking.endTime,
                status: booking.status,
              },
            }).catch((err: Error) =>
              log.error(
                `Failed to send booking pending notification to ${participant.userId}:`,
                err
              )
            );
          }
        }
      }
    }

    return booking;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(
      `Failed to respond to invitation: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Organizer covers unpaid shares in a split payment booking
 */
export const coverUnpaidShares = async (
  bookingId: string,
  organizerId: string
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.organizerId.toString() !== organizerId) {
    throw new Error("Only the organizer can cover unpaid shares");
  }

  if (booking.bookingType !== "GROUP") {
    throw new Error("This is not a group booking");
  }
  if (booking.paymentType !== "SPLIT") {
    throw new Error("This booking does not use split payment");
  }

  // Find all unpaid player payments
  const unpaidPlayerPayments = booking.payments.filter(
    (p) => p.userType === "Player" && p.status === "PENDING"
  );

  if (unpaidPlayerPayments.length === 0) {
    throw new Error("No unpaid shares to cover");
  }

  // Store user IDs for notifications
  const coveredUserIds = unpaidPlayerPayments.map((p) => p.userId.toString());

  // Calculate total unpaid amount
  const totalUnpaid = unpaidPlayerPayments.reduce((sum, p) => sum + p.amount, 0);

  // Find organizer's payment
  const organizerPayment = booking.payments.find(
    (p) => p.userId.toString() === organizerId && p.userType === "Player"
  );

  if (organizerPayment) {
    // Increase organizer's payment to cover unpaid shares
    organizerPayment.amount += totalUnpaid;
  } else {
    // Create new payment for organizer covering unpaid shares
    booking.payments.push({
      userId: new mongoose.Types.ObjectId(organizerId),
      userType: "Player",
      amount: totalUnpaid,
      status: "PENDING",
    });
  }

  // Remove unpaid payments from other users
  booking.payments = booking.payments.filter(
    (p) =>
      !(p.userType === "Player" && p.status === "PENDING" && p.userId.toString() !== organizerId)
  );

  await booking.save();

  // A split being reassigned changes who owes what — the "why" behind an
  // organizer's share suddenly growing is otherwise unrecoverable.
  await recordBookingEventFor(booking, {
    type: "STATUS_CHANGED",
    fromStatus: booking.status,
    toStatus: booking.status,
    actorType: "USER",
    actorUserId: organizerId,
    channel: "CLIENT_WEB",
    amountPaise: toPaise(totalUnpaid),
    summary: `Organizer absorbed ${unpaidPlayerPayments.length} unpaid share(s)`,
    metadata: {
      change: "SPLIT_REASSIGNED",
      coveredUserIds,
      coveredCount: unpaidPlayerPayments.length,
      organizerShareAfterPaise: toPaise(
        booking.payments.find(
          (payment) => payment.userId.toString() === organizerId && payment.userType === "Player"
        )?.amount ?? 0
      ),
    },
  });

  // Send notifications to users whose payments were covered
  const venue = await Venue.findById(booking.venueId).select("name");
  const organizer = await User.findById(organizerId).select("name");

  for (const userId of coveredUserIds) {
    NotificationService.send({
      userId: userId,
      type: "PAYMENT_SPLIT_RECEIVED",
      title: "Payment Covered",
      message: `${organizer?.name || "The organizer"} has covered your share for ${booking.sport} at ${venue?.name || "the venue"}.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        organizerName: organizer?.name || "Organizer",
        organizerId: organizerId,
      },
    }).catch((err: Error) =>
      log.error(`Failed to send payment split received notification to ${userId}:`, err)
    );
  }

  return booking;
};
