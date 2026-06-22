"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, MapPin, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import OpeningHoursInput, {
  OpeningHours,
  getDefaultOpeningHours,
} from "@/modules/onboarding/components/OpeningHoursInput";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { CoachVerificationDocument, ServiceMode, Coach } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

type Step = 1 | 2 | 3;
type PricingMode = "SAME" | "PER_SPORT";

type UploadedDocument = {
  type: CoachVerificationDocument["type"];
  file: File | null;
  fileName: string;
};

type UploadedVenueImage = {
  file: File;
  fileName: string;
  previewUrl: string;
};

type ExistingOwnVenueDetails = {
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  images?: string[];
  imageS3Keys?: string[];
  amenities?: string[];
};

type CreateCoachResponseData = {
  coach?: {
    ownVenueDetails?: ExistingOwnVenueDetails;
  };
  data?: {
    coach?: {
      ownVenueDetails?: ExistingOwnVenueDetails;
    };
  };
};

type ApiConflictPayload = {
  message?: string;
  requiresConversion?: boolean;
  requiresSeparateAccount?: boolean;
  existingRole?: string;
  targetRole?: string;
};

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

interface FormErrors {
  [key: string]: string;
}

const emptyVenueHours = (): OpeningHours => getDefaultOpeningHours();

const isValidMobileNumber = (value: string) =>
  /^[+]?[0-9\s().\-]+$/.test(value.trim());
const sanitizeMobileNumber = (value: string) =>
  value.replace(/[^0-9+\s().\-]/g, "");

const formatOpeningHoursToString = (hours: OpeningHours): string => {
  const openDays = Object.entries(hours).filter(([, day]) => day.isOpen);

  if (openDays.length === 0) {
    return "Closed";
  }

  const firstDay = openDays[0][1];
  const allSame = openDays.every(
    ([, day]) =>
      day.openTime === firstDay.openTime &&
      day.closeTime === firstDay.closeTime,
  );

  if (allSame && openDays.length === 7) {
    return `${firstDay.openTime}-${firstDay.closeTime} (All days)`;
  }

  if (allSame) {
    const dayNames = openDays.map(([day]) => day.slice(0, 3)).join(",");
    return `${firstDay.openTime}-${firstDay.closeTime} (${dayNames})`;
  }

  return openDays
    .map(([day, hours]) => `${day}: ${hours.openTime}-${hours.closeTime}`)
    .join("; ");
};

const toCoachId = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybePayload = payload as {
    coach?: Partial<Coach>;
    data?: { coach?: Partial<Coach> };
  };

  return (
    maybePayload.coach?.id ||
    maybePayload.coach?._id ||
    maybePayload.data?.coach?.id ||
    maybePayload.data?.coach?._id ||
    ""
  );
};

export function CoachOnboardingForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successCoachId, setSuccessCoachId] = useState("");
  const [successCoachLink, setSuccessCoachLink] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profilePhotoKey, setProfilePhotoKey] = useState("");

  const [sports, setSports] = useState<string[]>([]);
  const [pricingMode, setPricingMode] = useState<PricingMode>("PER_SPORT");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [sportPricing, setSportPricing] = useState<Record<string, string>>({});
  const [serviceMode, setServiceMode] = useState<ServiceMode>("FREELANCE");
  const [serviceRadiusKmInput, setServiceRadiusKmInput] = useState("10");
  const [travelBufferTimeInput, setTravelBufferTimeInput] = useState("30");

  const [baseLocationQuery, setBaseLocationQuery] = useState("");
  const [baseLocationSuggestions, setBaseLocationSuggestions] = useState<
    GeoSuggestion[]
  >([]);
  const [baseLocationSearching, setBaseLocationSearching] = useState(false);
  const [baseLocationError, setBaseLocationError] = useState("");
  const [baseLocation, setBaseLocation] = useState<[number, number] | null>(
    null,
  );
  const baseLocationSkipRef = useRef(false);

  const [venueAddressQuery, setVenueAddressQuery] = useState("");
  const [venueAddressSuggestions, setVenueAddressSuggestions] = useState<
    GeoSuggestion[]
  >([]);
  const [venueAddressSearching, setVenueAddressSearching] = useState(false);
  const [venueAddressError, setVenueAddressError] = useState("");
  const [venueLocation, setVenueLocation] = useState<[number, number] | null>(
    null,
  );
  const venueLocationSkipRef = useRef(false);

  const [venueName, setVenueName] = useState("");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueOpeningHours, setVenueOpeningHours] =
    useState<OpeningHours>(emptyVenueHours());
  const [venueImageDrafts, setVenueImageDrafts] = useState<
    UploadedVenueImage[]
  >([]);
  const venueImageInputRef = useRef<HTMLInputElement | null>(null);
  const venueImagePreviewUrlsRef = useRef<string[]>([]);

  const [verificationDocs, setVerificationDocs] = useState<UploadedDocument[]>(
    [],
  );

  const isOwnVenue = serviceMode === "OWN_VENUE" || serviceMode === "HYBRID";
  const needsBaseLocation = serviceMode !== "OWN_VENUE";

  const hourlyRate = Number(hourlyRateInput || "0");

  const pricingPayload = useMemo(() => {
    const payload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      for (const sport of sports) {
        payload[sport] = hourlyRate;
      }
      return payload;
    }

    for (const sport of sports) {
      payload[sport] = Number(sportPricing[sport] || "0");
    }
    return payload;
  }, [pricingMode, sports, hourlyRate, sportPricing]);

  const resolvedHourlyRate =
    pricingMode === "SAME"
      ? hourlyRate
      : Math.min(...Object.values(pricingPayload).filter((v) => v > 0));

  const validateStep1 = () => {
    const nextErrors: FormErrors = {};

    if (firstName.trim().length < 2)
      nextErrors.firstName = "First name must be at least 2 characters";
    if (lastName.trim().length < 2)
      nextErrors.lastName = "Last name must be at least 2 characters";
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!phone.trim()) nextErrors.phone = "Phone is required";
    if (!bio.trim()) nextErrors.bio = "Bio is required";
    if (bio.trim().length < 20)
      nextErrors.bio = "Bio must be at least 20 characters";
    if (!isValidMobileNumber(phone))
      nextErrors.phone = "Please provide a valid phone number";

    if (!profilePhotoUrl.trim()) {
      nextErrors.profilePhoto = "Profile photo is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = () => {
    const nextErrors: FormErrors = {};

    if (sports.length === 0)
      nextErrors.sports = "At least one sport is required";

    if (pricingMode === "SAME") {
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        nextErrors.hourlyRate = "Hourly rate must be greater than 0";
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport] || "0");
        if (!Number.isFinite(value) || value <= 0) {
          nextErrors.sportPricing = `Please enter a valid price for ${sport}`;
          break;
        }
      }
    }

    if (needsBaseLocation) {
      if (!baseLocation) {
        nextErrors.baseLocation =
          "Base location is required for this service mode";
      }
      const serviceRadiusKm = Number(serviceRadiusKmInput || "0");
      if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0) {
        nextErrors.serviceRadiusKm = "Service radius must be greater than 0";
      }
      const travelBufferTime = Number(travelBufferTimeInput || "0");
      if (!Number.isFinite(travelBufferTime) || travelBufferTime < 0) {
        nextErrors.travelBufferTime = "Travel buffer time must be non-negative";
      }
    }

    if (isOwnVenue) {
      if (!venueName.trim()) nextErrors.venueName = "Venue name is required";
      if (!venueAddressQuery.trim())
        nextErrors.venueAddress = "Venue address is required";
      if (!venueLocation)
        nextErrors.venueAddress = "Select a venue location from suggestions";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep3 = () => {
    const nextErrors: FormErrors = {};

    if (isOwnVenue && venueImageDrafts.length < 3) {
      nextErrors.venueImages =
        "OWN_VENUE coaches require at least 3 venue images";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  useEffect(() => {
    if (baseLocationSkipRef.current) {
      baseLocationSkipRef.current = false;
      return;
    }

    const query = baseLocationQuery.trim();
    if (query.length < 3) {
      setBaseLocationSuggestions([]);
      setBaseLocationError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setBaseLocationSearching(true);
      setBaseLocationError("");
      try {
        const results = await geoApi.autocomplete(query);
        setBaseLocationSuggestions(results);
      } catch {
        setBaseLocationError("Unable to fetch base location suggestions");
        setBaseLocationSuggestions([]);
      } finally {
        setBaseLocationSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [baseLocationQuery]);

  useEffect(() => {
    if (venueLocationSkipRef.current) {
      venueLocationSkipRef.current = false;
      return;
    }

    const query = venueAddressQuery.trim();
    if (query.length < 3) {
      setVenueAddressSuggestions([]);
      setVenueAddressError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setVenueAddressSearching(true);
      setVenueAddressError("");
      try {
        const results = await geoApi.autocomplete(query);
        setVenueAddressSuggestions(results);
      } catch {
        setVenueAddressError("Unable to fetch venue suggestions");
        setVenueAddressSuggestions([]);
      } finally {
        setVenueAddressSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [venueAddressQuery]);

  const handleSelectBaseLocation = (suggestion: GeoSuggestion) => {
    baseLocationSkipRef.current = true;
    setBaseLocationQuery(suggestion.label);
    setBaseLocationSuggestions([]);
    setBaseLocation([suggestion.lon, suggestion.lat]);
    setBaseLocationError("");
  };

  const handleSelectVenueLocation = (suggestion: GeoSuggestion) => {
    venueLocationSkipRef.current = true;
    setVenueAddressQuery(suggestion.label);
    setVenueAddressSuggestions([]);
    setVenueLocation([suggestion.lon, suggestion.lat]);
    setVenueAddressError("");
  };

  const handleVenueImageSelect = (files: FileList | null) => {
    if (!files?.length) return;

    const selected = Array.from(files).filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Image ${file.name} exceeds 5MB.`);
        return false;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(
          `Invalid image type for ${file.name}. Use JPG, PNG, or WebP.`,
        );
        return false;
      }
      return true;
    });

    if (selected.length === 0) {
      return;
    }

    setErrors((prev) => ({ ...prev, venueImages: "" }));
    setVenueImageDrafts((prev) => [
      ...prev,
      ...selected.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        venueImagePreviewUrlsRef.current.push(previewUrl);

        return {
          file,
          fileName: file.name,
          previewUrl,
        };
      }),
    ]);
  };

  const handleDocumentSelect = (index: number, file: File | null) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Document ${file.name} exceeds 5MB.`);
      return;
    }

    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error(
        `Invalid file type for ${file.name}. Use JPG, PNG, WebP or PDF.`,
      );
      return;
    }

    setVerificationDocs((prev) =>
      prev.map((doc, currentIndex) =>
        currentIndex === index ? { ...doc, file, fileName: file.name } : doc,
      ),
    );
  };

  const addDocumentRow = () => {
    setVerificationDocs((prev) => [
      ...prev,
      { type: "CERTIFICATION", file: null, fileName: "" },
    ]);
  };

  const removeDocumentRow = (index: number) => {
    setVerificationDocs((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const removeVenueImage = (index: number) => {
    setVenueImageDrafts((prev) =>
      prev.filter((image, currentIndex) => {
        if (currentIndex === index) {
          URL.revokeObjectURL(image.previewUrl);
          venueImagePreviewUrlsRef.current =
            venueImagePreviewUrlsRef.current.filter(
              (previewUrl) => previewUrl !== image.previewUrl,
            );
          return false;
        }

        return true;
      }),
    );
  };

  useEffect(() => {
    return () => {
      for (const previewUrl of venueImagePreviewUrlsRef.current) {
        URL.revokeObjectURL(previewUrl);
      }
      venueImagePreviewUrlsRef.current = [];
    };
  }, []);

  const uploadFiles = async (
    coachId: string,
    files: Array<{
      file: File;
      documentType?: CoachVerificationDocument["type"];
      purpose: "DOCUMENT" | "VENUE_IMAGE";
    }>,
  ) => {
    const results: Array<{
      url: string;
      key: string;
      fileName: string;
      type?: CoachVerificationDocument["type"];
    }> = [];

    for (const item of files) {
      const response = await adminApi.getCoachVerificationUploadUrl(coachId, {
        fileName: item.file.name,
        contentType: item.file.type || "application/octet-stream",
        documentType: item.documentType,
        purpose: item.purpose,
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to get upload URL");
      }

      await uploadFileToPresignedUrl(
        item.file,
        response.data.uploadUrl,
        item.file.type || "application/octet-stream",
      );

      results.push({
        url: response.data.downloadUrl,
        key: response.data.key,
        fileName: response.data.fileName || item.file.name,
        type: item.documentType,
      });
    }

    return results;
  };

  const handleContinueFromStep1 = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleContinueFromStep2 = () => {
    if (!validateStep2()) return;
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      toast.error("Please fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    setCreating(true);
    try {
      const createPayload: Parameters<typeof adminApi.createCoach>[0] = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate: resolvedHourlyRate,
        sportPricing: pricingPayload,
        serviceMode,
        verificationStatus: "PENDING",
        ...(profilePhotoUrl
          ? {
              profilePhotoUrl,
              profilePhotoKey,
            }
          : {}),
        ...(needsBaseLocation && baseLocation
          ? {
              baseLocation: {
                type: "Point" as const,
                coordinates: baseLocation,
              },
              serviceRadiusKm: Number(serviceRadiusKmInput),
              travelBufferTime: Number(travelBufferTimeInput),
            }
          : {}),
        ...(isOwnVenue
          ? {
              ownVenueDetails: {
                name: venueName.trim(),
                address: venueAddressQuery.trim(),
                description: venueDescription.trim(),
                openingHours: formatOpeningHoursToString(venueOpeningHours),
                images: [],
                imageS3Keys: [],
                ...(venueLocation
                  ? {
                      location: {
                        type: "Point" as const,
                        coordinates: venueLocation,
                      },
                    }
                  : {}),
              },
            }
          : {}),
      };

      const createCoach = async (convertExistingUser?: boolean) =>
        adminApi.createCoach({
          ...createPayload,
          ...(convertExistingUser ? { convertExistingUser: true } : {}),
        });

      let createResponse;
      try {
        createResponse = await createCoach();
      } catch (error) {
        const { status, data } = getApiConflictPayload(error);

        if (status === 409 && data?.requiresConversion) {
          const shouldConvert = window.confirm(
            data.message ||
              "An account already exists. Convert it to a coach account to continue?",
          );

          if (shouldConvert) {
            createResponse = await createCoach(true);
          } else {
            return;
          }
        } else {
          throw error;
        }
      }

      if (!createResponse) {
        throw new Error("Failed to create coach");
      }

      if (!createResponse.success || !createResponse.data) {
        throw new Error(createResponse.message || "Failed to create coach");
      }

      const coachId = toCoachId(createResponse.data);
      if (!coachId) {
        throw new Error("Coach was created but the ID could not be resolved");
      }

      const documentFiles = verificationDocs
        .filter((doc) => doc.file)
        .map((doc) => ({
          file: doc.file as File,
          documentType: doc.type,
          purpose: "DOCUMENT" as const,
        }));

      const venueFiles = venueImageDrafts.map((item) => ({
        file: item.file,
        purpose: "VENUE_IMAGE" as const,
      }));

      const uploadedDocuments = documentFiles.length
        ? await uploadFiles(coachId, documentFiles)
        : [];
      const uploadedVenueImages = venueFiles.length
        ? await uploadFiles(coachId, venueFiles)
        : [];

      if (uploadedVenueImages.length > 0 && isOwnVenue) {
        const responseData = createResponse.data as CreateCoachResponseData;
        const existingOwnVenue =
          responseData.coach?.ownVenueDetails ||
          responseData.data?.coach?.ownVenueDetails ||
          {};
        await adminApi.updateCoach(coachId, {
          ownVenueDetails: {
            ...existingOwnVenue,
            name: venueName.trim(),
            address: venueAddressQuery.trim(),
            description: venueDescription.trim(),
            openingHours: formatOpeningHoursToString(venueOpeningHours),
            location: venueLocation
              ? {
                  type: "Point",
                  coordinates: venueLocation,
                }
              : existingOwnVenue.location,
            images: uploadedVenueImages.map((item) => item.url),
            imageS3Keys: uploadedVenueImages.map((item) => item.key),
            sports,
            amenities: existingOwnVenue.amenities || [],
            pricePerHour: resolvedHourlyRate,
          },
        });
      }

      if (uploadedDocuments.length > 0) {
        await adminApi.submitCoachVerificationAdmin(coachId, {
          documents: uploadedDocuments.map((item) => ({
            type: item.type || "OTHER",
            url: item.url,
            s3Key: item.key,
            fileName: item.fileName,
            uploadedAt: new Date().toISOString(),
          })),
        });
      }

      await adminApi.approveCoachVerification(coachId);

      const profileLink = `/admin/coach-verification/${coachId}`;
      setSuccessCoachId(coachId);
      setSuccessCoachLink(profileLink);
      toast.success("Coach onboarded and activated successfully");
      setStep(3);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create coach",
      );
    } finally {
      setCreating(false);
      setLoading(false);
    }
  };

  if (successCoachId) {
    return (
      <Card className="border border-emerald-200 bg-linear-to-br from-white to-emerald-50 p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Onboarding complete
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Coach account created and activated
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The coach profile is live and ready for admin review.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700">
            <p>
              Coach ID:{" "}
              <span className="font-semibold text-slate-900">
                {successCoachId}
              </span>
            </p>
            <p className="mt-1">
              Profile link:{" "}
              <span className="font-semibold text-slate-900">
                {successCoachLink}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push(successCoachLink)}
            >
              Open coach review
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/coaches")}
            >
              Back to coaches
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
      <div className="border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-power-orange px-6 py-6 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-orange-200">
              Coach onboarding on behalf of
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Create a coach account as admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Mirror the client onboarding flow while creating the account,
              profile, venue details, and verification records on the
              coach&apos;s behalf.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="font-semibold">Steps</p>
            <p className="text-slate-200">
              1. Identity 2. Coaching setup 3. Review & submit
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((current) => (
            <button
              key={current}
              type="button"
              onClick={() => setStep(current as Step)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                step === current
                  ? "border-power-orange bg-orange-50 text-power-orange"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <p className="text-xs uppercase tracking-wide">Step {current}</p>
              <p className="mt-1 text-sm font-semibold">
                {current === 1 && "Identity"}
                {current === 2 && "Coaching setup"}
                {current === 3 && "Review & submit"}
              </p>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <OnboardingSectionCard
              title="Coach identity"
              subtitle="Create the account and capture the coach's personal details."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    First name *
                  </label>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                      errors.firstName
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:ring-power-orange/30"
                    }`}
                    placeholder="First name"
                    disabled={loading}
                  />
                  {errors.firstName ? (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.firstName}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Last name *
                  </label>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                      errors.lastName
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:ring-power-orange/30"
                    }`}
                    placeholder="Last name"
                    disabled={loading}
                  />
                  {errors.lastName ? (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.lastName}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                      errors.email
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:ring-power-orange/30"
                    }`}
                    placeholder="coach@example.com"
                    disabled={loading}
                  />
                  {errors.email ? (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(sanitizeMobileNumber(event.target.value))
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                      errors.phone
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:ring-power-orange/30"
                    }`}
                    placeholder="+91 98765 43210"
                    disabled={loading}
                  />
                  {errors.phone ? (
                    <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Bio *
                </label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  className={`w-full rounded-2xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                    errors.bio
                      ? "border-red-400 focus:ring-red-200"
                      : "border-slate-300 focus:ring-power-orange/30"
                  }`}
                  placeholder="Tell players about the coach's experience, style, and certifications."
                  disabled={loading}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{bio.length}/2000 characters</span>
                  {errors.bio ? (
                    <span className="text-red-600">{errors.bio}</span>
                  ) : (
                    <span>Minimum 20 characters</span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Profile photo *
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <CoachPhotoUpload
                    currentPhotoUrl={profilePhotoUrl}
                    onPhotoReady={(url, key) => {
                      setProfilePhotoUrl(url || "");
                      setProfilePhotoKey(key || "");
                      setErrors((prev) => ({ ...prev, profilePhoto: "" }));
                    }}
                    disabled={loading}
                  />
                  {errors.profilePhoto ? (
                    <p className="mt-2 text-center text-xs text-red-600">
                      {errors.profilePhoto}
                    </p>
                  ) : null}
                </div>
              </div>
            </OnboardingSectionCard>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={handleContinueFromStep1}
                disabled={loading}
              >
                Continue to coaching setup
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <OnboardingSectionCard
              title="Coaching setup"
              subtitle="Match the client flow: sports, pricing, service mode, and service location."
            >
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Pricing</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="pricingMode"
                      checked={pricingMode === "SAME"}
                      onChange={() => setPricingMode("SAME")}
                      disabled={loading}
                    />
                    Same price for all sports
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="pricingMode"
                      checked={pricingMode === "PER_SPORT"}
                      onChange={() => setPricingMode("PER_SPORT")}
                      disabled={loading}
                    />
                    Different price per sport
                  </label>
                </div>
              </div>

              {pricingMode === "SAME" ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Hourly rate *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={0.01}
                    value={hourlyRateInput}
                    onChange={(event) => setHourlyRateInput(event.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                      errors.hourlyRate
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-300 focus:ring-power-orange/30"
                    }`}
                    placeholder="500"
                    disabled={loading}
                  />
                  {errors.hourlyRate ? (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.hourlyRate}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Sports you can coach *
                </label>
                <SportsMultiSelect
                  value={sports}
                  onChange={(nextSports) => {
                    setSports(nextSports);
                    setErrors((prev) => ({ ...prev, sports: "" }));
                    setSportPricing((prev) => {
                      const updated = { ...prev };
                      for (const sport of nextSports) {
                        if (!updated[sport]) {
                          updated[sport] =
                            pricingMode === "SAME" ? hourlyRateInput : "";
                        }
                      }
                      for (const sport of Object.keys(updated)) {
                        if (!nextSports.includes(sport)) {
                          delete updated[sport];
                        }
                      }
                      return updated;
                    });
                  }}
                  disabled={loading}
                  required
                />
                {errors.sports ? (
                  <p className="mt-1 text-xs text-red-600">{errors.sports}</p>
                ) : null}
              </div>

              {pricingMode === "PER_SPORT" && sports.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Price per sport
                  </p>
                  {sports.map((sport) => (
                    <div
                      key={sport}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <label className="w-40 text-sm font-medium text-slate-700">
                        {sport}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">₹</span>
                        <input
                          type="number"
                          min={1}
                          step={0.01}
                          value={sportPricing[sport] || ""}
                          onChange={(event) =>
                            setSportPricing((prev) => ({
                              ...prev,
                              [sport]: event.target.value,
                            }))
                          }
                          className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-power-orange/30"
                          placeholder="500"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  ))}
                  {errors.sportPricing ? (
                    <p className="text-xs text-red-600">
                      {errors.sportPricing}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Service mode
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["OWN_VENUE", "Own venue"],
                      ["FREELANCE", "Freelance"],
                      ["HYBRID", "Hybrid"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setServiceMode(value)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        serviceMode === value
                          ? "border-power-orange bg-orange-50 text-power-orange"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                      disabled={loading}
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {value === "OWN_VENUE" &&
                          "Coach teaches from a private venue."}
                        {value === "FREELANCE" &&
                          "Coach travels to players' locations."}
                        {value === "HYBRID" &&
                          "Coach offers both venue and travel options."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {needsBaseLocation ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-power-orange" />
                    <p className="text-sm font-semibold text-slate-900">
                      Base location
                    </p>
                  </div>
                  <div>
                    <input
                      value={baseLocationQuery}
                      onChange={(event) => {
                        setBaseLocationQuery(event.target.value);
                        setBaseLocation(null);
                        setBaseLocationError("");
                      }}
                      placeholder="Search base location"
                      className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                        errors.baseLocation
                          ? "border-red-400 focus:ring-red-200"
                          : "border-slate-300 focus:ring-power-orange/30"
                      }`}
                      disabled={loading}
                    />
                    {baseLocationSearching ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Searching...
                      </p>
                    ) : null}
                    {baseLocationError ? (
                      <p className="mt-1 text-xs text-red-600">
                        {baseLocationError}
                      </p>
                    ) : null}
                    {baseLocationSuggestions.length > 0 ? (
                      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        {baseLocationSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                            type="button"
                            onClick={() => handleSelectBaseLocation(suggestion)}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {errors.baseLocation ? (
                    <p className="text-xs text-red-600">
                      {errors.baseLocation}
                    </p>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Service radius (km) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={serviceRadiusKmInput}
                        onChange={(event) =>
                          setServiceRadiusKmInput(event.target.value)
                        }
                        className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                          errors.serviceRadiusKm
                            ? "border-red-400 focus:ring-red-200"
                            : "border-slate-300 focus:ring-power-orange/30"
                        }`}
                        disabled={loading}
                      />
                      {errors.serviceRadiusKm ? (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.serviceRadiusKm}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Travel buffer time (minutes) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={travelBufferTimeInput}
                        onChange={(event) =>
                          setTravelBufferTimeInput(event.target.value)
                        }
                        className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                          errors.travelBufferTime
                            ? "border-red-400 focus:ring-red-200"
                            : "border-slate-300 focus:ring-power-orange/30"
                        }`}
                        disabled={loading}
                      />
                      {errors.travelBufferTime ? (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.travelBufferTime}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {isOwnVenue ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Venue details
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Admins can enter and lock these details on the
                      coach&apos;s behalf.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Venue name *
                      </label>
                      <input
                        value={venueName}
                        onChange={(event) => setVenueName(event.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                          errors.venueName
                            ? "border-red-400 focus:ring-red-200"
                            : "border-slate-300 focus:ring-power-orange/30"
                        }`}
                        placeholder="Venue name"
                        disabled={loading}
                      />
                      {errors.venueName ? (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.venueName}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Venue address *
                      </label>
                      <input
                        value={venueAddressQuery}
                        onChange={(event) => {
                          setVenueAddressQuery(event.target.value);
                          setVenueLocation(null);
                          setVenueAddressError("");
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                          errors.venueAddress
                            ? "border-red-400 focus:ring-red-200"
                            : "border-slate-300 focus:ring-power-orange/30"
                        }`}
                        placeholder="Search venue address"
                        disabled={loading}
                      />
                      {venueAddressSearching ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Searching...
                        </p>
                      ) : null}
                      {venueAddressError ? (
                        <p className="mt-1 text-xs text-red-600">
                          {venueAddressError}
                        </p>
                      ) : null}
                      {venueAddressSuggestions.length > 0 ? (
                        <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                          {venueAddressSuggestions.map((suggestion) => (
                            <button
                              key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                              type="button"
                              onClick={() =>
                                handleSelectVenueLocation(suggestion)
                              }
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {errors.venueAddress ? (
                    <p className="text-xs text-red-600">
                      {errors.venueAddress}
                    </p>
                  ) : null}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Venue description
                    </label>
                    <textarea
                      value={venueDescription}
                      onChange={(event) =>
                        setVenueDescription(event.target.value)
                      }
                      rows={4}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:ring-2 focus:ring-power-orange/30"
                      placeholder="Optional venue description"
                      disabled={loading}
                    />
                  </div>

                  <OpeningHoursInput
                    value={venueOpeningHours}
                    onChange={setVenueOpeningHours}
                  />
                </div>
              ) : null}
            </OnboardingSectionCard>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleContinueFromStep2}
                disabled={loading}
              >
                Continue to review
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <OnboardingSectionCard
              title="Review & submit"
              subtitle="Check everything before creating the account and activating the coach."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Identity
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">
                        Name:
                      </span>{" "}
                      {firstName} {lastName}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Email:
                      </span>{" "}
                      {email}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Phone:
                      </span>{" "}
                      {phone}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Bio:</span>{" "}
                      {bio}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Coaching setup
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">
                        Sports:
                      </span>{" "}
                      {sports.join(", ") || "None"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Pricing mode:
                      </span>{" "}
                      {pricingMode}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Service mode:
                      </span>{" "}
                      {serviceMode}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Profile photo:
                      </span>{" "}
                      {profilePhotoUrl ? "Uploaded" : "Missing"}
                    </p>
                  </div>
                </div>
              </div>

              {isOwnVenue ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Venue details
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">
                        Venue name:
                      </span>{" "}
                      {venueName}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Venue address:
                      </span>{" "}
                      {venueAddressQuery}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">
                        Venue images queued:
                      </span>{" "}
                      {venueImageDrafts.length}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Verification documents
                    </p>
                    <p className="text-sm text-slate-600">
                      Optional for admin-created coaches. Add documents only if
                      you want them stored for review.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addDocumentRow}
                    disabled={loading}
                  >
                    <Plus size={14} /> Add document
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {verificationDocs.map((doc, index) => (
                    <div
                      key={`${index}-${doc.type}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                            Document type
                          </label>
                          <select
                            value={doc.type}
                            onChange={(event) =>
                              setVerificationDocs((prev) =>
                                prev.map((item, currentIndex) =>
                                  currentIndex === index
                                    ? {
                                        ...item,
                                        type: event.target
                                          .value as CoachVerificationDocument["type"],
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            disabled={loading}
                          >
                            <option value="CERTIFICATION">Certification</option>
                            <option value="ID_PROOF">ID Proof</option>
                            <option value="ADDRESS_PROOF">Address Proof</option>
                            <option value="BACKGROUND_CHECK">
                              Background Check
                            </option>
                            <option value="INSURANCE">Insurance</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                            Uploaded file
                          </label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {doc.fileName || "No file selected"}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            <Upload size={14} /> Upload
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              className="hidden"
                              disabled={loading}
                              onChange={(event) =>
                                handleDocumentSelect(
                                  index,
                                  event.target.files?.[0] || null,
                                )
                              }
                            />
                          </label>
                          {verificationDocs.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeDocumentRow(index)}
                              className="inline-flex items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                              disabled={loading}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.venueImages ? (
                  <p className="mt-3 text-xs text-red-600">
                    {errors.venueImages}
                  </p>
                ) : null}
              </div>

              {isOwnVenue ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Venue images
                      </p>
                      <p className="text-sm text-slate-600">
                        Upload files now, then the final submit will create,
                        attach, and activate the coach.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => venueImageInputRef.current?.click()}
                      disabled={loading}
                    >
                      <Upload size={14} /> Add images
                    </button>
                    <input
                      ref={venueImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={loading}
                      onChange={(event) => {
                        handleVenueImageSelect(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {venueImageDrafts.map((image, index) => (
                      <div
                        key={`${image.fileName}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
                          <Image
                            src={image.previewUrl}
                            alt={image.fileName}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {image.fileName}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeVenueImage(index)}
                            className="text-red-600"
                            disabled={loading}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </OnboardingSectionCard>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(2)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={loading || creating}
              >
                {creating ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Creating coach account...
                  </span>
                ) : (
                  "Create, review, and activate coach"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
