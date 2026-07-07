"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import CertificationsMultiSelect from "@/modules/shared/components/CertificationsMultiSelect";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";

const SERVICE_MODES = [
  { value: "OWN_VENUE", label: "Own Venue" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "HYBRID", label: "Hybrid" },
];

interface CoachFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobileNumber: string;
  bio: string;
  sports: string[];
  certifications: string[];
  hourlyRate: number | "";
  sportPricing: Record<string, number>;
  serviceMode: "OWN_VENUE" | "FREELANCE" | "HYBRID";
  latitude: number | "";
  longitude: number | "";
  serviceRadiusKm: number | "";
  travelBufferTime: number | "";
  venueId: string;
  verificationStatus:
    "UNVERIFIED" | "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";
  profilePhotoUrl: string;
  profilePhotoKey: string;
}

interface FormErrors {
  [key: string]: string;
}

interface ApiConflictPayload {
  message?: string;
  requiresConversion?: boolean;
  requiresSeparateAccount?: boolean;
  existingRole?: string;
  targetRole?: string;
}

const getApiConflictPayload = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return {} as { status?: number; data?: ApiConflictPayload };
  }

  const maybeError = error as {
    response?: { status?: number; data?: ApiConflictPayload };
  };

  return {
    status: maybeError.response?.status,
    data: maybeError.response?.data,
  };
};

export function AddCoachForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const skipAutocompleteRef = useRef(false);
  const [formData, setFormData] = useState<CoachFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobileNumber: "",
    bio: "",
    sports: [],
    certifications: [],
    hourlyRate: "",
    sportPricing: {},
    serviceMode: "FREELANCE",
    latitude: "",
    longitude: "",
    serviceRadiusKm: 10,
    travelBufferTime: 30,
    venueId: "",
    verificationStatus: "VERIFIED",
    profilePhotoUrl: "",
    profilePhotoKey: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const numFields = ["serviceRadiusKm", "travelBufferTime", "hourlyRate"];

    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (numFields.includes(name)) {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" ? "" : Number(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  useEffect(() => {
    setAddressQuery(
      typeof formData.latitude === "number" &&
        typeof formData.longitude === "number"
        ? `${formData.latitude}, ${formData.longitude}`
        : "",
    );
  }, [formData.latitude, formData.longitude]);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const q = addressQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geoApi.autocomplete(q);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [addressQuery]);

  const handleSelectSuggestion = (s: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setSuggestions([]);
    setFormData((prev) => ({
      ...prev,
      latitude: s.lat,
      longitude: s.lon,
    }));
    setAddressQuery(s.label);
    setErrors((prev) => ({ ...prev, baseLocation: "" }));
  };

  const handleSportPriceChange = (sport: string, price: number) => {
    setFormData((prev) => ({
      ...prev,
      sportPricing: {
        ...prev.sportPricing,
        [sport]: price,
      },
    }));
  };

  const clearLocation = () => {
    skipAutocompleteRef.current = true;
    setFormData((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
    }));
    setAddressQuery("");
  };

  const handleProfilePhotoReady = (url: string | null, key: string | null) => {
    setFormData((prev) => ({
      ...prev,
      profilePhotoUrl: url || "",
      profilePhotoKey: key || "",
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone is required";
    }

    // Mobile number validation (10+ digits, optional + prefix, spaces/hyphens allowed)
    if (formData.mobileNumber.trim()) {
      const mobileRegex = /^[+]?[0-9\s().\-]+$/;
      const digitsOnly = formData.mobileNumber.replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        newErrors.mobileNumber = "Mobile number must have at least 10 digits";
      } else if (!mobileRegex.test(formData.mobileNumber)) {
        newErrors.mobileNumber = "Invalid mobile number format";
      }
    }

    if (formData.bio.trim()) {
      if (formData.bio.length < 20) {
        newErrors.bio = "Bio must be at least 20 characters";
      } else if (formData.bio.length > 2000) {
        newErrors.bio = "Bio cannot exceed 2000 characters";
      }
    }

    if (formData.sports.length === 0) {
      newErrors.sports = "At least one sport is required";
    }

    if (formData.hourlyRate === "" || Number(formData.hourlyRate) <= 0) {
      newErrors.hourlyRate = "Hourly rate must be greater than 0";
    }

    // Validate sport pricing
    const invalidSport = formData.sports.find(
      (sport) => (formData.sportPricing[sport] || 0) <= 0,
    );
    if (invalidSport) {
      newErrors.sportPricing = `Please enter valid price for ${invalidSport}`;
    }

    if (
      (formData.serviceMode === "FREELANCE" ||
        formData.serviceMode === "HYBRID") &&
      (formData.latitude === "" || formData.longitude === "")
    ) {
      newErrors.baseLocation =
        "Base location is required for freelance/hybrid coaches";
    }

    if (formData.serviceRadiusKm === "") {
      newErrors.serviceRadiusKm = "Service radius is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        mobileNumber: formData.mobileNumber,
        bio: formData.bio,
        sports: formData.sports,
        certifications: formData.certifications,
        hourlyRate: Number(formData.hourlyRate),
        sportPricing: formData.sportPricing,
        serviceMode: formData.serviceMode,
        ...(formData.serviceMode !== "OWN_VENUE" && {
          baseLocation: {
            type: "Point",
            coordinates: [
              Number(formData.longitude),
              Number(formData.latitude),
            ],
          },
        }),
        serviceRadiusKm: formData.serviceRadiusKm
          ? Number(formData.serviceRadiusKm)
          : undefined,
        travelBufferTime: formData.travelBufferTime
          ? Number(formData.travelBufferTime)
          : undefined,
        ...(formData.venueId && { venueId: formData.venueId }),
        verificationStatus: formData.verificationStatus,
        ...(formData.profilePhotoUrl && {
          profilePhotoUrl: formData.profilePhotoUrl,
          profilePhotoKey: formData.profilePhotoKey,
        }),
      };

      const attemptCreate = async (convertExistingUser?: boolean) =>
        adminApi.createCoach({
          ...(payload as any),
          ...(convertExistingUser ? { convertExistingUser: true } : {}),
        });

      try {
        const response = await attemptCreate();

        if (response.success) {
          toast.success("Coach created successfully!");
          router.push("/admin/coaches");
          return;
        }

        toast.error(response.message || "Failed to create coach");
      } catch (error) {
        const { status, data } = getApiConflictPayload(error);

        if (status === 409 && data?.requiresConversion) {
          const shouldConvert = window.confirm(
            data.message ||
              "An account already exists. Convert it to a coach account to continue?",
          );

          if (shouldConvert) {
            const retryResponse = await attemptCreate(true);

            if (retryResponse.success) {
              toast.success("Coach created successfully!");
              router.push("/admin/coaches");
              return;
            }

            toast.error(retryResponse.message || "Failed to create coach");
            return;
          }

          return;
        }

        toast.error(
          error instanceof Error ? error.message : "Failed to create coach",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create coach",
      );
    } finally {
      setLoading(false);
    }
  };

  const isFreelanceOrHybrid =
    formData.serviceMode === "FREELANCE" || formData.serviceMode === "HYBRID";

  return (
    <Card className="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        <OnboardingSectionCard
          title="Basic Information"
          subtitle="Name, contact and bio"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                  errors.firstName
                    ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                    : "border-slate-300 focus:ring-power-orange/40"
                }`}
                placeholder="Enter first name"
                disabled={loading}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                  errors.lastName
                    ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                    : "border-slate-300 focus:ring-power-orange/40"
                }`}
                placeholder="Enter last name"
                disabled={loading}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                  errors.email
                    ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                    : "border-slate-300 focus:ring-power-orange/40"
                }`}
                placeholder="Enter email"
                disabled={loading}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                  errors.phone
                    ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                    : "border-slate-300 focus:ring-power-orange/40"
                }`}
                placeholder="Enter phone number"
                disabled={loading}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mobile Number
            </label>
            <input
              type="tel"
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={handleInputChange}
              maxLength={20}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                errors.mobileNumber
                  ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                  : "border-slate-300 focus:ring-power-orange/40"
              }`}
              placeholder="e.g., 9876543210"
              disabled={loading}
            />
            {errors.mobileNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.mobileNumber}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">
              10+ digits, supports +91 prefix and spacing
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bio (20-2000 characters)
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={3}
              maxLength={2000}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                errors.bio
                  ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                  : "border-slate-300 focus:ring-power-orange/40"
              }`}
              placeholder="Enter coach bio"
              disabled={loading}
            />
            {errors.bio && (
              <p className="text-red-500 text-xs mt-1">{errors.bio}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">
              {formData.bio.length}/2000 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Profile Photo
            </label>
            <CoachPhotoUpload
              onPhotoReady={handleProfilePhotoReady}
              currentPhotoUrl={formData.profilePhotoUrl}
              disabled={loading}
            />
          </div>
        </OnboardingSectionCard>

        {/* Sports */}
        <OnboardingSectionCard title="Sports" subtitle="Coaching specialties">
          <SportsMultiSelect
            value={formData.sports}
            onChange={(s) => {
              setFormData((p) => ({ ...p, sports: s }));
              setErrors((prev) => ({ ...prev, sports: "" }));
            }}
            disabled={loading}
            required
          />
          {errors.sports && (
            <p className="text-red-500 text-xs mt-1">{errors.sports}</p>
          )}

          {formData.sports.length > 0 && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg mt-4">
              <h4 className="font-medium text-slate-900">
                Sport-Specific Pricing
              </h4>
              {formData.sports.map((sport) => (
                <div
                  key={sport}
                  className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
                >
                  <label className="text-sm font-medium text-slate-700 sm:w-32">
                    {sport}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">₹</span>
                    <input
                      type="number"
                      value={formData.sportPricing[sport] || ""}
                      onChange={(e) =>
                        handleSportPriceChange(
                          sport,
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      min="1"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-power-orange/40 focus:outline-none"
                      placeholder="Rate"
                      disabled={loading}
                    />
                    <span className="text-sm text-slate-600">/hour</span>
                  </div>
                </div>
              ))}
              {errors.sportPricing && (
                <p className="text-red-500 text-xs mt-2">
                  {errors.sportPricing}
                </p>
              )}
            </div>
          )}
        </OnboardingSectionCard>

        {/* Certifications */}
        <OnboardingSectionCard
          title="Certifications"
          subtitle="Optional coaching credentials"
        >
          <CertificationsMultiSelect
            value={formData.certifications}
            onChange={(c) => setFormData((p) => ({ ...p, certifications: c }))}
            disabled={loading}
          />
        </OnboardingSectionCard>

        {/* Pricing */}
        <OnboardingSectionCard title="Pricing" subtitle="Hourly rate">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hourly Rate *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">₹</span>
              <input
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleInputChange}
                min="1"
                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                  errors.hourlyRate
                    ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                    : "border-slate-300 focus:ring-power-orange/40"
                }`}
                placeholder="Enter hourly rate"
                disabled={loading}
              />
              <span className="text-slate-600">/hour</span>
            </div>
            {errors.hourlyRate && (
              <p className="text-red-500 text-xs mt-1">{errors.hourlyRate}</p>
            )}
          </div>
        </OnboardingSectionCard>

        {/* Service Mode */}
        <OnboardingSectionCard
          title="Service Mode"
          subtitle="How the coach provides services"
        >
          <div className="space-y-2">
            {SERVICE_MODES.map((mode) => (
              <label
                key={mode.value}
                className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <input
                  type="radio"
                  name="serviceMode"
                  value={mode.value}
                  checked={formData.serviceMode === mode.value}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">
                  {mode.label}
                </span>
              </label>
            ))}
          </div>

          {isFreelanceOrHybrid && (
            <OnboardingSectionCard
              title="Base Location & Service Area"
              subtitle="Where you operate from"
              className="mt-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Search Address *
                </label>
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                    errors.baseLocation
                      ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                      : "border-slate-300 focus:ring-power-orange/40"
                  }`}
                  placeholder="Start typing address and pick suggestion"
                  disabled={loading}
                />

                {isSearching && (
                  <p className="text-sm text-slate-500 mt-1">Searching...</p>
                )}
                {suggestions.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-auto rounded-md border bg-white shadow-md">
                    {suggestions.map((s) => (
                      <li
                        key={s.label}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-50 border-b last:border-b-0"
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        {s.label}
                      </li>
                    ))}
                  </ul>
                )}
                {errors.baseLocation && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.baseLocation}
                  </p>
                )}
              </div>

              {typeof formData.latitude === "number" &&
                typeof formData.longitude === "number" && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm text-slate-800 font-medium">
                        {addressQuery}
                      </div>
                      <div className="text-xs text-slate-500">
                        Coordinates saved
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="text-sm text-slate-600 hover:text-red-600 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    name="serviceRadiusKm"
                    value={formData.serviceRadiusKm}
                    onChange={handleInputChange}
                    min="1"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                      errors.serviceRadiusKm
                        ? "border-red-500 focus:ring-red-500/40 bg-red-50"
                        : "border-slate-300 focus:ring-power-orange/40"
                    }`}
                    placeholder="e.g., 10"
                    disabled={loading}
                  />
                  {errors.serviceRadiusKm && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.serviceRadiusKm}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Travel Buffer Time (minutes)
                  </label>
                  <input
                    type="number"
                    name="travelBufferTime"
                    value={formData.travelBufferTime}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-power-orange/40 focus:outline-none"
                    placeholder="e.g., 30"
                    disabled={loading}
                  />
                </div>
              </div>
            </OnboardingSectionCard>
          )}

          {formData.serviceMode === "OWN_VENUE" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-700 mb-3">
                Coach has own venue - venue details can be added separately
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Venue ID (Optional)
              </label>
              <input
                type="text"
                name="venueId"
                value={formData.venueId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-power-orange/40 focus:outline-none"
                placeholder="Enter venue ID (if applicable)"
                disabled={loading}
              />
            </div>
          )}
        </OnboardingSectionCard>

        {/* Status */}
        <OnboardingSectionCard title="Status" subtitle="Verification status">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Verification Status
            </label>
            <select
              name="verificationStatus"
              value={formData.verificationStatus}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-power-orange/40 focus:outline-none"
              disabled={loading}
            >
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEW">Review</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </OnboardingSectionCard>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row">
          <Button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-power-orange px-6 text-white hover:bg-orange-600 disabled:bg-slate-300 sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Coach"
            )}
          </Button>
          <Button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="bg-slate-600 px-6 text-white hover:bg-slate-700 sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
