"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Loader2, ArrowLeft, Check, CircleDot } from "lucide-react";
import { useRouter } from "next/navigation";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import AmenitiesMultiSelect from "@/modules/shared/components/AmenitiesMultiSelect";
import VenueImageUpload from "@/modules/admin/components/VenueImageUpload";
import OpeningHoursInput, {
  getDefaultOpeningHours,
} from "@/modules/onboarding/components/OpeningHoursInput";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_META: Array<{
  step: WizardStep;
  label: string;
  hint: string;
}> = [
  { step: 1, label: "Basic Details", hint: "Name and address" },
  { step: 2, label: "Venue Details", hint: "Sports, pricing, and settings" },
  { step: 3, label: "Photos", hint: "Upload venue visuals" },
  { step: 4, label: "Documents", hint: "Not required for admin" },
  { step: 5, label: "Review", hint: "Confirm and publish" },
];

interface VenueFormData {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  name: string;
  address: string;
  sports: string[];
  pricePerHour: number | "";
  sportPricing: Record<string, number>;
  amenities: string[];
  description: string;
  latitude: number | "";
  longitude: number | "";
  location: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  openingHours: any;
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  generalImages: string[];
  generalImageKeys: string[];
  sportImages: Record<string, string[]>;
  sportImageKeys: Record<string, string[]>;
  coverPhotoUrl: string;
  coverPhotoKey: string;
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

interface VenuePayload {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  name: string;
  address: string;
  sports: string[];
  pricePerHour: number;
  sportPricing: Record<string, number>;
  amenities: string[];
  description: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  openingHours: any;
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  images?: string[];
  imageKeys?: string[];
  generalImages?: string[];
  generalImageKeys?: string[];
  sportImages?: Record<string, string[]>;
  sportImageKeys?: Record<string, string[]>;
  coverPhotoUrl?: string;
  coverPhotoKey?: string;
}

export function AddVenueForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [venueId, setVenueId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState("");
  const skipAutocompleteRef = useRef(false);

  const [formData, setFormData] = useState<VenueFormData>({
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    name: "",
    address: "",
    sports: [],
    pricePerHour: "",
    sportPricing: {},
    amenities: [],
    description: "",
    latitude: "",
    longitude: "",
    location: null,
    openingHours: getDefaultOpeningHours(),
    allowExternalCoaches: true,
    approvalStatus: "APPROVED",
    generalImages: [],
    generalImageKeys: [],
    sportImages: {},
    sportImageKeys: {},
    coverPhotoUrl: "",
    coverPhotoKey: "",
  });

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = addressQuery.trim();

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geoApi.autocomplete(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [addressQuery]);

  const buildPricingMap = (): Record<string, number> => {
    if (samePriceForAll) {
      const price = Number(basePricePerHour || 0);
      return formData.sports.reduce<Record<string, number>>((acc, sport) => {
        acc[sport] = price;
        return acc;
      }, {});
    }

    return formData.sports.reduce<Record<string, number>>((acc, sport) => {
      acc[sport] = formData.sportPricing[sport] || 0;
      return acc;
    }, {});
  };

  const buildBasePayload = (): VenuePayload | null => {
    if (!formData.location) {
      return null;
    }

    const pricingMap = buildPricingMap();
    const pricePerHour = samePriceForAll
      ? Number(basePricePerHour || 0)
      : Math.min(...Object.values(pricingMap).filter((value) => value > 0));

    return {
      ownerName: formData.ownerName.trim(),
      ownerEmail: formData.ownerEmail.trim(),
      ownerPhone: formData.ownerPhone.trim(),
      name: formData.name.trim(),
      address: formData.address.trim(),
      sports: formData.sports,
      pricePerHour: Number.isFinite(pricePerHour) ? pricePerHour : 0,
      sportPricing: pricingMap,
      amenities: formData.amenities,
      description: formData.description.trim(),
      location: formData.location,
      openingHours: formData.openingHours,
      allowExternalCoaches: formData.allowExternalCoaches,
      approvalStatus: formData.approvalStatus,
    };
  };

  const buildFinalPayload = (): VenuePayload | null => {
    const basePayload = buildBasePayload();
    if (!basePayload) {
      return null;
    }

    return {
      ...basePayload,
      generalImages: formData.generalImages,
      generalImageKeys: formData.generalImageKeys,
      sportImages: formData.sportImages,
      sportImageKeys: formData.sportImageKeys,
      coverPhotoUrl: formData.coverPhotoUrl,
      coverPhotoKey: formData.coverPhotoKey,
    };
  };

  const invalidateDraft = () => {
    setVenueId("");
    setFormData((prev) => ({
      ...prev,
      generalImages: [],
      generalImageKeys: [],
      sportImages: {},
      sportImageKeys: {},
      coverPhotoUrl: "",
      coverPhotoKey: "",
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === "pricePerHour") {
      const nextValue = value === "" ? "" : Number(value);
      setBasePricePerHour(value);
      setFormData((prev) => ({ ...prev, pricePerHour: nextValue }));
      return;
    }

    if (name === "approvalStatus") {
      setFormData((prev) => ({
        ...prev,
        approvalStatus: value as VenueFormData["approvalStatus"],
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setSuggestions([]);
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
      location: {
        type: "Point",
        coordinates: [suggestion.lon, suggestion.lat],
      },
    }));
    setErrors((prev) => ({ ...prev, address: "" }));
  };

  const clearLocation = () => {
    skipAutocompleteRef.current = true;
    setFormData((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
      location: null,
    }));
  };

  const handleBasePriceChange = (value: number | "") => {
    const textValue = value === "" ? "" : String(value);
    setBasePricePerHour(textValue);
    setFormData((prev) => ({
      ...prev,
      pricePerHour: value,
    }));

    if (samePriceForAll && value !== "") {
      const priceNum = typeof value === "number" ? value : 0;
      const pricing: Record<string, number> = {};
      formData.sports.forEach((sport) => {
        pricing[sport] = priceNum;
      });
      setFormData((prev) => ({ ...prev, sportPricing: pricing }));
    }
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

  const toggleSamePriceMode = (same: boolean) => {
    setSamePriceForAll(same);

    if (same && basePricePerHour !== "") {
      const pricing: Record<string, number> = {};
      formData.sports.forEach((sport) => {
        pricing[sport] = Number(basePricePerHour);
      });
      setFormData((prev) => ({ ...prev, sportPricing: pricing }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = "Owner name is required";
    }

    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = "Owner email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = "Enter a valid email address";
    }

    if (!formData.ownerPhone.trim()) {
      newErrors.ownerPhone = "Owner mobile number is required";
    } else {
      const phoneRegex = /^[+]?[0-9\s().\-]+$/;
      const digitsOnly = formData.ownerPhone.replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        newErrors.ownerPhone = "Owner mobile number must have at least 10 digits";
      } else if (!phoneRegex.test(formData.ownerPhone)) {
        newErrors.ownerPhone = "Enter a valid mobile number";
      }
    }

    if (!formData.name.trim()) {
      newErrors.name = "Venue name is required";
    }

    if (!formData.address.trim() || !formData.location) {
      newErrors.address = "Please select a valid address from suggestions";
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    if (formData.sports.length === 0) {
      newErrors.sports = "At least one sport is required";
    }

    if (samePriceForAll) {
      if (basePricePerHour === "" || Number(basePricePerHour) <= 0) {
        newErrors.pricePerHour = "Price must be greater than 0";
      }
    } else {
      const invalidSport = formData.sports.find(
        (sport) => (formData.sportPricing[sport] || 0) <= 0
      );
      if (invalidSport) {
        newErrors.sportPricing = `Please enter valid price for ${invalidSport}`;
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const ensureDraftVenue = async (): Promise<string> => {
    if (venueId) {
      return venueId;
    }

    const basePayload = buildBasePayload();
    if (!basePayload) {
      throw new Error("Venue location is required");
    }

    const response = await adminApi.createVenue(basePayload);

    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to create draft venue");
    }

    const createdVenueId = (response.data as any).id || (response.data as any)._id;
    if (!createdVenueId) {
      throw new Error("Created venue ID not found");
    }

    setVenueId(createdVenueId);
    return createdVenueId;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleNextFromStep2 = async () => {
    if (!validateStep2()) {
      return;
    }

    setLoading(true);
    try {
      await ensureDraftVenue();
      setCurrentStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create draft venue");
    } finally {
      setLoading(false);
    }
  };

  const handleImagesReady = (images: {
    generalImages: string[];
    generalImageKeys: string[];
    sportImages: Record<string, string[]>;
    sportImageKeys: Record<string, string[]>;
    coverPhotoUrl: string;
    coverPhotoKey: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      ...images,
    }));
    setCurrentStep(4);
  };

  const handleContinueWithoutDocuments = () => {
    setCurrentStep(5);
  };

  const handlePublish = async () => {
    if (!venueId) {
      toast.error("Draft venue not found. Please go back and create it again.");
      return;
    }

    const payload = buildFinalPayload();
    if (!payload) {
      toast.error("Venue location is required");
      return;
    }

    if (payload.images && payload.images.length === 0) {
      toast.error("Please upload all required images");
      return;
    }

    setLoading(true);
    try {
      const attemptPublish = async (convertExistingUser?: boolean) =>
        adminApi.updateVenue(venueId, {
          ...payload,
          ...(convertExistingUser ? { convertExistingUser: true } : {}),
        });

      const response = await attemptPublish();

      if (response.success) {
        toast.success("Venue created successfully!");
        router.push("/admin/venues");
        return;
      }

      toast.error(response.message || "Failed to create venue");
    } catch (error) {
      const { status, data } = getApiConflictPayload(error);

      if (status === 409 && data?.requiresConversion) {
        const shouldConvert = window.confirm(
          data.message ||
            "An account already exists for this owner. Convert it to a venue lister to continue?"
        );

        if (shouldConvert) {
          try {
            const retryResponse = await adminApi.updateVenue(venueId, {
              ...payload,
              convertExistingUser: true,
            });

            if (retryResponse.success) {
              toast.success("Venue created successfully!");
              router.push("/admin/venues");
              return;
            }

            toast.error(retryResponse.message || "Failed to create venue");
          } catch (retryError) {
            toast.error(
              retryError instanceof Error ? retryError.message : "Failed to create venue"
            );
          }
        }

        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to create venue");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleStepJump = (targetStep: WizardStep) => {
    if (loading || targetStep >= currentStep) {
      return;
    }

    setCurrentStep(targetStep);
  };

  const activeStepMeta = STEP_META.find((item) => item.step === currentStep);
  const progressPercent = ((currentStep - 1) / (STEP_META.length - 1)) * 100;

  return (
    <div className="min-h-screen py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">Add Venue</h1>
          <p className="text-slate-600">
            Complete these 5 steps to publish a venue from the admin panel
          </p>
          <p className="border-power-orange/20 bg-power-orange/10 text-power-orange mt-3 inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold tracking-wide uppercase">
            Step {currentStep} of 5
          </p>
        </div>

        <div className="sticky top-4 z-20 mx-auto mb-8 max-w-4xl rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-sm">
          <div className="relative mb-4 overflow-x-auto">
            <div className="relative min-w-180 pb-2">
              <div className="absolute top-6 right-6 left-6 h-0.5 rounded-full bg-slate-200" />
              <div
                className="bg-power-orange absolute top-6 left-6 h-0.5 rounded-full transition-all duration-500"
                style={{
                  width: `max(0px, calc(${progressPercent}% - 0.5rem))`,
                }}
              />

              <div className="grid grid-cols-5 gap-2 md:gap-3">
                {STEP_META.map((item) => {
                  const isCompleted = item.step < currentStep;
                  const isActive = item.step === currentStep;
                  const isFuture = item.step > currentStep;
                  const stateLabel = isCompleted ? "Done" : isActive ? "Current" : "Upcoming";

                  return (
                    <div key={item.step} className="relative text-center">
                      <button
                        type="button"
                        onClick={() => handleStepJump(item.step)}
                        disabled={!isCompleted || loading}
                        title={
                          isCompleted
                            ? `Go to ${item.label}`
                            : isFuture
                              ? "Complete previous steps first"
                              : item.label
                        }
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition-all duration-300 ${
                          isCompleted
                            ? "cursor-pointer bg-emerald-500 text-white shadow-md hover:scale-105"
                            : isActive
                              ? "from-power-orange scale-110 bg-linear-to-br to-orange-500 text-white shadow-lg"
                              : "cursor-not-allowed bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : isActive ? (
                          <CircleDot className="h-5 w-5" />
                        ) : (
                          `0${item.step}`.slice(-2)
                        )}
                      </button>
                      <div
                        className={`mt-3 rounded-2xl border px-3 py-3 transition-all duration-300 ${
                          isActive
                            ? "border-power-orange/25 from-power-orange/10 bg-linear-to-b to-white shadow-sm"
                            : isCompleted
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "border-slate-200 bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                              isActive
                                ? "bg-power-orange/15 text-power-orange"
                                : isCompleted
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {stateLabel}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-[11px] leading-tight font-semibold md:text-xs ${
                            isActive ? "text-power-orange" : "text-slate-800"
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-power-orange h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>{activeStepMeta?.hint || ""}</p>
            <p>{Math.round(progressPercent)}% complete</p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl">
          {currentStep === 1 && (
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNextFromStep1();
                }}
                className="space-y-6 p-6 md:p-8"
              >
                <OnboardingSectionCard
                  title="Basic Details"
                  subtitle="Owner contact, name, address, and description"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Owner Name *
                      </label>
                      <input
                        type="text"
                        name="ownerName"
                        value={formData.ownerName}
                        onChange={handleInputChange}
                        className={`w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                          errors.ownerName
                            ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                            : "focus:ring-power-orange/40 border-slate-300"
                        }`}
                        placeholder="Enter owner name"
                        disabled={loading}
                      />
                      {errors.ownerName && (
                        <p className="mt-1 text-xs text-red-500">{errors.ownerName}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Owner Email *
                      </label>
                      <input
                        type="email"
                        name="ownerEmail"
                        value={formData.ownerEmail}
                        onChange={handleInputChange}
                        className={`w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                          errors.ownerEmail
                            ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                            : "focus:ring-power-orange/40 border-slate-300"
                        }`}
                        placeholder="Enter owner email"
                        disabled={loading}
                      />
                      {errors.ownerEmail && (
                        <p className="mt-1 text-xs text-red-500">{errors.ownerEmail}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Owner Mobile Number *
                    </label>
                    <input
                      type="tel"
                      name="ownerPhone"
                      value={formData.ownerPhone}
                      onChange={handleInputChange}
                      maxLength={20}
                      className={`w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                        errors.ownerPhone
                          ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                          : "focus:ring-power-orange/40 border-slate-300"
                      }`}
                      placeholder="Enter owner mobile number"
                      disabled={loading}
                    />
                    {errors.ownerPhone && (
                      <p className="mt-1 text-xs text-red-500">{errors.ownerPhone}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      Supports +91 prefix and common phone number formatting
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Venue Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                        errors.name
                          ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                          : "focus:ring-power-orange/40 border-slate-300"
                      }`}
                      placeholder="Enter venue name"
                      disabled={loading}
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={addressQuery}
                      onChange={(e) => setAddressQuery(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                        errors.address
                          ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                          : "focus:ring-power-orange/40 border-slate-300"
                      }`}
                      placeholder="Start typing address and pick suggestion"
                      disabled={loading}
                    />

                    {isSearching && <p className="mt-1 text-sm text-slate-500">Searching...</p>}
                    {suggestions.length > 0 && (
                      <ul className="mt-2 max-h-40 overflow-auto rounded-md border bg-white shadow-md">
                        {suggestions.map((suggestion) => (
                          <li
                            key={suggestion.label}
                            className="cursor-pointer border-b px-3 py-2 last:border-b-0 hover:bg-slate-50"
                            onClick={() => handleSelectSuggestion(suggestion)}
                          >
                            {suggestion.label}
                          </li>
                        ))}
                      </ul>
                    )}

                    {formData.location && (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-3">
                        <div className="text-sm font-medium text-slate-800">{formData.address}</div>
                        <button
                          type="button"
                          onClick={clearLocation}
                          className="text-sm text-slate-600 transition-colors hover:text-red-600"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {errors.address && (
                      <p className="mt-1 text-xs text-red-500">{errors.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      maxLength={500}
                      className="focus:ring-power-orange/40 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:outline-none"
                      placeholder="Tell users about your venue"
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-600">
                      {formData.description.length}/500 characters
                    </p>
                  </div>
                </OnboardingSectionCard>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Continue to Step 2"
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => router.back()}
                    disabled={loading}
                    className="bg-slate-600 px-6 text-white hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-xs">
              <div className="space-y-6 p-6 md:p-8">
                <OnboardingSectionCard
                  title="Venue Details"
                  subtitle="Sports, pricing, amenities, and settings"
                >
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Sports Available *
                      </label>
                      <SportsMultiSelect
                        value={formData.sports}
                        onChange={(sports) => {
                          if (venueId) {
                            invalidateDraft();
                          }
                          setFormData((prev) => ({
                            ...prev,
                            sports,
                          }));
                          setErrors((prev) => ({
                            ...prev,
                            sports: "",
                            sportPricing: "",
                          }));
                        }}
                        disabled={loading}
                        required
                      />
                      {errors.sports && (
                        <p className="mt-1 text-xs text-red-500">{errors.sports}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="block text-sm font-medium text-slate-700">
                          Pricing (per hour) *
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={samePriceForAll}
                            onChange={(e) => toggleSamePriceMode(e.target.checked)}
                            className="text-power-orange h-4 w-4 rounded"
                            disabled={loading}
                          />
                          Same price for all sports
                        </label>
                      </div>

                      {samePriceForAll ? (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Base price per hour
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-600">₹</span>
                            <input
                              type="number"
                              value={basePricePerHour}
                              onChange={(e) =>
                                handleBasePriceChange(
                                  e.target.value === "" ? "" : Number(e.target.value)
                                )
                              }
                              min="1"
                              className={`flex-1 rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none ${
                                errors.pricePerHour
                                  ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                                  : "focus:ring-power-orange/40 border-slate-300"
                              }`}
                              placeholder="500"
                              disabled={loading}
                            />
                            <span className="text-slate-600">/hour</span>
                          </div>
                          {errors.pricePerHour && (
                            <p className="mt-1 text-xs text-red-500">{errors.pricePerHour}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                          <h4 className="font-medium text-slate-900">Sport-Specific Pricing</h4>
                          {formData.sports.length === 0 ? (
                            <p className="text-sm text-slate-600">Select sports first</p>
                          ) : (
                            formData.sports.map((sport) => (
                              <div key={sport} className="flex items-center gap-4">
                                <label className="w-32 text-sm font-medium text-slate-700">
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
                                        e.target.value === "" ? 0 : Number(e.target.value)
                                      )
                                    }
                                    min="1"
                                    className="focus:ring-power-orange/40 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:outline-none"
                                    placeholder="500"
                                    disabled={loading}
                                  />
                                  <span className="text-sm text-slate-600">/hour</span>
                                </div>
                              </div>
                            ))
                          )}
                          {errors.sportPricing && (
                            <p className="mt-2 text-xs text-red-500">{errors.sportPricing}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Amenities
                      </label>
                      <AmenitiesMultiSelect
                        value={formData.amenities}
                        onChange={(amenities) => setFormData((prev) => ({ ...prev, amenities }))}
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Opening Hours
                      </label>
                      <OpeningHoursInput
                        value={formData.openingHours}
                        onChange={(hours) =>
                          setFormData((prev) => ({
                            ...prev,
                            openingHours: hours,
                          }))
                        }
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name="allowExternalCoaches"
                        checked={formData.allowExternalCoaches}
                        onChange={handleInputChange}
                        disabled={loading}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">
                        Allow external coaches at your venue?
                      </span>
                    </label>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Approval Status
                      </label>
                      <select
                        name="approvalStatus"
                        value={formData.approvalStatus}
                        onChange={handleInputChange}
                        className="focus:ring-power-orange/40 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:outline-none"
                        disabled={loading}
                      >
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                        <option value="REVIEW">Review</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>
                </OnboardingSectionCard>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="bg-slate-600 px-6 text-white hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNextFromStep2}
                    disabled={loading}
                    className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Draft...
                      </>
                    ) : (
                      "Continue to Photos"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-xs">
              <div className="space-y-6 p-6 md:p-8">
                <OnboardingSectionCard
                  title="Venue Photos"
                  subtitle="Upload 3 general images and 5 per sport"
                >
                  {venueId ? (
                    <VenueImageUpload
                      venueId={venueId}
                      sports={formData.sports}
                      onImagesReady={handleImagesReady}
                      disabled={loading}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                      Create the draft venue from Step 2 before uploading photos.
                    </div>
                  )}
                </OnboardingSectionCard>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="bg-slate-600 px-6 text-white hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={
                      loading ||
                      formData.generalImages.length === 0 ||
                      Object.keys(formData.sportImages).length === 0
                    }
                    className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
                  >
                    Continue to Documents
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-xs">
              <div className="space-y-6 p-6 md:p-8">
                <OnboardingSectionCard
                  title="Documents"
                  subtitle="No document upload is required for admin-created venues"
                >
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-slate-700">
                    <p className="font-medium text-emerald-900">Frictionless admin flow</p>
                    <p className="mt-2 text-sm leading-6">
                      Venue documents are required only in the public onboarding flow. Admin-created
                      venues can be published without any document upload.
                    </p>
                  </div>
                </OnboardingSectionCard>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="bg-slate-600 px-6 text-white hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinueWithoutDocuments}
                    disabled={loading}
                    className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
                  >
                    Continue to Review
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 5 && (
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-xs">
              <div className="space-y-6 p-6 md:p-8">
                <OnboardingSectionCard title="Review" subtitle="Check everything before publishing">
                  <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">Venue</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formData.name || "Untitled venue"}
                      </p>
                      <p className="mt-2 text-slate-600">{formData.address}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">Pricing</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {samePriceForAll
                          ? `₹${basePricePerHour || 0} / hour`
                          : "Sport-specific pricing"}
                      </p>
                      <p className="mt-2 text-slate-600">
                        {formData.sports.length} sports selected
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">Amenities</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formData.amenities.length || 0} selected
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">Photos</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formData.generalImages.length} general,{" "}
                        {Object.values(formData.sportImages).flat().length} sport images
                      </p>
                    </div>
                  </div>
                </OnboardingSectionCard>

                <div className="flex gap-3 border-t pt-4">
                  <Button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="bg-slate-600 px-6 text-white hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={loading}
                    className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      "Publish Venue"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
