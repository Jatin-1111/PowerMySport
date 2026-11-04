import type { Types } from "mongoose";
import Academy from "../../admin/models/Academy";
import { Venue } from "../models/Venue";
import { deriveLifecycle, type Lifecycle } from "../../shared/services/providerLifecycle";

/**
 * What an academy owner is allowed to see about their own listing on the
 * dashboard: where it stands in review, and enough to say what to do next.
 * Nothing here is a bank, tax or document field.
 */
export interface OwnAcademySummary {
  id: string;
  name: string;
  slug: string;
  city?: string | undefined;
  sports: string[];
  lifecycle: Lifecycle;
  /** Highest onboarding step already saved (0 to 7). */
  onboardingStep: number;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  kycVerified: boolean;
  isApproved: boolean;
  isActive: boolean;
  /** Only set while the listing is rejected; the owner needs it to fix and resubmit. */
  rejectionReason?: string | undefined;
  venueCount: number;
  coachCount: number;
}

/** The academy linked to this owner account, or null before one has been linked. */
export const getOwnAcademySummary = async (
  ownerUserId: string
): Promise<OwnAcademySummary | null> => {
  const academy = await Academy.findOne({ ownerId: ownerUserId })
    .select(
      "name slug city sports lifecycle onboardingStep onboardingCompleted emailVerified kycVerified isApproved isActive rejectionReason academyVenues academyCoaches"
    )
    .lean();
  if (!academy) return null;

  const a = academy as unknown as Record<string, unknown>;
  // Derived rather than read, so a record the lifecycle hooks never touched
  // (updateMany, raw writes) still shows the owner the right state.
  const lifecycle = deriveLifecycle("academy", a);
  const reason = typeof a.rejectionReason === "string" ? a.rejectionReason.trim() : "";

  return {
    id: String(a._id),
    name: String(a.name ?? ""),
    slug: String(a.slug ?? ""),
    city: typeof a.city === "string" && a.city ? a.city : undefined,
    sports: Array.isArray(a.sports) ? (a.sports as string[]) : [],
    lifecycle,
    onboardingStep: Number(a.onboardingStep) || 0,
    onboardingCompleted: a.onboardingCompleted === true,
    emailVerified: a.emailVerified === true,
    kycVerified: a.kycVerified === true,
    isApproved: a.isApproved === true,
    isActive: a.isActive === true,
    rejectionReason: lifecycle === "REJECTED" && reason ? reason : undefined,
    venueCount: Array.isArray(a.academyVenues) ? a.academyVenues.length : 0,
    coachCount: Array.isArray(a.academyCoaches) ? a.academyCoaches.length : 0,
  };
};

export interface OwnAcademyVenue {
  id: string;
  name: string;
}

/**
 * The venues linked to this owner's academy, which are the ones their bookings
 * and reviews belong to. Only a name is returned: the reviews page needs to
 * pick a venue, nothing more. Unlike `/venues/my-venues`, this does not require
 * the Venue Lister role, which an academy owner does not have.
 */
export const getOwnAcademyVenues = async (ownerUserId: string): Promise<OwnAcademyVenue[]> => {
  const academy = await Academy.findOne({ ownerId: ownerUserId }).select("venueIds").lean();
  const venueIds = (academy as unknown as { venueIds?: Types.ObjectId[] } | null)?.venueIds ?? [];
  if (venueIds.length === 0) return [];

  const venues = await Venue.find({ _id: { $in: venueIds } })
    .select("name")
    .sort({ name: 1 })
    .lean();

  return venues.map((v) => ({ id: String(v._id), name: String(v.name ?? "") }));
};
