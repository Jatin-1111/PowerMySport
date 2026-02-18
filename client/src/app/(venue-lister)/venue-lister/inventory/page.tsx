"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { venueApi } from "@/modules/venue/services/venue";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { Venue } from "@/types";
import { MapPin } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

export default function VenueInventoryPage() {
  const { user } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    location: null as { lat: number; lng: number } | null,
    sports: "",
    pricePerHour: "",
    amenities: "",
    description: "",
    openingHours: "9:00 AM - 9:00 PM",
  });
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState(0);
  const [sportPricing, setSportPricing] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [selectedImages, setSelectedImages] = useState<
    Array<{ file: File; preview: string }>
  >([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageError, setImageError] = useState("");

  // Check if user can add more venues (defaults to false for venue listers from inquiry)
  const canAddMoreVenues = user?.venueListerProfile?.canAddMoreVenues ?? true;

  useEffect(() => {
    loadVenues();
  }, []);

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
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
    if (e.target.name === "sports") {
      const nextSports = parseSportsInput(e.target.value);
      setSportPricing((prevPricing) => {
        const nextPricing: Record<string, number> = {};
        nextSports.forEach((sport) => {
          nextPricing[sport] =
            prevPricing[sport] ?? (samePriceForAll ? basePricePerHour : 0);
        });
        return nextPricing;
      });
    }
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const parseSportsInput = (value: string) =>
    value
      .split(",")
      .map((sport) => sport.trim())
      .filter((sport) => sport.length > 0);

  const handleBasePriceChange = (value: number) => {
    setBasePricePerHour(value);
    if (samePriceForAll) {
      const sportsList = parseSportsInput(formData.sports);
      setSportPricing(() => {
        const nextPricing: Record<string, number> = {};
        sportsList.forEach((sport) => {
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

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddressQuery(value);
    setHasSelectedLocation(false);
    setFormData((prev) => ({
      ...prev,
      address: value,
    }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
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
      if (!formData.address.trim()) {
        alert("Please enter a venue address");
        setIsSubmitting(false);
        return;
      }

      if (!hasSelectedLocation) {
        setIsSearching(true);
        setSearchError("");
        try {
          const result = await geoApi.geocode(formData.address);
          if (!result) {
            alert("We couldn't find this address. Please pick a suggestion.");
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

      const sportsList = parseSportsInput(formData.sports);
      if (sportsList.length === 0) {
        alert("Please add at least one sport");
        setIsSubmitting(false);
        return;
      }

      if (samePriceForAll) {
        if (basePricePerHour <= 0) {
          alert("Please enter a valid base price");
          setIsSubmitting(false);
          return;
        }
      } else {
        const invalidSport = sportsList.find(
          (sport) => (sportPricing[sport] || 0) <= 0,
        );
        if (invalidSport) {
          alert(`Please enter a valid price for ${invalidSport}`);
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
        const coverPhotoUrl = imageUrls[coverPhotoIndex] || imageUrls[0];
        await venueApi.updateVenue(savedVenueId, {
          images: imageUrls,
          coverPhotoUrl,
        });
      } else if (!savedVenueId && selectedImages.length > 0) {
        throw new Error("Unable to upload images without a venue ID");
      }

      // Reset form and reload
      setFormData({
        name: "",
        address: "",
        location: null,
        sports: "",
        pricePerHour: "",
        amenities: "",
        description: "",
        openingHours: "9:00 AM - 9:00 PM",
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
      setCoverPhotoIndex(0);
      setImageError("");
      setShowForm(false);
      setEditingVenue(null);
      loadVenues();
    } catch (error: any) {
      console.error("Failed to save venue:", error);
      alert(error.response?.data?.message || "Failed to save venue");
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

    setFormData({
      name: venue.name,
      address: resolvedAddress,
      location: loc,
      sports: venue.sports.join(", "),
      pricePerHour: venue.pricePerHour.toString(),
      amenities: venue.amenities?.join(", ") || "",
      description: venue.description || "",
      openingHours: "9:00 AM - 9:00 PM",
    });
    setAddressQuery(resolvedAddress);
    setHasSelectedLocation(Boolean(loc));
    setExistingImages(venue.images || []);
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
      alert("Failed to delete venue");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVenue(null);
    setFormData({
      name: "",
      address: "",
      location: null,
      sports: "",
      pricePerHour: "",
      amenities: "",
      description: "",
      openingHours: "9:00 AM - 9:00 PM",
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
            add more venues, please contact our admin team.
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="bg-white mb-6">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            {editingVenue ? "Edit Venue" : "Add New Venue"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Venue Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Elite Sports Arena"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={addressQuery}
                  onChange={handleAddressChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="Search your venue location"
                />
                {isSearching && (
                  <span className="absolute right-3 top-12 text-xs text-slate-500">
                    Searching...
                  </span>
                )}
                {searchError && (
                  <p className="text-xs text-red-600 mt-2">{searchError}</p>
                )}
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion.label}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Sports (comma-separated) *
                </label>
                <input
                  type="text"
                  name="sports"
                  value={formData.sports}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Cricket, Football, Badminton"
                />
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-medium text-slate-900">
                    Pricing (per hour) *
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={samePriceForAll}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSamePriceForAll(checked);
                        if (checked) {
                          const sportsList = parseSportsInput(formData.sports);
                          const nextPricing: Record<string, number> = {};
                          sportsList.forEach((sport) => {
                            nextPricing[sport] = basePricePerHour;
                          });
                          setSportPricing(nextPricing);
                        }
                      }}
                      className="w-4 h-4 accent-power-orange rounded"
                    />
                    Same price for all sports
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Base price per hour
                    </label>
                    <input
                      type="number"
                      value={basePricePerHour}
                      onChange={(e) =>
                        handleBasePriceChange(parseFloat(e.target.value) || 0)
                      }
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                      placeholder="e.g., 1500"
                    />
                  </div>
                </div>

                {formData.sports.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Add sports to set specific prices.
                  </p>
                )}

                {!samePriceForAll &&
                  parseSportsInput(formData.sports).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {parseSportsInput(formData.sports).map((sport) => (
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
                            required
                            min="0"
                            step="0.01"
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                            placeholder="e.g., 1500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Opening Hours
              </label>
              <input
                type="text"
                name="openingHours"
                value={formData.openingHours}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="e.g., Mon-Sun: 9 AM - 10 PM"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Amenities (comma-separated)
              </label>
              <input
                type="text"
                name="amenities"
                value={formData.amenities}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="e.g., Parking, Changing rooms, Cafeteria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="Describe your venue..."
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Venue Images
                </label>
                <p className="text-xs text-slate-500">
                  Upload up to 10 images. Add at least 1 to showcase your venue.
                </p>
              </div>

              {existingImages.length > 0 && selectedImages.length === 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {existingImages.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="relative rounded-lg overflow-hidden border border-slate-200"
                    >
                      <img
                        src={url}
                        alt={`Venue ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      {editingVenue?.coverPhotoUrl === url && (
                        <span className="absolute top-1 right-1 text-[10px] bg-power-orange text-white px-2 py-0.5 rounded-full">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageSelection(e.target.files)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-power-orange/10 file:text-power-orange hover:file:bg-power-orange/20"
              />

              {imageError && (
                <p className="text-xs text-red-600">{imageError}</p>
              )}

              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedImages.map((image, index) => (
                    <div
                      key={image.preview}
                      className="relative rounded-lg overflow-hidden border border-slate-200"
                    >
                      <img
                        src={image.preview}
                        alt={`Selected ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 left-1 text-[10px] bg-slate-900/80 text-white px-2 py-0.5 rounded-full"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverPhotoIndex(index)}
                        className={`absolute bottom-1 right-1 text-[10px] px-2 py-0.5 rounded-full ${
                          index === coverPhotoIndex
                            ? "bg-power-orange text-white"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        {index === coverPhotoIndex ? "Cover" : "Set Cover"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isUploadingImages && (
                <p className="text-xs text-slate-500">Uploading images...</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} variant="primary">
                {isSubmitting
                  ? "Saving..."
                  : editingVenue
                    ? "Update Venue"
                    : "Add Venue"}
              </Button>
              <Button type="button" onClick={handleCancel} variant="secondary">
                Cancel
              </Button>
            </div>
          </form>
        </Card>
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
                  <MapPin size={16} className="inline mr-1" />
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

                <p className="text-2xl font-bold text-power-orange mb-4">
                  ?{venue.pricePerHour}
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
