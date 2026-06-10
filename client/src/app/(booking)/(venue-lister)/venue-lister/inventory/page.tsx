"use client";

import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import OnboardingSectionCard from "@/modules/onboarding/components/onboarding/OnboardingSectionCard";
import OpeningHoursInput from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { venueApi } from "@/modules/venue/services/venue";
import { Venue } from "@/types";
import { Camera, X } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

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

const S3_BUCKET_HOST =
  "https://powermysport-images.s3.ap-south-1.amazonaws.com";

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
  const generalKeys = venue.generalImageKeys
    ? venue.generalImageKeys.map(toS3Url)
    : [];
  const baseGeneral = [...generalImages, ...generalKeys];

  const sportsEntries = new Map<string, string[]>();
  if (venue.sportImages) {
    Object.entries(venue.sportImages).forEach(([sport, urls]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [
        ...(sportsEntries.get(sport) || []),
        ...(urls || []),
      ]);
    });
  }

  if (venue.sportImageKeys) {
    Object.entries(venue.sportImageKeys).forEach(([sport, keys]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [
        ...(sportsEntries.get(sport) || []),
        ...(keys || []).map(toS3Url),
      ]);
    });
  }

  const hasStructured = baseGeneral.length > 0 || sportsEntries.size > 0;
  const fallbackGeneral = hasStructured ? [] : [...directImages, ...directKeys];
  const general = dedupeUrls([...baseGeneral, ...fallbackGeneral]);
  const generalIdentities = new Set(
    general.map((url) => normalizeImageIdentity(url)),
  );

  const sports = Object.fromEntries(
    Array.from(sportsEntries.entries()).map(([sport, urls]) => {
      const filtered = urls.filter((url) => {
        const identity = normalizeImageIdentity(url);
        return identity && !generalIdentities.has(identity);
      });
      return [sport, dedupeUrls(filtered)];
    }),
  );

  const all = dedupeUrls([
    ...general,
    ...Object.values(sports).flat(),
    ...directImages,
    ...directKeys,
  ]);

  return { general, sports, all };
};

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
  const [selectedImages, setSelectedImages] = useState<
    Array<{ file: File; preview: string }>
  >([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingGeneralImages, setExistingGeneralImages] = useState<string[]>(
    [],
  );
  const [existingSportImages, setExistingSportImages] = useState<
    Record<string, string[]>
  >({});
  const [existingCoverPhotoUrl, setExistingCoverPhotoUrl] = useState("");
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageError, setImageError] = useState("");

  // Check if user can add more venues (defaults to false for venue listers from inquiry)
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
      } catch (err) {
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
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
      if (!allowedTypes.includes(file.type)) {
        return false;
      }
      if (file.size > maxSizeBytes) {
        return false;
      }
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
            toast.error(
              "We couldn't find this address. Please pick a suggestion.",
            );
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
        } catch (error) {
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

      if (samePriceForAll) {
        if (basePricePerHour <= 0) {
          toast.error("Please enter a valid base price");
          setIsSubmitting(false);
          return;
        }
      } else {
        const invalidSport = sportsList.find(
          (sport) => (sportPricing[sport] || 0) <= 0,
        );
        if (invalidSport) {
          toast.error(`Please enter a valid price for ${invalidSport}`);
          setIsSubmitting(false);
          return;
        }
      }

      const pricingMap = samePriceForAll
        ? Object.fromEntries(
            sportsList.map((sport) => [sport, basePricePerHour]),
          )
        : sportsList.reduce<Record<string, number>>((acc, sport) => {
            acc[sport] = sportPricing[sport] || 0;
            return acc;
          }, {});

      const effectiveBasePrice = samePriceForAll
        ? basePricePerHour
        : Math.min(...Object.values(pricingMap));

      const venueData: any = {
        ownerName: formData.ownerName,
        ownerEmail: formData.ownerEmail,
        ownerPhone: normalizedPhone,
        name: formData.name,
        address: formData.address, // Send address string
        sports: sportsList,
        pricePerHour: effectiveBasePrice,
        sportPricing: pricingMap,
        amenities: formData.amenities
          ? formData.amenities.split(",").map((a) => a.trim())
          : [],
        description: formData.description,
        openingHours: formData.openingHours,
      };

      // Transform location to GeoJSON if present
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
          coverPhotoIndex,
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
              uploadUrl.contentType,
            ),
          ),
        );

        const imageUrls = uploadUrls.map((url) => url.downloadUrl);
        const mergedImages = dedupeUrls([...existingImages, ...imageUrls]);
        const coverPhotoUrl =
          imageUrls[coverPhotoIndex] ||
          preservedCoverPhoto ||
          mergedImages[0] ||
          "";
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

      // Reset form and reload
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
      setShowForm(false);
      setEditingVenue(null);
      loadVenues();
    } catch (error: any) {
      console.error("Failed to save venue:", error);
      toast.error(error.response?.data?.message || "Failed to save venue");
    } finally {
      setIsUploadingImages(false);
      setIsSubmitting(false);
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    // Extract coordinates if available
    let loc = null;
    if (
      venue.location &&
      venue.location.coordinates &&
      venue.location.coordinates.length === 2
    ) {
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
      (value) => value === venue.pricePerHour,
    );

    setSamePriceForAll(allSamePrice);
    setBasePricePerHour(venue.pricePerHour);
    setSportPricing(pricingForEdit);

    const resolvedAddress =
      venue.address ||
      (venue.location?.coordinates
        ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
        : "");

    // Default opening hours structure
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
      (venue as { ownerPhone?: string; ownerPhoneNumber?: string })
        .ownerPhone ||
        (venue as { ownerPhone?: string; ownerPhoneNumber?: string })
          .ownerPhoneNumber ||
        user?.phone,
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
  };

  const handleDelete = async (venueId: string) => {
    if (!confirm("Are you sure you want to delete this venue?")) return;

    try {
      await venueApi.deleteVenue(venueId);
      loadVenues();
    } catch (error) {
      console.error("Failed to delete venue:", error);
      toast.error("Failed to delete venue");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVenue(null);
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
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Loading venues...</p>
      </div>
    );
  }

  const hasExistingSportImages = Object.values(existingSportImages).some(
    (urls) => urls.length > 0,
  );
  const hasExistingImages =
    existingGeneralImages.length > 0 || hasExistingSportImages;

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Venue Lister"
        title="My Venues"
        subtitle="Manage listings, pricing, and availability for every venue you host."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/venue-lister/vendor-bookings">
              <Button variant="secondary">View Bookings</Button>
            </Link>
            {!showForm && canAddMoreVenues && (
              <Button onClick={() => setShowForm(true)} variant="primary">
                Add Venue
              </Button>
            )}
          </div>
        }
      />

      {/* Restriction message for venue listers who cannot add more */}
      {!canAddMoreVenues && !showForm && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
          <p className="text-yellow-800">
            <strong>Note:</strong> You can only manage your approved venue. To
            add more venues, please contact our support team.
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {editingVenue ? "Edit Your Venue" : "Create New Venue"}
            </h2>
            <p className="text-slate-600">
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
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className={getInputClassName(
                      Boolean(fieldErrors.ownerName),
                    )}
                    required
                  />
                  {fieldErrors.ownerName && (
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.ownerName}
                    </p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
                    This will be your primary contact name
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className={getInputClassName(
                      Boolean(fieldErrors.ownerEmail),
                    )}
                    required
                  />
                  {fieldErrors.ownerEmail && (
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.ownerEmail}
                    </p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
                    Used for important updates and bookings
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className={getInputClassName(
                      Boolean(fieldErrors.ownerPhone),
                    )}
                    required
                  />
                  {fieldErrors.ownerPhone && (
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.ownerPhone}
                    </p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
                    Customers may contact you about bookings
                  </p>
                </div>
              </div>
            </OnboardingSectionCard>

            {/* Venue Basic Details */}
            <OnboardingSectionCard
              title="Venue Details"
              subtitle="Basic information about your venue"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.name}
                    </p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
                    This is how customers will see your venue
                  </p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                      Searching...
                    </span>
                  )}
                  {searchError && (
                    <p className="text-red-500 text-xs mt-1">{searchError}</p>
                  )}
                  {fieldErrors.address && (
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.address}
                    </p>
                  )}
                  {suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {suggestions.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion.label}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
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
                  <label className="block text-sm font-semibold text-slate-900 mb-3">
                    Sports Available <span className="text-red-500">*</span>
                  </label>
                  <SportsMultiSelect
                    value={formData.sports}
                    onChange={handleSportsChange}
                    required
                  />
                  {fieldErrors.sports && (
                    <p className="text-red-500 text-sm mt-2">
                      {fieldErrors.sports}
                    </p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
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
                      className="w-4 h-4 accent-power-orange rounded"
                    />
                    <label className="text-sm font-medium text-slate-900">
                      Same price for all sports
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      {samePriceForAll
                        ? "Price per hour"
                        : "Base price per hour"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={basePricePerHour}
                      onChange={(e) =>
                        handleBasePriceChange(parseFloat(e.target.value) || 0)
                      }
                      placeholder="e.g., 1500"
                      className={getInputClassName(
                        Boolean(fieldErrors.pricePerHour),
                      )}
                      required
                      min="0"
                      step="0.01"
                    />
                    {fieldErrors.pricePerHour && (
                      <p className="text-red-500 text-sm mt-1">
                        {fieldErrors.pricePerHour}
                      </p>
                    )}
                    <p className="text-slate-600 text-xs mt-1">
                      Amount customers pay per hour
                    </p>
                  </div>

                  {!samePriceForAll && formData.sports.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {formData.sports.map((sport) => (
                        <div key={sport}>
                          <label className="block text-sm font-medium text-slate-900 mb-2">
                            {sport} price per hour
                          </label>
                          <input
                            type="number"
                            value={sportPricing[sport] ?? ""}
                            onChange={(e) =>
                              handleSportPriceChange(
                                sport,
                                parseFloat(e.target.value) || 0,
                              )
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
                  // Ensure all times are defined with defaults
                  const validatedHours = Object.fromEntries(
                    Object.entries(hours).map(([day, hourData]) => [
                      day,
                      {
                        isOpen: hourData.isOpen,
                        openTime: hourData.openTime || "09:00",
                        closeTime: hourData.closeTime || "21:00",
                      },
                    ]),
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
                  <label className="block text-sm font-semibold text-slate-900 mb-3">
                    Amenities
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {AMENITIES_OPTIONS.map((amenity) => (
                      <label
                        key={amenity}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(amenity)}
                          onChange={() => toggleAmenity(amenity)}
                          className="w-4 h-4 text-power-orange rounded"
                        />
                        <span className="text-sm text-slate-700">
                          {amenity}
                        </span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.amenities && (
                    <p className="text-red-500 text-sm mt-2">
                      {fieldErrors.amenities}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe your venue, its features, and atmosphere..."
                    className={getInputClassName(
                      Boolean(fieldErrors.description),
                    )}
                  />
                  {fieldErrors.description && (
                    <p className="text-red-500 text-sm mt-1">
                      {fieldErrors.description}
                    </p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
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
                {/* Progress Bar */}
                {(selectedImages.length > 0 || existingImages.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>
                        {selectedImages.length + existingImages.length} images
                        uploaded
                      </span>
                      <span>
                        {Math.round(
                          ((selectedImages.length + existingImages.length) /
                            Math.max(
                              selectedImages.length + existingImages.length,
                              1,
                            )) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-power-orange transition-all duration-300"
                        style={{
                          width: `${((selectedImages.length + existingImages.length) / Math.max(selectedImages.length + existingImages.length, 1)) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Existing Images */}
                {hasExistingImages && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <span className="bg-power-orange/10 text-power-orange px-2 py-1 rounded text-xs">
                        Current
                      </span>
                      Current Images ({existingImages.length})
                    </h3>

                    {existingGeneralImages.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">
                          General Venue Images ({existingGeneralImages.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {existingGeneralImages.map((url, index) => (
                            <div
                              key={`general-${url}-${index}`}
                              className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-power-orange/60 transition"
                            >
                              <div className="relative">
                                <img
                                  src={url}
                                  alt={`General venue ${index + 1}`}
                                  className="w-full h-48 object-cover rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingImage(url)}
                                  className="absolute top-2 left-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                  aria-label="Remove image"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                {existingCoverPhotoUrl === url && (
                                  <span className="absolute top-2 right-2 bg-power-orange text-white text-xs px-2 py-1 rounded">
                                    Cover Photo
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.entries(existingSportImages).map(
                      ([sport, urls], sportIndex) =>
                        urls.length > 0 ? (
                          <div
                            key={`${sport}-${sportIndex}`}
                            className="mb-6 last:mb-0"
                          >
                            <h4 className="text-sm font-semibold text-slate-900 mb-3">
                              {formatSportLabel(sport)} Images ({urls.length})
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {urls.map((url, index) => (
                                <div
                                  key={`${sport}-${url}-${index}`}
                                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-power-orange/60 transition"
                                >
                                  <div className="relative">
                                    <img
                                      src={url}
                                      alt={`${formatSportLabel(sport)} ${
                                        index + 1
                                      }`}
                                      className="w-full h-40 object-cover rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeExistingImage(url)}
                                      className="absolute top-2 left-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                      aria-label="Remove image"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    {existingCoverPhotoUrl === url && (
                                      <span className="absolute top-2 right-2 bg-power-orange text-white text-xs px-2 py-1 rounded">
                                        Cover Photo
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null,
                    )}
                  </div>
                )}

                {/* New Images Upload */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="bg-power-orange/10 text-power-orange px-2 py-1 rounded text-xs">
                      Add More
                    </span>
                    Add More Images
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Upload additional images to enhance your venue's
                    presentation
                  </p>

                  <div className="grid grid-cols-1 gap-4">
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-power-orange/60 transition flex flex-col items-center justify-center">
                        <Camera className="w-12 h-12 mb-3 text-slate-400" />
                        <p className="text-sm font-medium text-slate-900">
                          Click to upload images
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          JPG, PNG up to 5MB each (max 10 images)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleImageSelection(e.target.files)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {imageError && (
                    <p className="text-red-500 text-sm mt-2">{imageError}</p>
                  )}
                </div>

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">
                      New Images Ready to Upload ({selectedImages.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedImages.map((image, index) => (
                        <div
                          key={image.preview}
                          className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-power-orange/60 transition"
                        >
                          <div className="relative">
                            <img
                              src={image.preview}
                              alt={`Selected ${index + 1}`}
                              className="w-full h-48 object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            {/* Cover Photo Selection */}
                            <div className="mt-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="coverPhoto"
                                  checked={coverPhotoIndex === index}
                                  onChange={() => setCoverPhotoIndex(index)}
                                  className="w-4 h-4 accent-power-orange"
                                />
                                <span className="text-sm text-slate-700">
                                  Set as cover photo
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isUploadingImages && (
                  <p className="text-sm text-slate-600 italic text-center py-4">
                    Uploading images...
                  </p>
                )}
              </div>
            </OnboardingSectionCard>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                className="flex-1"
              >
                {isSubmitting
                  ? "Saving..."
                  : editingVenue
                    ? "Update Venue"
                    : "Create Venue"}
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Venues List */}
      {venues.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600 mb-4">No venues added yet</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
            >
              Add your first venue
            </button>
          )}
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className="bg-white hover:shadow-lg transition-shadow p-0 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2 text-slate-900">
                  {venue.name}
                </h3>
                <p className="text-sm text-slate-600 mb-1">
                  <span className="inline mr-1">📍</span>
                  {venue.location?.coordinates
                    ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
                    : "Location not set"}
                </p>
                <p className="text-xs text-slate-500 mb-3">Hours not set</p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {venue.sports.map((sport, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full"
                    >
                      {sport}
                    </span>
                  ))}
                </div>

                <p className="text-xl font-bold text-power-orange sm:text-2xl mb-4">
                  ₹{venue.pricePerHour}
                  <span className="text-sm text-slate-600">/hour</span>
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEdit(venue)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(venue.id)}
                    variant="danger"
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
