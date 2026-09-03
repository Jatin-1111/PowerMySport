"use client";

import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import OnboardingSectionCard from "@/modules/onboarding/components/onboarding/OnboardingSectionCard";
import OpeningHoursInput from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { venueApi } from "@/modules/venue/services/venue";
import { Venue } from "@/types";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle,
  Edit3,
  ExternalLink,
  ImageOff,
  IndianRupee,
  Layout,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const AMENITIES_OPTIONS = [
  "Parking",
  "Restroom",
  "Water",
  "Changing Room",
  "Lockers",
  "Cafeteria",
  "AC",
  "Lights",
  "Equipment Rental",
  "WiFi",
];

const S3_BUCKET_HOST = "https://powermysport-images.s3.ap-south-1.amazonaws.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizePhone = (value: unknown) => {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
};

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

// Kept identical to the GST_REGEX enforced server-side (ExpertsService.ts /
// Venue model) so a value valid here stays valid there.
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const formatSportLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const toS3Url = (key: string) => {
  const normalized = key.replace(/^\/+/, "");
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${S3_BUCKET_HOST}/${encoded}`;
};

const normalizeImageIdentity = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const rawPath = url.pathname.replace(/^\/+/, "");
    const decodedPath = decodeURIComponent(rawPath);
    if (url.hostname.includes("powermysport-images")) {
      return decodedPath;
    }
    return `${url.hostname}/${decodedPath}`;
  } catch {
    return decodeURIComponent(trimmed.replace(/^\/+/, ""));
  }
};

const dedupeUrls = (urls: string[]) => {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const identity = normalizeImageIdentity(url);
    if (!identity || seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
};

const getVenueImageGroups = (venue: Venue) => {
  const directImages = venue.images || [];
  const directKeys = venue.imageKeys ? venue.imageKeys.map(toS3Url) : [];

  const generalImages = venue.generalImages || [];
  const generalKeys = venue.generalImageKeys ? venue.generalImageKeys.map(toS3Url) : [];
  const baseGeneral = [...generalImages, ...generalKeys];

  const sportsEntries = new Map<string, string[]>();
  if (venue.sportImages) {
    Object.entries(venue.sportImages).forEach(([sport, urls]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [...(sportsEntries.get(sport) || []), ...(urls || [])]);
    });
  }

  if (venue.sportImageKeys) {
    Object.entries(venue.sportImageKeys).forEach(([sport, keys]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [...(sportsEntries.get(sport) || []), ...(keys || []).map(toS3Url)]);
    });
  }

  const hasStructured = baseGeneral.length > 0 || sportsEntries.size > 0;
  const fallbackGeneral = hasStructured ? [] : [...directImages, ...directKeys];
  const general = dedupeUrls([...baseGeneral, ...fallbackGeneral]);
  const generalIdentities = new Set(general.map((url) => normalizeImageIdentity(url)));

  const sports = Object.fromEntries(
    Array.from(sportsEntries.entries()).map(([sport, urls]) => {
      const filtered = urls.filter((url) => {
        const identity = normalizeImageIdentity(url);
        return identity && !generalIdentities.has(identity);
      });
      return [sport, dedupeUrls(filtered)];
    })
  );

  const all = dedupeUrls([
    ...general,
    ...Object.values(sports).flat(),
    ...directImages,
    ...directKeys,
  ]);

  return { general, sports, all };
};

const getCoverPhoto = (venue: Venue): string | null => {
  if (venue.coverPhotoUrl) return venue.coverPhotoUrl;
  if (venue.coverPhotoKey) return toS3Url(venue.coverPhotoKey);
  const groups = getVenueImageGroups(venue);
  return groups.all[0] ?? null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VenueSkeleton() {
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

function VenueCard({
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VenueInventoryPage() {
  const { user } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    name: "",
    address: "",
    location: null as { lat: number; lng: number } | null,
    sports: [] as string[],
    pricePerHour: "",
    amenities: "",
    description: "",
    gstNumber: "",
    openingHours: {
      monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
    },
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState(0);
  const [sportPricing, setSportPricing] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const skipAutocompleteRef = useRef(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingGeneralImages, setExistingGeneralImages] = useState<string[]>([]);
  const [existingSportImages, setExistingSportImages] = useState<Record<string, string[]>>({});
  const [existingCoverPhotoUrl, setExistingCoverPhotoUrl] = useState("");
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageError, setImageError] = useState("");

  const canAddMoreVenues = user?.venueListerProfile?.canAddMoreVenues ?? false;

  const getInputClassName = (hasError: boolean) => {
    return `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
      hasError ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"
    }`;
  };

  useEffect(() => {
    loadVenues();
  }, []);

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
    if (!showForm || editingVenue) return;
    if (!user) return;

    setFormData((prev) => ({
      ...prev,
      ownerName: prev.ownerName || user.name || "",
      ownerEmail: prev.ownerEmail || user.email || "",
      ownerPhone: prev.ownerPhone || normalizePhone(user.phone),
    }));
  }, [showForm, editingVenue, user]);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const results = await geoApi.autocomplete(query);
        setSuggestions(results);
      } catch {
        setSearchError("Unable to fetch suggestions");
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [addressQuery]);

  const loadVenues = async () => {
    try {
      const response = await venueApi.getMyVenues();
      if (response.success && response.data) {
        setVenues(response.data);
      }
    } catch (error) {
      console.error("Failed to load venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSportsChange = (nextSports: string[]) => {
    setFormData((prev) => ({
      ...prev,
      sports: nextSports,
    }));
    setSportPricing((prevPricing) => {
      const nextPricing: Record<string, number> = {};
      nextSports.forEach((sport) => {
        if (prevPricing[sport] != null) {
          nextPricing[sport] = prevPricing[sport];
        } else {
          nextPricing[sport] = samePriceForAll ? basePricePerHour : 0;
        }
      });
      return nextPricing;
    });
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) => {
      const updated = prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity];
      setFormData((prevForm) => ({
        ...prevForm,
        amenities: updated.join(", "),
      }));
      return updated;
    });
  };

  const handleBasePriceChange = (value: number) => {
    setBasePricePerHour(value);
    if (samePriceForAll) {
      setSportPricing(() => {
        const nextPricing: Record<string, number> = {};
        formData.sports.forEach((sport) => {
          nextPricing[sport] = value;
        });
        return nextPricing;
      });
    }
  };

  const handleSportPriceChange = (sport: string, value: number) => {
    setSportPricing((prev) => ({
      ...prev,
      [sport]: value,
    }));
  };

  const handleImageSelection = (files: FileList | null) => {
    if (!files) return;
    const maxImages = 10;
    const selected = Array.from(files).slice(0, maxImages);
    if (selected.length < files.length) {
      setImageError("You can upload up to 10 images.");
    } else {
      setImageError("");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSizeBytes = 5 * 1024 * 1024;
    const valid = selected.filter((file) => {
      if (!allowedTypes.includes(file.type)) return false;
      if (file.size > maxSizeBytes) return false;
      return true;
    });

    if (valid.length !== selected.length) {
      setImageError("Only JPG, PNG, or WebP files under 5MB are allowed.");
    }

    const previews = valid.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setSelectedImages(previews);
    setCoverPhotoIndex(0);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (coverPhotoIndex >= next.length) {
        setCoverPhotoIndex(0);
      }
      return next;
    });
  };

  const removeExistingImage = (url: string) => {
    setExistingGeneralImages((prev) => prev.filter((image) => image !== url));
    setExistingSportImages((prev) => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([sport, images]) => {
        const filtered = images.filter((image) => image !== url);
        if (filtered.length > 0) {
          next[sport] = filtered;
        }
      });
      return next;
    });
    setExistingImages((prev) => {
      const next = prev.filter((image) => image !== url);
      setExistingCoverPhotoUrl((prevCover) => {
        if (prevCover && prevCover !== url) {
          return prevCover;
        }
        return next[0] || "";
      });
      return next;
    });
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    skipAutocompleteRef.current = false;
    setAddressQuery(value);
    setHasSelectedLocation(false);
    setFormData((prev) => ({
      ...prev,
      address: value,
    }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setHasSelectedLocation(true);
    setSuggestions([]);
    setSearchError("");
    setAddressQuery(suggestion.label);
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      location: {
        lat: suggestion.lat,
        lng: suggestion.lon,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const normalizedPhone = normalizePhone(formData.ownerPhone);
      if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
        setFieldErrors((prev) => ({
          ...prev,
          ownerPhone: "Please enter a valid phone number",
        }));
        toast.error("Please enter a valid phone number");
        setIsSubmitting(false);
        return;
      }

      if (!formData.address.trim()) {
        toast.error("Please enter a venue address");
        setIsSubmitting(false);
        return;
      }

      if (!hasSelectedLocation) {
        setIsSearching(true);
        setSearchError("");
        try {
          skipAutocompleteRef.current = true;
          const result = await geoApi.geocode(formData.address);
          if (!result) {
            toast.error("We couldn't find this address. Please pick a suggestion.");
            setIsSubmitting(false);
            return;
          }

          setHasSelectedLocation(true);
          setAddressQuery(result.label);
          setFormData((prev) => ({
            ...prev,
            address: result.label,
            location: {
              lat: result.lat,
              lng: result.lon,
            },
          }));
        } catch {
          setSearchError("Unable to resolve address");
          setIsSubmitting(false);
          return;
        } finally {
          setIsSearching(false);
        }
      }

      const sportsList = formData.sports;
      if (sportsList.length === 0) {
        toast.error("Please add at least one sport");
        setIsSubmitting(false);
        return;
      }

      const gstNumber = formData.gstNumber.trim().toUpperCase();
      if (gstNumber && !GST_REGEX.test(gstNumber)) {
        toast.error("Enter a valid GST number, or leave it blank.");
        setIsSubmitting(false);
        return;
      }

      if (samePriceForAll) {
        if (basePricePerHour <= 0) {
          toast.error("Please enter a valid base price");
          setIsSubmitting(false);
          return;
        }
      } else {
        const invalidSport = sportsList.find((sport) => (sportPricing[sport] || 0) <= 0);
        if (invalidSport) {
          toast.error(`Please enter a valid price for ${invalidSport}`);
          setIsSubmitting(false);
          return;
        }
      }

      const pricingMap = samePriceForAll
        ? Object.fromEntries(sportsList.map((sport) => [sport, basePricePerHour]))
        : sportsList.reduce<Record<string, number>>((acc, sport) => {
            acc[sport] = sportPricing[sport] || 0;
            return acc;
          }, {});

      const effectiveBasePrice = samePriceForAll
        ? basePricePerHour
        : Math.min(...Object.values(pricingMap));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const venueData: any = {
        ownerName: formData.ownerName,
        ownerEmail: formData.ownerEmail,
        ownerPhone: normalizedPhone,
        name: formData.name,
        address: formData.address,
        sports: sportsList,
        pricePerHour: effectiveBasePrice,
        sportPricing: pricingMap,
        amenities: formData.amenities ? formData.amenities.split(",").map((a) => a.trim()) : [],
        description: formData.description,
        openingHours: formData.openingHours,
        gstNumber,
      };

      if (formData.location) {
        venueData.location = {
          type: "Point",
          coordinates: [formData.location.lng, formData.location.lat],
        };
      }

      let savedVenueId = editingVenue?.id;
      if (editingVenue) {
        await venueApi.updateVenue(editingVenue.id, venueData);
      } else {
        const created = await venueApi.createVenue(venueData);
        savedVenueId = created.data?.id;
      }

      const preservedCoverPhoto =
        existingCoverPhotoUrl && existingImages.includes(existingCoverPhotoUrl)
          ? existingCoverPhotoUrl
          : existingImages[0] || "";

      if (savedVenueId && selectedImages.length > 0) {
        setIsUploadingImages(true);
        const imageUploadResponse = await venueApi.getVenueImageUploadUrls(
          savedVenueId,
          selectedImages.map((image) => ({
            fileName: image.file.name,
            contentType: image.file.type,
          })),
          coverPhotoIndex
        );
        const uploadUrls = imageUploadResponse.data?.uploadUrls || [];
        if (uploadUrls.length !== selectedImages.length) {
          throw new Error("Failed to generate image upload URLs");
        }

        await Promise.all(
          uploadUrls.map((uploadUrl, index) =>
            uploadFileToPresignedUrl(
              selectedImages[index].file,
              uploadUrl.uploadUrl,
              uploadUrl.contentType
            )
          )
        );

        const imageUrls = uploadUrls.map((url) => url.downloadUrl);
        const mergedImages = dedupeUrls([...existingImages, ...imageUrls]);
        const coverPhotoUrl =
          imageUrls[coverPhotoIndex] || preservedCoverPhoto || mergedImages[0] || "";
        await venueApi.updateVenue(savedVenueId, {
          images: mergedImages,
          coverPhotoUrl,
        });
      } else if (savedVenueId && editingVenue) {
        await venueApi.updateVenue(savedVenueId, {
          images: existingImages,
          coverPhotoUrl: preservedCoverPhoto,
        });
      } else if (!savedVenueId && selectedImages.length > 0) {
        throw new Error("Unable to upload images without a venue ID");
      }

      resetForm();
      setShowForm(false);
      setEditingVenue(null);
      loadVenues();
      toast.success(editingVenue ? "Venue updated." : "Venue created.");
    } catch (error: unknown) {
      console.error("Failed to save venue:", error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(apiError.response?.data?.message || "Failed to save venue");
    } finally {
      setIsUploadingImages(false);
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      name: "",
      address: "",
      location: null,
      sports: [],
      pricePerHour: "",
      amenities: "",
      description: "",
      gstNumber: "",
      openingHours: {
        monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      },
    });
    setSamePriceForAll(true);
    setBasePricePerHour(0);
    setSportPricing({});
    setSelectedAmenities([]);
    setAddressQuery("");
    setSuggestions([]);
    setSearchError("");
    setHasSelectedLocation(false);
    setSelectedImages([]);
    setExistingImages([]);
    setExistingGeneralImages([]);
    setExistingSportImages({});
    setExistingCoverPhotoUrl("");
    setCoverPhotoIndex(0);
    setImageError("");
    setFieldErrors({});
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    let loc = null;
    if (venue.location && venue.location.coordinates && venue.location.coordinates.length === 2) {
      loc = {
        lng: venue.location.coordinates[0],
        lat: venue.location.coordinates[1],
      };
    }

    const pricingForEdit =
      venue.sportPricing && Object.keys(venue.sportPricing).length > 0
        ? venue.sportPricing
        : venue.sports.reduce<Record<string, number>>((acc, sport) => {
            acc[sport] = venue.pricePerHour;
            return acc;
          }, {});
    const allSamePrice = Object.values(pricingForEdit).every(
      (value) => value === venue.pricePerHour
    );

    setSamePriceForAll(allSamePrice);
    setBasePricePerHour(venue.pricePerHour);
    setSportPricing(pricingForEdit);

    const resolvedAddress =
      venue.address ||
      (venue.location?.coordinates
        ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
        : "");

    const defaultOpeningHours = {
      monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
    };

    const venueOwnerPhone = normalizePhone(
      (venue as { ownerPhone?: string; ownerPhoneNumber?: string }).ownerPhone ||
        (venue as { ownerPhone?: string; ownerPhoneNumber?: string }).ownerPhoneNumber ||
        user?.phone
    );

    const resolvedCoverPhotoUrl = venue.coverPhotoUrl
      ? venue.coverPhotoUrl
      : venue.coverPhotoKey
        ? toS3Url(venue.coverPhotoKey)
        : "";

    setFormData({
      ownerName: user?.name || "",
      ownerEmail: user?.email || "",
      ownerPhone: venueOwnerPhone,
      name: venue.name,
      address: resolvedAddress,
      location: loc,
      sports: venue.sports,
      pricePerHour: venue.pricePerHour.toString(),
      amenities: venue.amenities?.join(", ") || "",
      description: venue.description || "",
      gstNumber: venue.gstNumber || "",
      openingHours: defaultOpeningHours,
    });
    const imageGroups = getVenueImageGroups(venue);

    setSelectedAmenities(venue.amenities || []);
    setAddressQuery(resolvedAddress);
    setHasSelectedLocation(Boolean(loc));
    setExistingImages(imageGroups.all);
    setExistingGeneralImages(imageGroups.general);
    setExistingSportImages(imageGroups.sports);
    setExistingCoverPhotoUrl(resolvedCoverPhotoUrl);
    setSelectedImages([]);
    setImageError("");
    setCoverPhotoIndex(0);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (venueId: string) => {
    if (!confirm("Are you sure you want to delete this venue?")) return;

    try {
      await venueApi.deleteVenue(venueId);
      toast.success("Venue deleted.");
      loadVenues();
    } catch {
      toast.error("Failed to delete venue");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVenue(null);
    resetForm();
  };

  // ── Stats derived from venues ──────────────────────────────────────────────

  const totalSports = new Set(venues.flatMap((v) => v.sports)).size;
  const venuesWithPhotos = venues.filter((v) => Boolean(getCoverPhoto(v))).length;
  const avgRating =
    venues.filter((v) => v.rating && v.rating > 0).length > 0
      ? venues
          .filter((v) => v.rating && v.rating > 0)
          .reduce((sum, v) => sum + (v.rating ?? 0), 0) /
        venues.filter((v) => v.rating && v.rating > 0).length
      : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8">
          <div className="mb-4 h-4 w-24 rounded-full bg-slate-100" />
          <div className="mb-3 h-8 w-52 rounded-full bg-slate-100" />
          <div className="h-4 w-80 rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-100 bg-white p-4"
            />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <VenueSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const hasExistingSportImages = Object.values(existingSportImages).some((urls) => urls.length > 0);
  const hasExistingImages = existingGeneralImages.length > 0 || hasExistingSportImages;

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page header ── */}
      <SlideUp delay={0}>
        <PlayerPageHeader
          badge="Venue Lister"
          title="My Venues"
          subtitle="Manage listings, pricing, and availability for every venue you host."
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/venue-lister/vendor-bookings">
                <Button variant="secondary" size="sm">
                  View Bookings
                </Button>
              </Link>
              {!showForm && canAddMoreVenues && (
                <Button
                  onClick={() => setShowForm(true)}
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add Venue
                </Button>
              )}
            </div>
          }
        />
      </SlideUp>

      {/* ── Restriction banner ── */}
      {!canAddMoreVenues && !showForm && (
        <SlideUp delay={0.05}>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Single venue mode</p>
              <p className="mt-0.5 text-sm text-amber-700">
                You can manage your approved venue below. To list additional venues, contact our
                support team.
              </p>
            </div>
          </div>
        </SlideUp>
      )}

      {/* ── Stats bar (visible when venues exist and form is not open) ── */}
      {venues.length > 0 && !showForm && (
        <SlideUp delay={0.08}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Total Venues",
                value: venues.length,
                icon: <Building2 className="h-4 w-4" />,
                color: "text-power-orange",
                bg: "bg-orange-50",
              },
              {
                label: "Sports Offered",
                value: totalSports,
                icon: <Layout className="h-4 w-4" />,
                color: "text-indigo-500",
                bg: "bg-indigo-50",
              },
              {
                label: "With Photos",
                value: venuesWithPhotos,
                icon: <ImageOff className="h-4 w-4" />,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                label: "Avg Rating",
                value: avgRating !== null ? avgRating.toFixed(1) : "—",
                icon: <Star className="h-4 w-4" />,
                color: "text-amber-500",
                bg: "bg-amber-50",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div
                  className={`h-9 w-9 rounded-lg ${stat.bg} ${stat.color} flex shrink-0 items-center justify-center`}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-slate-900">{stat.value}</p>
                  <p className="truncate text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </SlideUp>
      )}

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <SlideUp delay={0.05}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Building2 className="text-power-orange h-6 w-6" />
              </div>
              <h2 className="mb-1 text-2xl font-bold text-slate-900">
                {editingVenue ? "Edit Venue" : "Create New Venue"}
              </h2>
              <p className="text-sm text-slate-500">
                {editingVenue
                  ? "Update your venue details and information"
                  : "Add your venue to the platform"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Owner Contact Information */}
              <OnboardingSectionCard
                title="Owner Contact Information"
                subtitle="Your contact details for venue management"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          ownerName: e.target.value,
                        }));
                        if (fieldErrors.ownerName) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.ownerName;
                            return next;
                          });
                        }
                      }}
                      placeholder="Your full name"
                      className={getInputClassName(Boolean(fieldErrors.ownerName))}
                      required
                    />
                    {fieldErrors.ownerName && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerName}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      This will be your primary contact name
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          ownerEmail: e.target.value,
                        }));
                        if (fieldErrors.ownerEmail) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.ownerEmail;
                            return next;
                          });
                        }
                      }}
                      placeholder="your.email@example.com"
                      className={getInputClassName(Boolean(fieldErrors.ownerEmail))}
                      required
                    />
                    {fieldErrors.ownerEmail && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerEmail}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      Used for important updates and bookings
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.ownerPhone}
                      onChange={(e) => {
                        const normalized = normalizePhone(e.target.value);
                        setFormData((prev) => ({
                          ...prev,
                          ownerPhone: normalized,
                        }));
                        if (fieldErrors.ownerPhone) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.ownerPhone;
                            return next;
                          });
                        }
                      }}
                      placeholder="Your phone number"
                      className={getInputClassName(Boolean(fieldErrors.ownerPhone))}
                      required
                    />
                    {fieldErrors.ownerPhone && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerPhone}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      Customers may contact you about bookings
                    </p>
                  </div>
                </div>
              </OnboardingSectionCard>

              {/* Venue Details */}
              <OnboardingSectionCard
                title="Venue Details"
                subtitle="Basic information about your venue"
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Venue Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Elite Sports Arena"
                      className={getInputClassName(Boolean(fieldErrors.name))}
                      required
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.name}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      This is how customers will see your venue
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      GST Number (optional)
                    </label>
                    <input
                      type="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={formData.gstNumber}
                      maxLength={15}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          gstNumber: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      className={getInputClassName(false)}
                    />
                    <p className="mt-1 text-xs text-slate-600">
                      Only if you&apos;re GST-registered — shown on booking invoices for this venue.
                    </p>
                  </div>

                  <div className="relative">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addressQuery}
                      onChange={handleAddressChange}
                      placeholder="Search your venue location"
                      className={getInputClassName(Boolean(fieldErrors.address))}
                      required
                    />
                    {isSearching && (
                      <span className="absolute right-3 top-9 text-xs text-slate-500">
                        Searching…
                      </span>
                    )}
                    {searchError && <p className="mt-1 text-xs text-red-500">{searchError}</p>}
                    {fieldErrors.address && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.address}</p>
                    )}
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {suggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion.label}
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="w-full border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      Select from suggestions for accurate location
                    </p>
                  </div>
                </div>
              </OnboardingSectionCard>

              {/* Sports & Pricing */}
              <OnboardingSectionCard
                title="Sports & Pricing"
                subtitle="Specify which sports you offer and set prices"
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-900">
                      Sports Available <span className="text-red-500">*</span>
                    </label>
                    <SportsMultiSelect
                      value={formData.sports}
                      onChange={handleSportsChange}
                      required
                    />
                    {fieldErrors.sports && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.sports}</p>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={samePriceForAll}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSamePriceForAll(checked);
                          if (checked) {
                            const sportsList = formData.sports;
                            const nextPricing: Record<string, number> = {};
                            sportsList.forEach((sport) => {
                              nextPricing[sport] = basePricePerHour;
                            });
                            setSportPricing(nextPricing);
                          }
                        }}
                        className="accent-power-orange h-4 w-4 rounded"
                      />
                      <label className="text-sm font-medium text-slate-900">
                        Same price for all sports
                      </label>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        {samePriceForAll ? "Price per hour" : "Base price per hour"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={basePricePerHour}
                        onChange={(e) => handleBasePriceChange(parseFloat(e.target.value) || 0)}
                        placeholder="e.g., 1500"
                        className={getInputClassName(Boolean(fieldErrors.pricePerHour))}
                        required
                        min="0"
                        step="0.01"
                      />
                      {fieldErrors.pricePerHour && (
                        <p className="mt-1 text-sm text-red-500">{fieldErrors.pricePerHour}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-600">Amount customers pay per hour</p>
                    </div>

                    {!samePriceForAll && formData.sports.length > 0 && (
                      <div className="mt-4 space-y-3 border-t pt-4">
                        {formData.sports.map((sport) => (
                          <div key={sport}>
                            <label className="mb-2 block text-sm font-medium text-slate-900">
                              {sport} price per hour
                            </label>
                            <input
                              type="number"
                              value={sportPricing[sport] ?? ""}
                              onChange={(e) =>
                                handleSportPriceChange(sport, parseFloat(e.target.value) || 0)
                              }
                              placeholder="Enter price"
                              className={getInputClassName(false)}
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </OnboardingSectionCard>

              {/* Opening Hours */}
              <OnboardingSectionCard
                title="Operating Hours"
                subtitle="Set your venue's daily operating schedule"
              >
                <OpeningHoursInput
                  value={formData.openingHours}
                  onChange={(hours) => {
                    const validatedHours = Object.fromEntries(
                      Object.entries(hours).map(([day, hourData]) => [
                        day,
                        {
                          isOpen: hourData.isOpen,
                          openTime: hourData.openTime || "09:00",
                          closeTime: hourData.closeTime || "21:00",
                        },
                      ])
                    ) as typeof formData.openingHours;

                    setFormData((prev) => ({
                      ownerName: prev.ownerName,
                      ownerEmail: prev.ownerEmail,
                      ownerPhone: prev.ownerPhone,
                      name: prev.name,
                      address: prev.address,
                      location: prev.location,
                      sports: prev.sports,
                      pricePerHour: prev.pricePerHour,
                      amenities: prev.amenities,
                      description: prev.description,
                      gstNumber: prev.gstNumber,
                      openingHours: validatedHours,
                    }));
                  }}
                />
              </OnboardingSectionCard>

              {/* Amenities & Description */}
              <OnboardingSectionCard
                title="Amenities & Description"
                subtitle="Tell customers what your venue offers"
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-900">
                      Amenities
                    </label>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {AMENITIES_OPTIONS.map((amenity) => (
                        <label key={amenity} className="flex cursor-pointer items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedAmenities.includes(amenity)}
                            onChange={() => toggleAmenity(amenity)}
                            className="text-power-orange h-4 w-4 rounded"
                          />
                          <span className="text-sm text-slate-700">{amenity}</span>
                        </label>
                      ))}
                    </div>
                    {fieldErrors.amenities && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.amenities}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Describe your venue, its features, and atmosphere…"
                      className={getInputClassName(Boolean(fieldErrors.description))}
                    />
                    {fieldErrors.description && (
                      <p className="mt-1 text-sm text-red-500">{fieldErrors.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      A detailed description helps attract more customers
                    </p>
                  </div>
                </div>
              </OnboardingSectionCard>

              {/* Images */}
              <OnboardingSectionCard
                title="Venue Images"
                subtitle="Upload high-quality photos to showcase your venue"
              >
                <div className="space-y-6">
                  {(selectedImages.length > 0 || existingImages.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>{selectedImages.length + existingImages.length} images</span>
                        <span className="text-power-orange font-medium">
                          {selectedImages.length + existingImages.length}/10
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="bg-power-orange h-full transition-all duration-300"
                          style={{
                            width: `${((selectedImages.length + existingImages.length) / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {hasExistingImages && (
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="bg-power-orange/10 text-power-orange rounded px-2 py-1 text-xs">
                          Current
                        </span>
                        Current Images ({existingImages.length})
                      </h3>

                      {existingGeneralImages.length > 0 && (
                        <div className="mb-6">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">
                            General Venue Images ({existingGeneralImages.length})
                          </h4>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {existingGeneralImages.map((url, index) => (
                              <div
                                key={`general-${url}-${index}`}
                                className="group/img relative overflow-hidden rounded-xl border border-slate-200"
                              >
                                <img
                                  src={url}
                                  alt={`General venue ${index + 1}`}
                                  className="h-48 w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingImage(url)}
                                  className="absolute left-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                                  aria-label="Remove image"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                                {existingCoverPhotoUrl === url && (
                                  <span className="bg-power-orange absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                                    Cover
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.entries(existingSportImages).map(([sport, urls], sportIndex) =>
                        urls.length > 0 ? (
                          <div key={`${sport}-${sportIndex}`} className="mb-6 last:mb-0">
                            <h4 className="mb-3 text-sm font-semibold text-slate-900">
                              {formatSportLabel(sport)} Images ({urls.length})
                            </h4>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                              {urls.map((url, index) => (
                                <div
                                  key={`${sport}-${url}-${index}`}
                                  className="relative overflow-hidden rounded-xl border border-slate-200"
                                >
                                  <img
                                    src={url}
                                    alt={`${formatSportLabel(sport)} ${index + 1}`}
                                    className="h-40 w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeExistingImage(url)}
                                    className="absolute left-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                                    aria-label="Remove image"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                  {existingCoverPhotoUrl === url && (
                                    <span className="bg-power-orange absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                                      Cover
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="bg-power-orange/10 text-power-orange rounded px-2 py-1 text-xs">
                        Add More
                      </span>
                      Add More Images
                    </h3>
                    <label className="block cursor-pointer">
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 transition-all hover:border-orange-300 hover:bg-orange-50/30">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                          <Camera className="h-6 w-6 text-orange-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700">
                            Click to upload images
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            JPG, PNG or WebP · up to 5 MB each · max 10 images
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleImageSelection(e.target.files)}
                        className="hidden"
                      />
                    </label>
                    {imageError && <p className="mt-2 text-sm text-red-500">{imageError}</p>}
                  </div>

                  {selectedImages.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-900">
                        New Images Ready ({selectedImages.length})
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {selectedImages.map((image, index) => (
                          <div
                            key={image.preview}
                            className="relative overflow-hidden rounded-xl border border-slate-200"
                          >
                            <img
                              src={image.preview}
                              alt={`Selected ${index + 1}`}
                              className="h-48 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            {coverPhotoIndex === index && (
                              <span className="bg-power-orange absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                                Cover
                              </span>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-3 py-2">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  name="coverPhoto"
                                  checked={coverPhotoIndex === index}
                                  onChange={() => setCoverPhotoIndex(index)}
                                  className="accent-power-orange h-3.5 w-3.5"
                                />
                                <span className="text-xs font-medium text-white">Set as cover</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isUploadingImages && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                      <div className="border-power-orange h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                      Uploading images…
                    </div>
                  )}
                </div>
              </OnboardingSectionCard>

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  variant="primary"
                  className="flex-1"
                >
                  {isSubmitting ? "Saving…" : editingVenue ? "Update Venue" : "Create Venue"}
                </Button>
                <Button type="button" onClick={handleCancel} variant="secondary" className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </SlideUp>
      )}

      {/* ── Venues list / empty state ── */}
      {!showForm && (
        <>
          {venues.length === 0 ? (
            <SlideUp delay={0.1}>
              <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-slate-100 bg-white px-8 py-16 text-center shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                  <Building2 className="h-8 w-8 text-orange-400" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-slate-900">No venues yet</h3>
                  <p className="max-w-xs text-sm text-slate-500">
                    Add your first venue to start receiving bookings and generating revenue.
                  </p>
                </div>
                {canAddMoreVenues && (
                  <Button
                    onClick={() => setShowForm(true)}
                    variant="primary"
                    size="md"
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add Your First Venue
                  </Button>
                )}
                {!canAddMoreVenues && (
                  <p className="text-xs text-slate-400">
                    Contact support to activate your first venue listing.
                  </p>
                )}
              </div>
            </SlideUp>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue, index) => (
                <VenueCard
                  key={venue.id || venue._id || index}
                  venue={venue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  index={index}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
