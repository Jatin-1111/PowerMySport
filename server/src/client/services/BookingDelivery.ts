import mongoose from "mongoose";
import { BookingDelivery } from "../models/Booking";

/**
 * Resolves where a booked session is delivered, once, at creation time.
 *
 * This is deliberately the ONLY place that answers "where does this session
 * happen". Before it existed the question was re-answered by each consumer —
 * the invoice, the confirmation email, the coach's calendar — each with a
 * slightly different rule, all of them reading the provider's live profile
 * rather than the booking. See the block comment on `BookingDelivery`.
 *
 * The rules below reproduce exactly what the booking flow already permits;
 * this resolver records that decision rather than changing it. In particular
 * it never rejects a booking the flow would have accepted, and never invents a
 * location it was not given — an unknown address is left unset, because
 * guessing one is the class of bug this whole change exists to remove.
 */

interface DeliveryVenueLike {
  _id: mongoose.Types.ObjectId;
  name?: string;
  address?: string;
  location?: { coordinates?: number[] };
}

interface DeliveryCoachLike {
  serviceMode?: string;
  ownVenueDetails?: {
    name?: string;
    address?: string;
    location?: { coordinates?: number[] };
  };
}

interface DeliveryAcademyLike {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: { coordinates?: number[] };
}

export interface ResolveDeliveryInput {
  /** The listed venue the session was booked at, if any. */
  venue?: DeliveryVenueLike | null;
  coach?: DeliveryCoachLike | null;
  academy?: DeliveryAcademyLike | null;
  /** Where the student is, for a coach who travels. */
  playerLocation?: { coordinates: [number, number]; address?: string } | undefined;
}

const asCoordinates = (raw: number[] | undefined): [number, number] | undefined => {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const [lng, lat] = raw;
  if (typeof lng !== "number" || typeof lat !== "number") return undefined;
  if (Number.isNaN(lng) || Number.isNaN(lat)) return undefined;
  return [lng, lat];
};

/** Academy addresses are stored across four fields; the invoice wants one line. */
const composeAcademyAddress = (academy: DeliveryAcademyLike): string | undefined => {
  const tail = [academy.city, academy.state, academy.pincode]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
  const parts = [academy.address, tail].filter((part): part is string =>
    Boolean(part && part.trim())
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
};

/**
 * Drops undefined keys before the value is handed to Mongoose. Also the reason
 * the builders below can list every field unconditionally without tripping
 * `exactOptionalPropertyTypes`.
 */
const stripUndefined = (
  delivery: { kind: BookingDelivery["kind"] } & Record<string, unknown>
): BookingDelivery =>
  Object.fromEntries(
    Object.entries(delivery).filter(([, value]) => value !== undefined)
  ) as unknown as BookingDelivery;

export const resolveBookingDelivery = (
  input: ResolveDeliveryInput
): BookingDelivery | undefined => {
  const { venue, coach, academy, playerLocation } = input;

  // A listed venue always wins: if the session was booked against one, that is
  // where it happens, whoever the provider is.
  if (venue) {
    return stripUndefined({
      kind: "PLATFORM_VENUE",
      venueId: venue._id,
      nameSnapshot: venue.name,
      addressSnapshot: venue.address,
      coordinates: asCoordinates(venue.location?.coordinates),
    });
  }

  if (coach) {
    // OWN_VENUE coaches teach at their own place, and the booking flow ignores
    // playerLocation for them (the service-radius check runs only for
    // FREELANCE/HYBRID). Mirror that here.
    //
    // Note this branch is taken even when ownVenueDetails is empty — a coach
    // may pick OWN_VENUE and add the venue later, and that is allowed today.
    // The result is an address-less PROVIDER_VENUE, which is the honest record:
    // the session is at the coach's place and we do not know where that is.
    if (coach.serviceMode === "OWN_VENUE") {
      return stripUndefined({
        kind: "PROVIDER_VENUE",
        nameSnapshot: coach.ownVenueDetails?.name,
        addressSnapshot: coach.ownVenueDetails?.address,
        coordinates: asCoordinates(coach.ownVenueDetails?.location?.coordinates),
      });
    }

    // FREELANCE, and HYBRID booked without a venue: the coach travels to the
    // student. This is the case whose location the system previously threw away.
    if (playerLocation) {
      return stripUndefined({
        kind: "STUDENT_LOCATION",
        addressSnapshot: playerLocation.address,
        coordinates: playerLocation.coordinates,
      });
    }

    // A HYBRID coach with neither a venue nor a student location. The booking
    // flow rejects this before reaching here; return undefined rather than
    // fabricating a delivery, so a future caller that skips that check gets no
    // location instead of a wrong one.
    return undefined;
  }

  if (academy) {
    return stripUndefined({
      kind: "PROVIDER_VENUE",
      nameSnapshot: academy.name,
      addressSnapshot: composeAcademyAddress(academy),
      coordinates: asCoordinates(academy.location?.coordinates),
    });
  }

  return undefined;
};

/**
 * The one-line address a session was delivered at, for invoices and emails.
 * Returns undefined for deliveries that have no physical address (online, or a
 * coach venue that was never filled in) so callers render an explicit fallback
 * rather than an empty string.
 */
export const deliveryAddressLine = (
  delivery: BookingDelivery | undefined | null
): string | undefined => {
  if (!delivery) return undefined;
  const address = delivery.addressSnapshot?.trim();
  return address ? address : undefined;
};
