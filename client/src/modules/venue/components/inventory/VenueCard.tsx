import { Button } from "@/modules/shared/ui/Button";
import {
  formatSportLabel,
  getCoverPhoto,
  getVenueImageGroups,
} from "@/modules/venue/utils/inventoryFlow";
import { Venue } from "@/types";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle,
  Edit3,
  ExternalLink,
  IndianRupee,
  MapPin,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export function VenueSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="h-44 bg-slate-100" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-5 w-3/4 rounded-full bg-slate-100" />
        <div className="h-3 w-full rounded-full bg-slate-100" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-slate-100" />
          <div className="h-5 w-20 rounded-full bg-slate-100" />
          <div className="h-5 w-14 rounded-full bg-slate-100" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-12 rounded-full bg-slate-100" />
          <div className="h-5 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between">
          <div className="h-7 w-24 rounded-full bg-slate-100" />
          <div className="h-4 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded-lg bg-slate-100" />
          <div className="h-9 flex-1 rounded-lg bg-slate-100" />
          <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function VenueCard({
  venue,
  onEdit,
  onDelete,
  index,
}: {
  venue: Venue;
  onEdit: (v: Venue) => void;
  onDelete: (id: string) => void;
  index: number;
}) {
  const coverPhoto = getCoverPhoto(venue);
  const displayAddress =
    venue.address ||
    (venue.location?.coordinates
      ? `${venue.location.coordinates[1].toFixed(4)}° N, ${venue.location.coordinates[0].toFixed(4)}° E`
      : "Location not set");

  const isActive = Boolean(venue.description?.trim()) && Boolean(coverPhoto);
  const hasRating = Boolean(venue.rating && venue.rating > 0);
  const visibleSports = venue.sports.slice(0, 3);
  const moreSports = venue.sports.length - 3;
  const amenitiesList = venue.amenities || [];
  const visibleAmenities = amenitiesList.slice(0, 3);
  const moreAmenities = amenitiesList.length - 3;
  const totalImages = getVenueImageGroups(venue).all.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-lg"
    >
      {/* ── Cover photo ── */}
      <div className="relative h-44 overflow-hidden bg-slate-100">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={venue.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200">
            <Building2 className="h-10 w-10 text-slate-300" />
            <span className="text-xs font-medium text-slate-400">No photos yet</span>
          </div>
        )}

        {/* Gradient overlay */}
        {coverPhoto && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        )}

        {/* Status badge */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {totalImages > 0 && (
            <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {totalImages} photo{totalImages !== 1 ? "s" : ""}
            </span>
          )}
          <span
            className={[
              "rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
              isActive ? "bg-turf-green/90 text-white" : "bg-amber-500/90 text-white",
            ].join(" ")}
          >
            {isActive ? "Active" : "Incomplete"}
          </span>
        </div>

        {/* Name overlay (only when cover photo present) */}
        {coverPhoto && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
            <h3 className="line-clamp-1 text-lg font-bold leading-tight text-white drop-shadow-sm">
              {venue.name}
            </h3>
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Name (when no cover photo) */}
        {!coverPhoto && (
          <h3 className="line-clamp-2 text-lg font-bold leading-tight text-slate-900">
            {venue.name}
          </h3>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2 text-xs text-slate-500">{displayAddress}</span>
        </div>

        {/* Sports */}
        <div className="flex flex-wrap gap-1.5">
          {visibleSports.map((sport) => (
            <span
              key={sport}
              className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600"
            >
              {formatSportLabel(sport)}
            </span>
          ))}
          {moreSports > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              +{moreSports} more
            </span>
          )}
        </div>

        {/* Amenities */}
        {visibleAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleAmenities.map((a) => (
              <span
                key={a}
                className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
              >
                {a}
              </span>
            ))}
            {moreAmenities > 0 && (
              <span className="self-center text-xs text-slate-400">+{moreAmenities}</span>
            )}
          </div>
        )}

        {/* External coaches badge */}
        {venue.allowExternalCoaches && (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">External coaches welcome</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Price + Rating */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-baseline gap-0.5">
            <IndianRupee className="text-power-orange h-4 w-4 shrink-0" strokeWidth={2.5} />
            <span className="text-xl font-bold text-slate-900">
              {venue.pricePerHour.toLocaleString("en-IN")}
            </span>
            <span className="ml-0.5 text-xs text-slate-400">/hr</span>
          </div>
          {hasRating ? (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold text-slate-700">
                {venue.rating!.toFixed(1)}
              </span>
              {venue.reviewCount && venue.reviewCount > 0 && (
                <span className="text-xs text-slate-400">({venue.reviewCount})</span>
              )}
            </div>
          ) : (
            <span className="text-xs italic text-slate-300">No reviews yet</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => onEdit(venue)}
            variant="outline"
            size="sm"
            icon={<Edit3 className="h-3.5 w-3.5" />}
            className="flex-1 !border-slate-200 text-sm !text-slate-700 hover:!border-orange-300 hover:!text-orange-600"
          >
            Edit
          </Button>
          <Link href={`/venues/${venue.id || venue._id}`} className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              className="w-full text-sm !text-slate-500 hover:!bg-slate-50 hover:!text-slate-700"
            >
              Preview
            </Button>
          </Link>
          <button
            onClick={() => onDelete(venue.id || (venue as { _id?: string })._id || "")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition-colors hover:border-red-200 hover:bg-red-100"
            title="Delete venue"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
