import mongoose from "mongoose";
import { Booking } from "../../models/Booking";
import { resolveBookingDelivery } from "../BookingDelivery";
import { Coach, CoachDocument } from "../../models/Coach";
import { CoachSubscription } from "../../models/CoachSubscription";
import { User } from "../../models/User";
import { Player } from "../../models/Player";
import { Venue, VenueDocument } from "../../models/Venue";
import Academy, { AcademyDocument } from "../../../admin/models/Academy";
import { SERVICE_FEE_RATE, TAX_RATE } from "../PricingRates";
import { validatePromoCode, applyPromoCode } from "../PromoCodeService";
import { isWithinOpeningHours, combineDateAndTimeIST } from "../../../utils/openingHours";
import { BookingWaitlist, BookingWaitlistDocument } from "../../models/BookingWaitlist";
import { calculateSplitAmounts } from "../../../utils/payment";
import { recordBookingEventFor } from "../BookingEventService";
import {
  log,
  COACH_SUBSCRIPTIONS_ENFORCE_BOOKING,
  type BookingCreatePayload,
  type InitiateBookingPayload,
  type CreateBookingWaitlistPayload,
  type InitiateBookingResponse,
  generateUniqueCheckInCode,
  normalizeTimeToHHmm,
  getDateKey,
  calculateDistanceKm,
  toPaise,
} from "./shared";
import {
  hasAcademyCapacity,
  createBookingAtomically,
  isSlotAvailable,
  checkCoachAvailabilityForBooking,
} from "./availability";

export const createBookingWaitlistEntry = async (
  payload: CreateBookingWaitlistPayload
): Promise<BookingWaitlistDocument> => {
  const waitlist = await BookingWaitlist.findOneAndUpdate(
    {
      userId: payload.userId,
      ...(payload.venueId ? { venueId: payload.venueId } : {}),
      ...(payload.coachId ? { coachId: payload.coachId } : {}),
      date: payload.date,
      startTime: payload.startTime,
      status: "ACTIVE",
    },
    {
      $set: {
        userId: payload.userId,
        ...(payload.venueId ? { venueId: payload.venueId } : {}),
        ...(payload.coachId ? { coachId: payload.coachId } : {}),
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        alternateSlots: payload.alternateSlots || [],
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return waitlist;
};

/**
 * Initiate a new booking
 * This creates the booking in CONFIRMED status
 */
export const initiateBooking = async (
  payload: InitiateBookingPayload
): Promise<InitiateBookingResponse> => {
  try {
    const normalizedStartTime = normalizeTimeToHHmm(payload.startTime);
    const normalizedEndTime = normalizeTimeToHHmm(payload.endTime);

    const requestedStartAt = combineDateAndTimeIST(payload.date, normalizedStartTime);
    const requestedEndAt = combineDateAndTimeIST(payload.date, normalizedEndTime);
    const now = new Date();

    if (requestedEndAt <= requestedStartAt) {
      throw new Error("End time must be after start time");
    }

    if (requestedStartAt <= now) {
      throw new Error("Cannot book a slot in the past");
    }

    // --- BOOKING DEBUG LOG START ---
    log.info(
      "[initiateBooking] RAW PAYLOAD:",
      JSON.stringify({
        userId: payload.userId,
        userIdType: typeof payload.userId,
        userIdIsValid: mongoose.Types.ObjectId.isValid(payload.userId),
        venueId: payload.venueId,
        venueIdIsValid: payload.venueId ? mongoose.Types.ObjectId.isValid(payload.venueId) : "N/A",
        coachId: payload.coachId,
        coachIdIsValid: payload.coachId ? mongoose.Types.ObjectId.isValid(payload.coachId) : "N/A",
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        dependentId: payload.dependentId,
        dependentIdIsValid: payload.dependentId
          ? mongoose.Types.ObjectId.isValid(payload.dependentId)
          : "N/A",
        hasPlayerLocation: Boolean(payload.playerLocation),
      })
    );
    // --- BOOKING DEBUG LOG END ---

    // Fetch user for participant information
    log.info(
      "[initiateBooking] STEP 1: validating userId =",
      JSON.stringify(payload.userId),
      "type:",
      typeof payload.userId
    );
    if (!mongoose.Types.ObjectId.isValid(payload.userId)) {
      throw new Error("Invalid user ID format");
    }
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new Error("User not found");
    }
    log.info("[initiateBooking] STEP 1 OK: user =", user._id.toString());

    // Clean up any existing abandoned booking for this exact same slot by this user
    // This allows them to "try again" immediately without hitting "Coach/Venue is not available"
    const startOfDay = new Date(
      Date.UTC(payload.date.getUTCFullYear(), payload.date.getUTCMonth(), payload.date.getUTCDate())
    );

    const cleanupQuery: any = {
      userId: user._id,
      date: {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
      },
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      status: "AWAITING_PAYMENT",
    };
    if (payload.coachId) cleanupQuery.coachId = payload.coachId;
    if (payload.venueId) cleanupQuery.venueId = payload.venueId;

    const deletedAbandoned = await Booking.deleteMany(cleanupQuery);
    if (deletedAbandoned.deletedCount > 0) {
      log.info(
        `[initiateBooking] Cleaned up ${deletedAbandoned.deletedCount} abandoned booking(s) for user ${user._id} attempting to re-book`
      );
    }

    // Determine participant details
    let participantName = user.name;
    let participantId: any = user._id;
    let participantAge: number | undefined = undefined;

    if (payload.dependentId) {
      log.info(
        "[initiateBooking] STEP 2: validating dependentId =",
        JSON.stringify(payload.dependentId)
      );
      if (
        payload.dependentId === "undefined" ||
        !mongoose.Types.ObjectId.isValid(payload.dependentId)
      ) {
        throw new Error("Invalid dependent ID format");
      }
      // Booking is for a dependent (child)
      const dependent = await Player.findOne({
        _id: payload.dependentId,
        userId: user._id,
        type: "DEPENDENT",
      });
      if (!dependent) {
        throw new Error("Dependent not found");
      }

      // Validate dependent's age
      if (typeof dependent.age !== "number" || isNaN(dependent.age)) {
        throw new Error("Invalid age for dependent");
      }

      participantName = dependent.name;
      participantId = dependent._id;
      participantAge = dependent.age;
      log.info(
        "[initiateBooking] STEP 2 OK: dependent =",
        dependent._id.toString(),
        "participantId type:",
        typeof participantId,
        "value:",
        participantId?.toString()
      );

      // Validate minimum age (must be at least 3 years old)
      if (participantAge < 3) {
        throw new Error("Participant must be at least 3 years old to book");
      }

      // Validate maximum age for dependents (must be under 18)
      if (participantAge >= 18) {
        throw new Error("Dependents must be under 18 years old. Please book as an adult.");
      }
    } else {
      // Booking is for the parent/user themselves
      participantId = user._id;
      log.info(
        "[initiateBooking] STEP 2: no dependent, participantId =",
        participantId?.toString()
      );
    }

    let venue: VenueDocument | null = null;

    if (payload.venueId) {
      log.info("[initiateBooking] STEP 3: validating venueId =", JSON.stringify(payload.venueId));
      if (!mongoose.Types.ObjectId.isValid(payload.venueId)) {
        throw new Error("Invalid venue ID format");
      }
      venue = await Venue.findById(payload.venueId).populate("ownerId");
      if (!venue) {
        throw new Error("Venue not found");
      }
      log.info(
        "[initiateBooking] STEP 3 OK: venue =",
        venue._id.toString(),
        "ownerId raw =",
        JSON.stringify(venue.ownerId),
        "ownerId type:",
        typeof venue.ownerId
      );

      const venueAvailable = await isSlotAvailable(
        payload.venueId,
        payload.date,
        normalizedStartTime,
        normalizedEndTime
      );

      if (!venueAvailable) {
        throw new Error("Selected time slot is already booked for this venue");
      }

      if (!payload.sport || !venue.sports.includes(payload.sport)) {
        throw new Error("Selected sport is not available at this venue");
      }

      // Validate booking falls within venue opening hours
      if (venue.openingHours) {
        const hoursCheck = isWithinOpeningHours(
          payload.date,
          normalizedStartTime,
          normalizedEndTime,
          venue.openingHours
        );

        if (!hoursCheck.isValid) {
          throw new Error(hoursCheck.message || "Booking time is outside venue operating hours");
        }
      }
    }

    // Calculate venue price (supports fractional hours)
    const startParts = normalizedStartTime.split(":");
    const endParts = normalizedEndTime.split(":");
    const startHour = parseInt(startParts[0] || "0", 10);
    const startMin = parseInt(startParts[1] || "0", 10);
    const endHour = parseInt(endParts[0] || "0", 10);
    const endMin = parseInt(endParts[1] || "0", 10);

    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    const totalMinutes = endTotalMinutes - startTotalMinutes;
    const hours = totalMinutes / 60; // Supports 0.5, 0.75, etc.
    let venuePrice = 0;
    if (venue) {
      const sportPrice = venue.sportPricing?.[payload.sport];
      const basePrice =
        typeof sportPrice === "number" && sportPrice >= 0 ? sportPrice : venue.pricePerHour;
      if (basePrice <= 0) {
        throw new Error("Venue pricing is not configured for this sport");
      }
      venuePrice = Math.round(hours * basePrice * 100) / 100;
    }

    let coachPrice = 0;
    // Hoisted so the delivery resolver can see the provider that was validated
    // here, instead of re-fetching it (or re-deriving the location) later.
    let coachDoc: CoachDocument | null = null;

    // If coach is requested, validate and calculate coach price
    if (payload.coachId) {
      if (!mongoose.Types.ObjectId.isValid(payload.coachId)) {
        throw new Error("Invalid coach ID format");
      }
      const coach = await Coach.findById(payload.coachId).populate("userId");
      if (!coach) {
        throw new Error("Coach not found");
      }
      coachDoc = coach;
      log.info(
        "[initiateBooking] STEP 4 OK: coach =",
        coach._id.toString(),
        "userId raw =",
        JSON.stringify((coach as any).userId),
        "serviceMode:",
        coach.serviceMode
      );

      if (COACH_SUBSCRIPTIONS_ENFORCE_BOOKING) {
        const now = new Date();

        const query: any = {
          coachId: coach._id,
          userId: user._id,
          status: { $in: ["ACTIVE", "PAST_DUE"] },
        };

        if (payload.dependentId) {
          query.dependentId = payload.dependentId;
        } else {
          query.dependentId = { $exists: false };
        }

        const coachSubscription = await CoachSubscription.findOne(query).sort({
          createdAt: -1,
        });

        if (!coachSubscription) {
          throw new Error(
            payload.dependentId
              ? "No active coach subscription found for this dependent"
              : "No active coach subscription found for your account"
          );
        }

        const isActive = coachSubscription.status === "ACTIVE";
        const isPastDueWithinGrace =
          coachSubscription.status === "PAST_DUE" &&
          coachSubscription.gracePeriodEndsAt &&
          coachSubscription.gracePeriodEndsAt > now;

        if (!isActive && !isPastDueWithinGrace) {
          throw new Error(
            payload.dependentId
              ? "No active coach subscription found for this dependent"
              : "No active coach subscription found for your account"
          );
        }
      }

      if (!payload.venueId && !payload.playerLocation) {
        throw new Error("Player location is required for coach booking");
      }

      if (
        (coach.serviceMode === "FREELANCE" || coach.serviceMode === "HYBRID") &&
        payload.playerLocation
      ) {
        const coachBaseCoordinates = coach.baseLocation?.coordinates;
        if (!coachBaseCoordinates || coachBaseCoordinates.length !== 2) {
          throw new Error("Coach service location is not configured");
        }

        const distanceKm = calculateDistanceKm(
          coachBaseCoordinates,
          payload.playerLocation.coordinates
        );
        const serviceRadiusKm = coach.serviceRadiusKm || 10;

        if (distanceKm > serviceRadiusKm) {
          throw new Error(
            `Coach is out of range. This coach serves up to ${serviceRadiusKm} km from their base location.`
          );
        }
      }

      if (venue && coach.serviceMode !== "OWN_VENUE" && !venue.allowExternalCoaches) {
        throw new Error("This venue does not allow external coaches");
      }

      // Check coach availability (imported from CoachService logic)
      const coachAvailable = await checkCoachAvailabilityForBooking(
        payload.coachId,
        payload.date,
        normalizedStartTime,
        normalizedEndTime,
        payload.sport
      );

      if (!coachAvailable) {
        throw new Error("Coach is not available for the selected time slot");
      }

      const coachSportRate =
        payload.sport && typeof coach.sportPricing?.[payload.sport] === "number"
          ? coach.sportPricing[payload.sport]
          : undefined;
      const effectiveCoachRate =
        typeof coachSportRate === "number" && coachSportRate > 0
          ? coachSportRate
          : coach.hourlyRate;

      coachPrice = hours * effectiveCoachRate;
    }

    let academyPrice = 0;
    let academyOwnerIdStr: string | undefined;
    let academyDoc: AcademyDocument | null = null;

    if (payload.academyId) {
      if (!mongoose.Types.ObjectId.isValid(payload.academyId)) {
        throw new Error("Invalid academy ID format");
      }
      const academy = await Academy.findById(payload.academyId);
      if (!academy) {
        throw new Error("Academy not found");
      }
      academyDoc = academy;
      if (!academy.isApproved) {
        throw new Error("Academy is not approved for bookings");
      }

      // The academy must have a linked owner account, otherwise the booking
      // collects money with no payee to release it to (and nobody who can
      // confirm the session). Better to decline than to sell an unpayable slot.
      if (!academy.ownerId) {
        throw new Error(
          "This academy is not yet set up to accept bookings. Please contact support."
        );
      }
      academyOwnerIdStr = academy.ownerId.toString();

      if (!payload.sport || !academy.sports.includes(payload.sport)) {
        throw new Error("Selected sport is not offered by this academy");
      }

      // Validate the booking falls within the academy's operating hours —
      // same rule venues already enforce.
      if (academy.operatingHours) {
        const hoursCheck = isWithinOpeningHours(
          payload.date,
          normalizedStartTime,
          normalizedEndTime,
          academy.operatingHours
        );

        if (!hoursCheck.isValid) {
          throw new Error(
            (hoursCheck.message || "").replace(/^Venue/, "Academy") ||
              "Booking time is outside academy operating hours"
          );
        }
      }

      // Academies are capacity-based rather than exclusive: maxBatchSize
      // students may share the same slot. Reject once the batch is full.
      const academyAvailable = await hasAcademyCapacity(
        payload.academyId,
        payload.date,
        normalizedStartTime,
        normalizedEndTime,
        academy.maxBatchSize
      );

      if (!academyAvailable) {
        throw new Error("This academy batch is already full for the selected time slot");
      }

      // sessionRatePerHour is stored in paise — convert to rupees
      const rateInRupees = (academy.sessionRatePerHour || 0) / 100;
      if (rateInRupees <= 0) {
        throw new Error("Academy pricing is not configured");
      }
      academyPrice = hours * rateInRupees;
    }

    const subtotal = venuePrice + coachPrice + academyPrice;
    const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
    const taxAmount = serviceFee > 0 ? Math.round(serviceFee * TAX_RATE) : 0;
    let discountAmount = 0;
    let validPromoCode: string | undefined = undefined;

    // Validate and apply promo code if provided
    if (payload.promoCode) {
      const promoValidation = await validatePromoCode(payload.promoCode, payload.userId, subtotal, {
        hasCoach: Boolean(payload.coachId),
        context: "BOOKING",
      });

      if (!promoValidation.isValid) {
        throw new Error(promoValidation.message || "Invalid promo code");
      }

      discountAmount = promoValidation.discountAmount;
      validPromoCode = payload.promoCode.toUpperCase();
    }

    const totalAmount = Math.max(0, subtotal + serviceFee + taxAmount - discountAmount);

    const checkInCode = await generateUniqueCheckInCode();

    let singlePaymentSplits: any[] = [];
    if (payload.venueId || payload.coachId || payload.academyId) {
      const venueOwnerIdStr = venue?.ownerId
        ? (venue.ownerId as any)._id?.toString() || venue.ownerId.toString()
        : undefined;
      let coachUserIdStr: string | undefined;
      if (payload.coachId) {
        const coachInfo = await Coach.findById(payload.coachId);
        if (coachInfo && coachInfo.userId) {
          coachUserIdStr = coachInfo.userId.toString();
        }
      }

      log.info(
        "[initiateBooking] STEP 5 splits input: venueOwnerIdStr =",
        JSON.stringify(venueOwnerIdStr),
        "venueOwnerIdValid:",
        venueOwnerIdStr ? mongoose.Types.ObjectId.isValid(venueOwnerIdStr) : false,
        "coachUserIdStr =",
        JSON.stringify(coachUserIdStr),
        "coachUserIdValid:",
        coachUserIdStr ? mongoose.Types.ObjectId.isValid(coachUserIdStr) : false,
        "payerUserId =",
        JSON.stringify(payload.userId),
        "venuePrice =",
        venuePrice,
        "coachPrice =",
        coachPrice,
        "totalAmount =",
        totalAmount
      );

      const calculatedSplits = calculateSplitAmounts(
        venuePrice,
        venueOwnerIdStr || "",
        coachPrice > 0 ? coachPrice : undefined,
        coachUserIdStr,
        payload.userId,
        totalAmount,
        academyPrice > 0 ? academyPrice : undefined,
        academyOwnerIdStr
      );

      log.info("[initiateBooking] STEP 5 calculatedSplits:", JSON.stringify(calculatedSplits));

      singlePaymentSplits = calculatedSplits
        .filter((p) => p.userId && mongoose.Types.ObjectId.isValid(p.userId))
        .map((p) => ({
          userId: p.userId,
          userType: p.userType,
          amount: p.amount,
          status: p.status,
        }));

      log.info(
        "[initiateBooking] STEP 5 singlePaymentSplits after filter:",
        JSON.stringify(singlePaymentSplits)
      );
    }

    // Resolved once, from the providers already validated above, and snapshotted
    // onto the booking. Nothing downstream re-derives the session's location.
    const delivery = resolveBookingDelivery({
      venue,
      coach: coachDoc,
      academy: academyDoc,
      playerLocation: payload.playerLocation,
    });

    const bookingPayload: BookingCreatePayload = {
      userId: payload.userId,
      ...(delivery ? { delivery } : {}),
      ...(payload.venueId ? { venueId: payload.venueId } : {}),
      ...(payload.coachId ? { coachId: payload.coachId } : {}),
      ...(payload.academyId ? { academyId: payload.academyId } : {}),
      sport: payload.sport,
      date: payload.date,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      totalAmount,
      serviceFee,
      taxAmount,
      ...(validPromoCode ? { promoCode: validPromoCode } : {}),
      ...(discountAmount > 0 ? { discountAmount } : {}),
      checkInCode,
      participantName,
      participantId,
      ...(participantAge !== undefined ? { participantAge } : {}),
      organizerId: payload.userId,
      payments: singlePaymentSplits,
    };

    log.info(
      "[initiateBooking] STEP 6 bookingPayload:",
      JSON.stringify({
        userId: bookingPayload.userId,
        userIdValid: mongoose.Types.ObjectId.isValid(bookingPayload.userId),
        venueId: bookingPayload.venueId,
        coachId: bookingPayload.coachId,
        organizerId: bookingPayload.organizerId,
        organizerIdValid: mongoose.Types.ObjectId.isValid(bookingPayload.organizerId),
        participantId: bookingPayload.participantId?.toString(),
        participantIdValid: bookingPayload.participantId
          ? mongoose.Types.ObjectId.isValid(bookingPayload.participantId.toString())
          : false,
        paymentsCount: bookingPayload.payments?.length,
        payments: bookingPayload.payments,
      })
    );

    const booking =
      payload.venueId || payload.coachId || payload.academyId
        ? await createBookingAtomically(bookingPayload)
        : await Booking.create({
            userId: new mongoose.Types.ObjectId(bookingPayload.userId),
            ...(bookingPayload.venueId
              ? { venueId: new mongoose.Types.ObjectId(bookingPayload.venueId) }
              : {}),
            ...(bookingPayload.coachId
              ? { coachId: new mongoose.Types.ObjectId(bookingPayload.coachId) }
              : {}),
            sport: bookingPayload.sport,
            date: bookingPayload.date,
            startTime: bookingPayload.startTime,
            endTime: bookingPayload.endTime,
            totalAmount: bookingPayload.totalAmount,
            serviceFee: bookingPayload.serviceFee,
            taxAmount: bookingPayload.taxAmount,
            ...(bookingPayload.promoCode ? { promoCode: bookingPayload.promoCode } : {}),
            ...(bookingPayload.discountAmount
              ? { discountAmount: bookingPayload.discountAmount }
              : {}),
            status: "AWAITING_PAYMENT",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
            checkInCode: bookingPayload.checkInCode,
            // Awaiting provider confirmation before booking is confirmed
            participantName: bookingPayload.participantName,
            participantId: bookingPayload.participantId,
            ...(bookingPayload.participantAge !== undefined
              ? { participantAge: bookingPayload.participantAge }
              : {}),
            organizerId: new mongoose.Types.ObjectId(bookingPayload.organizerId),
            payments: bookingPayload.payments || [],
            ...(bookingPayload.delivery ? { delivery: bookingPayload.delivery } : {}),
          });

    // Record promo code usage after successful booking
    if (validPromoCode && discountAmount > 0) {
      await applyPromoCode(
        validPromoCode,
        payload.userId,
        booking._id.toString(),
        null,
        discountAmount
      );
    }

    await recordBookingEventFor(booking, {
      type: "CREATED",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: payload.userId,
      channel: "CLIENT_WEB",
      amountPaise: toPaise(totalAmount),
      summary: `Booking created for ${payload.sport} on ${getDateKey(payload.date)} ${normalizedStartTime}-${normalizedEndTime}`,
      metadata: {
        sport: payload.sport,
        date: getDateKey(payload.date),
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        venuePricePaise: toPaise(venuePrice),
        coachPricePaise: toPaise(coachPrice),
        academyPricePaise: toPaise(academyPrice),
        serviceFeePaise: toPaise(serviceFee),
        taxPaise: toPaise(taxAmount),
        discountPaise: toPaise(discountAmount),
        ...(validPromoCode ? { promoCode: validPromoCode } : {}),
        bookingType: "INDIVIDUAL",
      },
    });

    return {
      booking,
    };
  } catch (error) {
    log.error("[initiateBooking] error:", error);
    throw new Error(
      `Failed to initiate booking: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

// Legacy function for backward compatibility
export const createBooking = initiateBooking;
