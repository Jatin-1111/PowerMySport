import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { venueApi } from "@/modules/venue/services/venue";
import {
  DEFAULT_OPENING_HOURS,
  GST_REGEX,
  dedupeUrls,
  getCoverPhoto,
  getVenueImageGroups,
  isValidPhone,
  normalizePhone,
  toS3Url,
} from "@/modules/venue/utils/inventoryFlow";
import { Venue } from "@/types";
import { useEffect, useRef, useState } from "react";

const buildInitialFormData = () => ({
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
  openingHours: DEFAULT_OPENING_HOURS,
});

/**
 * All state, effects and handlers for the venue-lister inventory page —
 * extracted so the route file holds only routing and composition. No logic
 * changed, only where it lives.
 */
export function useVenueInventoryFlow() {
  const { user } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(buildInitialFormData());
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

  useEffect(() => {
    loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleToggleSamePriceForAll = (checked: boolean) => {
    setSamePriceForAll(checked);
    if (checked) {
      const sportsList = formData.sports;
      const nextPricing: Record<string, number> = {};
      sportsList.forEach((sport) => {
        nextPricing[sport] = basePricePerHour;
      });
      setSportPricing(nextPricing);
    }
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

  const resetForm = () => {
    setFormData(buildInitialFormData());
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
      openingHours: DEFAULT_OPENING_HOURS,
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

  return {
    venues,
    loading,
    showForm,
    setShowForm,
    editingVenue,
    fieldErrors,
    setFieldErrors,
    formData,
    setFormData,
    selectedAmenities,
    samePriceForAll,
    basePricePerHour,
    sportPricing,
    isSubmitting,
    addressQuery,
    suggestions,
    isSearching,
    searchError,
    selectedImages,
    existingImages,
    existingGeneralImages,
    existingSportImages,
    existingCoverPhotoUrl,
    coverPhotoIndex,
    setCoverPhotoIndex,
    isUploadingImages,
    imageError,

    canAddMoreVenues,

    handleChange,
    handleSportsChange,
    toggleAmenity,
    handleBasePriceChange,
    handleSportPriceChange,
    handleToggleSamePriceForAll,
    handleImageSelection,
    handleRemoveImage,
    removeExistingImage,
    handleAddressChange,
    handleSelectSuggestion,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancel,

    totalSports,
    venuesWithPhotos,
    avgRating,
  };
}
