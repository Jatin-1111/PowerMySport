import {
  AcademyCard,
  BookingType,
  getCoachDisplayName,
  getCoachImageCandidates,
  getCoachLocationLabel,
  normalizeImageUrl,
} from "@/modules/booking/utils/checkoutHelpers";
import { Coach, Venue } from "@/types";
import { getOwnVenueLocationDisplay } from "@/utils/location";
import { BadgeCheck, MapPin, Star, User as UserIcon, Users } from "lucide-react";

/**
 * Displays the venue/coach/academy being booked at the top of the review
 * step — extracted from `app/(booking)/checkout/page.tsx`. No behavior
 * changed.
 */
export function CheckoutEntityCard({
  coach,
  venue,
  academy,
  type,
}: {
  coach: Coach | null;
  venue: Venue | null;
  academy: AcademyCard | null;
  type: BookingType;
}) {
  if (type === "venue" && venue) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44">
          {venue.images?.[0] ? (
            <img src={venue.images[0]} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin size={28} className="text-slate-300" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900">{venue.name}</p>
          {venue.address && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
              <MapPin size={13} className="text-power-orange mt-0.5 shrink-0" />
              <span>{venue.address}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.sports.map((s) => (
              <span
                key={s}
                className="bg-power-orange/10 text-power-orange rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "coach" && coach) {
    const name = getCoachDisplayName(coach);
    const img = getCoachImageCandidates(coach)[0];
    const locationLabel = getCoachLocationLabel(coach);
    const venueLocation = getOwnVenueLocationDisplay(coach.ownVenueDetails);
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:h-32 sm:w-44">
          {img ? (
            <img src={img} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <UserIcon size={32} className="text-slate-300" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900">{name}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold text-slate-700">
                {coach.rating.toFixed(1)}
              </span>
            </div>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">{coach.reviewCount} reviews</span>
          </div>
          <div className="mt-2">
            {venueLocation ? (
              <div className="flex items-start gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="text-power-orange mt-0.5 shrink-0" />
                <div>
                  <p>{locationLabel}</p>
                  <p className="text-xs text-slate-400">{venueLocation.description}</p>
                  {venueLocation.mapsUrl && (
                    <a
                      href={venueLocation.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-power-orange text-xs font-semibold hover:underline"
                    >
                      Open in Maps →
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="text-power-orange shrink-0" />
                {locationLabel}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {coach.sports.slice(0, 4).map((s) => (
              <span
                key={s}
                className="bg-power-orange/10 text-power-orange rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                {s}
              </span>
            ))}
            {coach.sports.length > 4 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                +{coach.sports.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (type === "academy" && academy) {
    const coverImage =
      normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl);
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44">
          {coverImage ? (
            <img src={coverImage} alt={academy.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <Users size={32} className="text-slate-300" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="text-lg font-bold text-slate-900">{academy.name}</p>
            {(academy.kycVerified || academy.isApproved) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <BadgeCheck size={10} />
                Verified
              </span>
            )}
          </div>
          {academy.city && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
              <MapPin size={13} className="text-power-orange mt-0.5 shrink-0" />
              <span>{academy.city}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(academy.sports || []).slice(0, 4).map((s) => (
              <span
                key={s}
                className="bg-power-orange/10 text-power-orange rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
