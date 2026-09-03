"use client";

import { toast } from "@/lib/toast";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { Button } from "@/modules/shared/ui/Button";
import { useEffect, useRef, useState } from "react";
import type { AcademyStep2Payload } from "@/modules/onboarding/types/academy";

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
      coordinates: [77.2, 28.7] as [number, number],
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
  const [hasSelectedLocation, setHasSelectedLocation] = useState(!!previousData?.address);
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
      toast.error(error instanceof Error ? error.message : "Failed to save location");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 2: Location & Contact</h2>
        <p className="text-slate-600">Where is your academy located?</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Full Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={addressQuery}
              onChange={handleAddressChange}
              placeholder="Search your academy location..."
              className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                fieldErrors.address ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {isSearching && (
              <div className="absolute top-2.5 right-3">
                <div className="border-power-orange h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-10 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}`}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    <p className="font-medium text-slate-900">{suggestion.label.split(",")[0]}</p>
                    <p className="truncate text-xs text-slate-500">{suggestion.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {searchError && <p className="mt-1 text-xs text-amber-600">{searchError}</p>}
          {fieldErrors.address && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>
          )}
          {hasSelectedLocation && (
            <p className="mt-1 text-xs text-green-600">✓ Location selected</p>
          )}
          {fieldErrors.location && (
            <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-600">
              ⚠️ {fieldErrors.location}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="Mumbai"
              className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                fieldErrors.city ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.city && <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              State / UT <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.state}
              onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
              className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                fieldErrors.state ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
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
            {fieldErrors.state && <p className="mt-1 text-xs text-red-600">{fieldErrors.state}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
              placeholder="400001"
              maxLength={6}
              className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                fieldErrors.pincode ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.pincode && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.pincode}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-4 font-semibold text-slate-900">Contact Information</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
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
                className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                  fieldErrors.contactPersonName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.contactPersonName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPersonName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">
                  Phone (+91XXXXXXXXXX) <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={formData.contactPhone.replace(/^\+91/, "")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
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
                    className={`focus:ring-power-orange flex-1 rounded-r-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                      fieldErrors.contactPhone
                        ? "border-red-300 bg-red-50"
                        : "border-slate-300 bg-white"
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.contactPhone && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPhone}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">
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
                  className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                    fieldErrors.contactEmail
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.contactEmail && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.contactEmail}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  +91
                </span>
                <input
                  type="tel"
                  value={formData.whatsappNumber.replace(/^\+91/, "")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
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
                  className={`focus:ring-power-orange flex-1 rounded-r-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                    fieldErrors.whatsappNumber
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.whatsappNumber && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.whatsappNumber}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Languages Spoken <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {languageOptions.map((lang) => (
              <label key={lang} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.languagesSpoken.includes(lang)}
                  onChange={() => toggleLanguage(lang)}
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-slate-700">{lang}</span>
              </label>
            ))}
          </div>
          {fieldErrors.languagesSpoken && (
            <p className="mt-2 text-xs text-red-600">{fieldErrors.languagesSpoken}</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button type="button" onClick={onBack} variant="outline" disabled={isSubmitting}>
              Back
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || loading} className="flex-1">
            {isSubmitting ? "Saving..." : "Continue to Step 3"}
          </Button>
        </div>
      </form>
    </div>
  );
}
