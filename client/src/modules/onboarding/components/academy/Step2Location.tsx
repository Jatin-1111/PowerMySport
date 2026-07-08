"use client";

import { toast } from "@/lib/toast";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import type { AcademyStep2Payload } from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { useEffect, useRef, useState } from "react";

interface Step2LocationProps {
  academyId: string;
  onSubmit: (data: AcademyStep2Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep2Payload;
}

export default function Step2Location({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step2LocationProps) {
  const [formData, setFormData] = useState({
    location: previousData?.location || {
      type: "Point" as const,
      coordinates: [77.2, 28.7] as [number, number], // Default Delhi
    },
    address: previousData?.address || "",
    city: previousData?.city || "",
    state: previousData?.state || "",
    pincode: previousData?.pincode || "",
    placeId: previousData?.placeId || "",
    contactPersonName: previousData?.contactPersonName || "",
    contactPhone: previousData?.contactPhone || "",
    contactEmail: previousData?.contactEmail || "",
    whatsappNumber: previousData?.whatsappNumber || "",
    languagesSpoken: previousData?.languagesSpoken || ([] as string[]),
  });

  const [addressQuery, setAddressQuery] = useState(previousData?.address || "");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSelectedLocation, setHasSelectedLocation] = useState(
    !!previousData?.address,
  );
  const skipAutocompleteRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stateOptions = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ];

  // Autocomplete for address search
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

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    skipAutocompleteRef.current = false;
    setAddressQuery(value);
  };

  const handleSuggestionSelect = async (suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      location: {
        type: "Point" as const,
        coordinates: [suggestion.lon, suggestion.lat],
      },
      placeId: suggestion.placeId || "",
      city: suggestion.city || prev.city,
      state: suggestion.state || prev.state,
      pincode: suggestion.pincode || prev.pincode,
    }));
    setAddressQuery(suggestion.label);
    setSuggestions([]);
    setHasSelectedLocation(true);
    setFieldErrors((prev) => ({
      ...prev,
      location: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
    }));
  };

  const toggleLanguage = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      languagesSpoken: prev.languagesSpoken.includes(lang)
        ? prev.languagesSpoken.filter((l) => l !== lang)
        : [...prev.languagesSpoken, lang],
    }));
  };

  const languageOptions = [
    "English",
    "Hindi",
    "Marathi",
    "Gujarati",
    "Tamil",
    "Telugu",
    "Kannada",
    "Bengali",
  ];

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!hasSelectedLocation || formData.address.trim().length < 5) {
      errors.address = "Please select an address from suggestions";
    }
    if (formData.city.trim().length < 2) {
      errors.city = "City is required";
    }
    if (!formData.state || formData.state.length < 2) {
      errors.state = "Please select a state or UT";
    }
    if (!/^\d{6}$/.test(formData.pincode)) {
      errors.pincode = "Pincode must be exactly 6 digits";
    }
    if (formData.contactPersonName.trim().length < 2) {
      errors.contactPersonName = "Contact person name is required";
    }
    if (!/^\+91[0-9]{10}$/.test(formData.contactPhone)) {
      errors.contactPhone = "Phone must be +91 followed by 10 digits";
    }
    if (!/^\+91[0-9]{10}$/.test(formData.whatsappNumber)) {
      errors.whatsappNumber = "WhatsApp must be +91 followed by 10 digits";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      errors.contactEmail = "Valid email is required";
    }
    if (formData.languagesSpoken.length === 0) {
      errors.languagesSpoken = "Select at least one language";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before continuing");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AcademyStep2Payload = {
        ...formData,
        academyId,
        address: formData.address.trim(),
        city: formData.city.trim(),
        contactPersonName: formData.contactPersonName.trim(),
        contactEmail: formData.contactEmail.trim(),
        location: {
          type: "Point" as const,
          coordinates: formData.location.coordinates,
        },
      };
      await onSubmit(payload);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save location",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 2: Location & Contact
        </h2>
        <p className="text-slate-600">Where is your academy located?</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address with Google Maps Autocomplete */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Full Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={addressQuery}
              onChange={handleAddressChange}
              placeholder="Search your academy location..."
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                fieldErrors.address
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin w-5 h-5 border-2 border-power-orange border-t-transparent rounded-full" />
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}`}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b border-slate-100 text-sm"
                  >
                    <p className="font-medium text-slate-900">
                      {suggestion.label.split(",")[0]}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {suggestion.label}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {searchError && (
            <p className="text-amber-600 text-xs mt-1">{searchError}</p>
          )}
          {fieldErrors.address && (
            <p className="text-red-600 text-xs mt-1">{fieldErrors.address}</p>
          )}
          {hasSelectedLocation && (
            <p className="text-emerald-600 text-xs mt-1">✓ Location selected</p>
          )}
          {fieldErrors.location && (
            <p className="text-amber-600 text-xs mt-1 bg-amber-50 p-2 rounded border border-amber-200">
              ⚠️ {fieldErrors.location}
            </p>
          )}
        </div>

        {/* City, State, Pincode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder="Mumbai"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                fieldErrors.city
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.city && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.city}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              State / UT <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.state}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, state: e.target.value }))
              }
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                fieldErrors.state
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            >
              <option value="">Select State / UT</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {fieldErrors.state && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.state}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, pincode: e.target.value }))
              }
              placeholder="400001"
              maxLength={6}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                fieldErrors.pincode
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.pincode && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.pincode}</p>
            )}
          </div>
        </div>

        {/* Contact Person */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">
            Contact Information
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Contact Person Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.contactPersonName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contactPersonName: e.target.value,
                  }))
                }
                placeholder="Full name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.contactPersonName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.contactPersonName && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.contactPersonName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Phone (+91XXXXXXXXXX) <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-sm text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={formData.contactPhone.replace(/^\+91/, "")}
                    onChange={(e) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      setFormData((prev) => ({
                        ...prev,
                        contactPhone: `+91${digits}`,
                      }));
                      if (fieldErrors.contactPhone)
                        setFieldErrors((prev) => ({
                          ...prev,
                          contactPhone: "",
                        }));
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className={`flex-1 px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                      fieldErrors.contactPhone
                        ? "border-red-300 bg-red-50"
                        : "border-slate-300 bg-white"
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.contactPhone && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.contactPhone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contactEmail: e.target.value,
                    }))
                  }
                  placeholder="contact@academy.com"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                    fieldErrors.contactEmail
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.contactEmail && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.contactEmail}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-sm text-slate-600">
                  +91
                </span>
                <input
                  type="tel"
                  value={formData.whatsappNumber.replace(/^\+91/, "")}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setFormData((prev) => ({
                      ...prev,
                      whatsappNumber: `+91${digits}`,
                    }));
                    if (fieldErrors.whatsappNumber)
                      setFieldErrors((prev) => ({
                        ...prev,
                        whatsappNumber: "",
                      }));
                  }}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`flex-1 px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                    fieldErrors.whatsappNumber
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.whatsappNumber && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.whatsappNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Languages Spoken <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {languageOptions.map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.languagesSpoken.includes(lang)}
                  onChange={() => toggleLanguage(lang)}
                  className="w-4 h-4 rounded border-slate-300"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-slate-700">{lang}</span>
              </label>
            ))}
          </div>
          {fieldErrors.languagesSpoken && (
            <p className="text-red-600 text-xs mt-2">
              {fieldErrors.languagesSpoken}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Continue to Step 3"}
          </Button>
        </div>
      </form>
    </div>
  );
}
