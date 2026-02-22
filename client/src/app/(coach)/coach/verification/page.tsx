"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import OpeningHoursInput, {
  OpeningHours,
  getDefaultOpeningHours,
} from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { Coach, CoachVerificationDocument, ServiceMode, User } from "@/types";
import {
  CheckCircle,
  Upload,
  Lightbulb,
  Award,
  Briefcase,
  Target,
  Star,
  Users,
  MapPin,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";

type VerificationStep = 1 | 2 | 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const getInitialServiceMode = (): ServiceMode => {
  if (typeof window === "undefined") {
    return "FREELANCE";
  }

  const savedMode = localStorage.getItem("coachServiceMode");
  if (
    savedMode === "OWN_VENUE" ||
    savedMode === "FREELANCE" ||
    savedMode === "HYBRID"
  ) {
    return savedMode;
  }

  return "FREELANCE";
};

const isValidMobileNumber = (value: string) =>
  /^[+]?[0-9\s().\-]+$/.test(value.trim());

const sanitizeMobileNumber = (value: string) =>
  value.replace(/[^0-9+\s().\-]/g, "");

// Helper to parse simple opening hours string to structured format
const parseOpeningHoursString = (hoursStr: string): OpeningHours => {
  // If it's a simple format like "09:00-18:00", apply to all days
  const simplePattern = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/;
  const match = hoursStr.match(simplePattern);

  if (match) {
    const [, openTime, closeTime] = match;
    const dayHours = { isOpen: true, openTime, closeTime };
    return {
      monday: dayHours,
      tuesday: dayHours,
      wednesday: dayHours,
      thursday: dayHours,
      friday: dayHours,
      saturday: dayHours,
      sunday: dayHours,
    };
  }

  // Otherwise return default
  return getDefaultOpeningHours();
};

// Helper to convert OpeningHours to a summary string
const formatOpeningHoursToString = (hours: OpeningHours): string => {
  const openDays = Object.entries(hours).filter(([, day]) => day.isOpen);

  if (openDays.length === 0) {
    return "Closed";
  }

  // Check if all open days have the same hours
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

  // Return detailed format
  return openDays
    .map(([day, hours]) => `${day}: ${hours.openTime}-${hours.closeTime}`)
    .join("; ");
};

const getVerificationBadge = (coachData: Coach | null) => {
  if (!coachData) {
    return {
      label: "Not Started",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
    };
  }

  const status =
    coachData.verificationStatus ||
    (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");

  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        className: "bg-green-100 text-green-700 border border-green-200",
      };
    case "PENDING":
      return {
        label: "Pending Review",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    case "REVIEW":
      return {
        label: "In Review",
        className: "bg-blue-100 text-blue-700 border border-blue-200",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border border-red-200",
      };
    default:
      return {
        label: "Not Started",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
};

const getStatusGuidance = (status: string) => {
  switch (status) {
    case "PENDING":
      return "Your verification is submitted and pending admin review. You'll be notified once reviewed.";
    case "REVIEW":
      return "Your verification is currently under review. Edits are temporarily disabled.";
    case "VERIFIED":
      return "You are verified! Redirecting to your profile...";
    case "REJECTED":
      return "Your verification was rejected. Update documents and resubmit.";
    default:
      return "Complete all 3 steps: Profile info, Sports & Pricing, and upload both certification and ID proof documents.";
  }
};

export default function CoachVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(
    null,
  );
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<VerificationStep>(1);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [pricingMode, setPricingMode] = useState<"SAME" | "PER_SPORT">(
    "PER_SPORT",
  );
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportPricing, setSportPricing] = useState<Record<string, string>>({});

  // Service mode tracking
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    getInitialServiceMode(),
  );

  // Venue details for OWN_VENUE/HYBRID coaches
  const [venueDetails, setVenueDetails] = useState({
    name: "",
    address: "",
    description: "",
    openingHours: getDefaultOpeningHours(),
  });

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<GeoSuggestion[]>(
    [],
  );
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [venueCoordinates, setVenueCoordinates] = useState<
    [number, number] | null
  >(null);
  const skipSearchRef = useRef(false); // Flag to skip search effect after selection

  const [verificationDocs, setVerificationDocs] = useState<
    CoachVerificationDocument[]
  >([
    { type: "CERTIFICATION", url: "", fileName: "" },
    { type: "ID_PROOF", url: "", fileName: "" },
  ]);

  const status = useMemo(() => {
    if (!coachProfile) {
      return "UNVERIFIED";
    }

    return (
      coachProfile.verificationStatus ||
      (coachProfile.isVerified ? "VERIFIED" : "UNVERIFIED")
    );
  }, [coachProfile]);

  const isLockedByReview =
    status === "PENDING" || status === "REVIEW" || status === "VERIFIED";

  // Debounced address search
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressSearchError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setIsAddressSearching(true);
      setAddressSearchError("");
      try {
        const results = await geoApi.autocomplete(query);
        setAddressSuggestions(results);
      } catch {
        setAddressSearchError("Unable to fetch suggestions");
      } finally {
        setIsAddressSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [addressQuery]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddressQuery(value);
    setVenueDetails((prev) => ({
      ...prev,
      address: value,
    }));
  };

  const handleSelectAddressSuggestion = (suggestion: GeoSuggestion) => {
    // Set flag to skip search effect on next render
    skipSearchRef.current = true;

    // Display the address in the input field
    setAddressQuery(suggestion.label);

    // Close suggestions
    setAddressSuggestions([]);
    setAddressSearchError("");

    // Store the coordinates and full details
    setVenueCoordinates([suggestion.lon, suggestion.lat]);
    setVenueDetails((prev) => ({
      ...prev,
      address: suggestion.label,
    }));
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setAddressSearchError("Geolocation is not supported by this browser");
      return;
    }

    setIsGeocoding(true);
    setAddressSearchError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await geoApi.reverse(latitude, longitude);
          if (!result) {
            setAddressSearchError("Unable to find address for this location");
            return;
          }

          setAddressSuggestions([]);
          setAddressQuery(result.label);
          setVenueCoordinates([result.lon, result.lat]);
          setVenueDetails((prev) => ({
            ...prev,
            address: result.label,
          }));
        } catch {
          setAddressSearchError("Unable to resolve current location");
        } finally {
          setIsGeocoding(false);
        }
      },
      () => {
        setAddressSearchError("Location access was denied");
        setIsGeocoding(false);
      },
    );
  };

  // Redirect verified coaches to profile page
  useEffect(() => {
    if (!loading && status === "VERIFIED" && coachProfile) {
      router.push("/coach/profile");
    }
  }, [loading, status, coachProfile, router]);

  const loadProfile = async () => {
    try {
      const [coachResponse, userResponse] = await Promise.all([
        coachApi.getMyProfile(),
        authApi.getProfile(),
      ]);

      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data);
        if (userResponse.data.phone) {
          setMobileNumber(userResponse.data.phone);
        }
      }

      if (coachResponse.success && coachResponse.data) {
        const coach = coachResponse.data;
        setCoachProfile(coach);
        setBio(coach.bio || "");
        setSelectedSports(coach.sports || []);
        setHourlyRateInput(
          coach.hourlyRate && coach.hourlyRate > 0
            ? String(coach.hourlyRate)
            : "",
        );

        // Load service mode
        if (coach.serviceMode) {
          setServiceMode(coach.serviceMode);
        }

        // Load venue details if they exist
        if (coach.ownVenueDetails) {
          const venue = coach.ownVenueDetails;
          setVenueDetails({
            name: venue.name || "",
            address: venue.address || "",
            description: venue.description || "",
            openingHours: venue.openingHours
              ? parseOpeningHoursString(venue.openingHours)
              : getDefaultOpeningHours(),
          });
          // Load coordinates from location object
          if (venue.location?.coordinates) {
            setVenueCoordinates(venue.location.coordinates);
          }
        }

        setSportPricing(() => {
          const prices: Record<string, string> = {};
          (coach.sports || []).forEach((sport) => {
            const value = coach.sportPricing?.[sport];
            if (typeof value === "number" && value > 0) {
              prices[sport] = String(value);
            } else if (coach.hourlyRate && coach.hourlyRate > 0) {
              prices[sport] = String(coach.hourlyRate);
            } else {
              prices[sport] = "";
            }
          });
          return prices;
        });
        const pricingValues = Object.values(
          (coach.sportPricing || {}) as Record<string, number>,
        );
        const hasPerSport = pricingValues.some((value) => value > 0);
        const allMatchHourly =
          hasPerSport &&
          coach.hourlyRate &&
          pricingValues.every((value) => value === coach.hourlyRate);
        setPricingMode(allMatchHourly ? "SAME" : "PER_SPORT");

        if (coach.verificationDocuments?.length) {
          setVerificationDocs(
            coach.verificationDocuments.map((doc) => ({
              type: doc.type,
              url: doc.url,
              s3Key: doc.s3Key,
              fileName: doc.fileName,
              uploadedAt: doc.uploadedAt,
            })),
          );
        }
      }
    } catch {
      setCoachProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Invalid file type. Upload JPG, PNG, WebP, or PDF only.",
      };
    }

    return { valid: true };
  };

  const handleUploadDocument = async (index: number, file: File) => {
    setError("");
    setSuccess("");

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setUploadingDocIndex(index);
    try {
      const currentDoc = verificationDocs[index];
      if (!currentDoc) {
        throw new Error("Document row not found");
      }

      const uploadResponse = await coachApi.getVerificationUploadUrl({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        documentType: currentDoc.type,
      });

      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.message || "Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key, fileName } = uploadResponse.data;
      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadResult.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      setVerificationDocs((prev) =>
        prev.map((doc, i) =>
          i === index
            ? {
                ...doc,
                url: downloadUrl,
                s3Key: key,
                fileName,
                uploadedAt: new Date().toISOString(),
              }
            : doc,
        ),
      );
      setSuccess(`${fileName} uploaded successfully.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setUploadingDocIndex(null);
    }
  };

  const handleStepOneContinue = () => {
    setError("");
    setSuccess("");

    if (!user?.photoUrl?.trim()) {
      setError("Profile picture is required to continue.");
      return;
    }

    if (!bio.trim()) {
      setError("Bio is required to continue.");
      return;
    }

    if (!mobileNumber.trim()) {
      setError("Mobile number is required to continue.");
      return;
    }

    if (!isValidMobileNumber(mobileNumber)) {
      setError("Please provide a valid mobile number.");
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        const response = await coachApi.saveVerificationStep1({
          bio: bio.trim(),
          mobileNumber: mobileNumber.trim(),
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to save step 1");
        }

        if (response.data && "sports" in response.data) {
          setCoachProfile(response.data as Coach);
        }

        setStep(2);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save step 1",
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleStepTwoContinue = async () => {
    setError("");
    setSuccess("");

    const sports = selectedSports;
    if (sports.length === 0) {
      setError("Please add at least one sport you can teach.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      const hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setError("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          setError(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
    }

    const hourlyRate = Math.max(...Object.values(pricingPayload));

    // Validate venue details if needed
    if (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") {
      if (!venueDetails.name.trim()) {
        setError("Please provide a venue name.");
        return;
      }
      if (!venueDetails.address.trim()) {
        setError("Please provide a venue address.");
        return;
      }
      if (!venueCoordinates) {
        setError(
          "Please select a venue address from the suggestions or use current location to set the coordinates.",
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload: {
        bio: string;
        sports: string[];
        certifications: string[];
        hourlyRate: number;
        sportPricing: Record<string, number>;
        serviceMode: ServiceMode;
        ownVenueDetails?: {
          name: string;
          address: string;
          description: string;
          openingHours: string;
        };
      } = {
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate,
        sportPricing: pricingPayload,
        serviceMode,
      };

      // Add venue details if coach owns a venue
      if (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") {
        payload.ownVenueDetails = {
          name: venueDetails.name.trim(),
          address: venueDetails.address.trim(),
          description: venueDetails.description.trim(),
          openingHours: formatOpeningHoursToString(venueDetails.openingHours),
          ...(venueCoordinates && {
            location: {
              type: "Point",
              coordinates: venueCoordinates,
            },
          }),
        };
      }

      const step2Response = await coachApi.saveVerificationStep2(payload);

      if (!step2Response.success || !step2Response.data) {
        throw new Error(step2Response.message || "Failed to save step 2");
      }

      setCoachProfile(step2Response.data);
      localStorage.removeItem("coachServiceMode");
      setStep(3);
      setSuccess("Step 2 completed. Now upload your certification documents.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save your profile details",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    setError("");
    setSuccess("");

    const sports = selectedSports;
    let hourlyRate = 0;

    if (!bio.trim()) {
      setError("Bio is required.");
      return;
    }

    if (sports.length === 0) {
      setError("Please add at least one sport.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setError("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          setError(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
      hourlyRate = Math.max(...Object.values(pricingPayload));
    }

    const invalidDoc = verificationDocs.find(
      (doc) => !doc.url.trim() || !doc.fileName.trim(),
    );
    if (invalidDoc) {
      setError("Please upload a file for each listed document.");
      return;
    }

    const hasCertificationDoc = verificationDocs.some(
      (doc) => doc.type === "CERTIFICATION",
    );
    if (!hasCertificationDoc) {
      setError("At least one uploaded document must be a CERTIFICATION.");
      return;
    }

    const hasIdProofDoc = verificationDocs.some(
      (doc) => doc.type === "ID_PROOF",
    );
    if (!hasIdProofDoc) {
      setError("At least one uploaded document must be an ID_PROOF.");
      return;
    }

    setSaving(true);
    try {
      const step2SyncResponse = await coachApi.saveVerificationStep2({
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate,
        sportPricing: pricingPayload,
        serviceMode: getInitialServiceMode(),
      });

      if (!step2SyncResponse.success || !step2SyncResponse.data) {
        throw new Error(step2SyncResponse.message || "Failed to sync profile");
      }

      setCoachProfile(step2SyncResponse.data);

      const response = await coachApi.submitVerificationStep3({
        documents: verificationDocs.map((doc) => ({
          type: doc.type,
          url: doc.url.trim(),
          fileName: doc.fileName.trim(),
          s3Key: doc.s3Key,
          uploadedAt: doc.uploadedAt,
        })),
      });

      if (!response.success) {
        throw new Error(response.message || "Verification submission failed");
      }

      setSuccess(
        "Verification submitted successfully. Your profile is now in review.",
      );
      await loadProfile();

      // Redirect to coach profile
      setTimeout(() => {
        router.push("/coach/profile");
      }, 2000);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit verification",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading verification flow...</p>
      </Card>
    );
  }

  const badge = getVerificationBadge(coachProfile);
  const guidance = getStatusGuidance(status);

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Coach Verification
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              Complete Your Verification
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              3 steps: Bio, Sports, Certifications/Documents
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {guidance}
        </div>

        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {coachProfile.verificationNotes}
          </div>
        )}
      </Card>

      <Card className="bg-white">
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((current) => (
            <div
              key={current}
              className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                step === current
                  ? "border-power-orange bg-orange-50 text-power-orange"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              Step {current}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Profile Picture <span className="text-red-600">*</span>
              </label>
              <div className="flex items-center gap-4">
                <ProfilePictureUpload
                  currentPhotoUrl={user?.photoUrl}
                  onUploadSuccess={(updatedUser) => {
                    setUser(updatedUser);
                  }}
                  size="lg"
                />
                <div className="text-sm text-slate-600">
                  <p className="font-medium">Upload your profile picture</p>
                  <p className="text-xs text-slate-500">
                    Required for verification. JPG, PNG or WebP (Max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Bio (About You)
              </label>

              {/* Bio Tips Banner */}
              <div className="mb-4 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 mb-2">
                      Tips to Write a Great Bio
                    </p>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <Award className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Experience:</strong> Years of coaching, sports
                          background
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Briefcase className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Certifications:</strong> Relevant credentials
                          and achievements
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Specialization:</strong> What levels
                          (beginner/advanced)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Star className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Coaching Style:</strong> Your approach and
                          philosophy
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Track Record:</strong> Success stories or
                          player achievements
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={5}
                disabled={isLockedByReview}
                minLength={20}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="Tell players about your experience, achievements, and coaching style."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) =>
                  setMobileNumber(sanitizeMobileNumber(event.target.value))
                }
                disabled={isLockedByReview}
                inputMode="tel"
                pattern="^[+]?[0-9\s().\-]+$"
                maxLength={20}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="e.g., 9876543210"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                disabled={isLockedByReview || saving}
                onClick={handleStepOneContinue}
              >
                Continue to Sports
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Pricing</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="SAME"
                    checked={pricingMode === "SAME"}
                    disabled={isLockedByReview}
                    onChange={() => setPricingMode("SAME")}
                  />
                  Same price for all sports
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="PER_SPORT"
                    checked={pricingMode === "PER_SPORT"}
                    disabled={isLockedByReview}
                    onChange={() => setPricingMode("PER_SPORT")}
                  />
                  Different price per sport
                </label>
              </div>
            </div>

            {pricingMode === "SAME" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Hourly Price
                </label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={hourlyRateInput}
                  disabled={isLockedByReview}
                  onChange={(event) => setHourlyRateInput(event.target.value)}
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                  placeholder="e.g., 500"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Sports You Can Teach
              </label>
              <SportsMultiSelect
                value={selectedSports}
                onChange={(sports) => {
                  setSelectedSports(sports);
                  // Initialize pricing for new sports
                  const updatedPricing = { ...sportPricing };
                  sports.forEach((sport) => {
                    if (!updatedPricing[sport]) {
                      updatedPricing[sport] =
                        pricingMode === "SAME" ? hourlyRateInput || "" : "";
                    }
                  });
                  // Remove pricing for unselected sports
                  Object.keys(updatedPricing).forEach((sport) => {
                    if (!sports.includes(sport)) {
                      delete updatedPricing[sport];
                    }
                  });
                  setSportPricing(updatedPricing);
                }}
                disabled={isLockedByReview}
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Search for sports or add custom ones. Gemini will verify custom
                sports automatically.
              </p>
            </div>

            {pricingMode === "PER_SPORT" && selectedSports.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">
                  Price per Sport
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedSports.map((sport) => (
                    <div key={sport}>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                        {sport}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={0.01}
                        value={sportPricing[sport] || ""}
                        disabled={isLockedByReview}
                        inputMode="decimal"
                        pattern="^\d+(\.\d{1,2})?$"
                        onChange={(event) =>
                          setSportPricing((prev) => ({
                            ...prev,
                            [sport]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                        placeholder="e.g., 600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") && (
              <div className="space-y-4 border-t border-slate-200 pt-6 mt-6">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-power-orange mt-1 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Your Venue Details
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Provide information about your venue where you&apos;ll
                      conduct coaching sessions.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Venue Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={venueDetails.name}
                      onChange={(e) =>
                        setVenueDetails((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      disabled={isLockedByReview}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      placeholder="e.g., Elite Sports Arena"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Venue Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addressQuery}
                        onChange={handleAddressChange}
                        disabled={isLockedByReview}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                        placeholder="Search your venue location"
                      />
                      {isAddressSearching && (
                        <span className="absolute right-3 top-3 text-xs text-slate-500">
                          Searching...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-slate-500">
                        Start typing to see suggestions
                      </p>
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="text-xs font-semibold text-power-orange hover:text-orange-600 disabled:opacity-50"
                        disabled={isLockedByReview || isGeocoding}
                      >
                        {isGeocoding ? "Locating..." : "Use current location"}
                      </button>
                    </div>
                    {addressSearchError && (
                      <p className="text-xs text-red-500 mt-2">
                        {addressSearchError}
                      </p>
                    )}
                    {addressSuggestions.length > 0 && (
                      <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm z-10">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={`${suggestion.lat}-${suggestion.lon}-${suggestion.label}`}
                            onClick={() =>
                              handleSelectAddressSuggestion(suggestion)
                            }
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-power-orange/5 border-b border-slate-100 last:border-b-0"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Venue Description
                    </label>
                    <textarea
                      value={venueDetails.description}
                      onChange={(e) =>
                        setVenueDetails((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      disabled={isLockedByReview}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      placeholder="Describe the facilities, equipment, and amenities available at your venue."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-power-orange" />
                      <label className="block text-sm font-semibold text-slate-900">
                        Opening Hours
                      </label>
                    </div>
                    <OpeningHoursInput
                      value={venueDetails.openingHours}
                      onChange={(hours) =>
                        setVenueDetails((prev) => ({
                          ...prev,
                          openingHours: hours,
                        }))
                      }
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Set your venue availability for bookings
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStepTwoContinue}
                disabled={saving || isLockedByReview}
              >
                {saving ? "Saving..." : "Continue to Documents"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Upload Verification Documents
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLockedByReview || uploadingDocIndex !== null}
                  onClick={() =>
                    setVerificationDocs((prev) => [
                      ...prev,
                      { type: "CERTIFICATION", url: "", fileName: "" },
                    ])
                  }
                >
                  Add Document
                </Button>
              </div>

              {verificationDocs.map((doc, index) => (
                <div
                  key={`${doc.fileName}-${index}`}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                          Document Type
                        </label>
                        <select
                          value={doc.type}
                          disabled={
                            isLockedByReview || uploadingDocIndex !== null
                          }
                          onChange={(event) =>
                            setVerificationDocs((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      type: event.target
                                        .value as CoachVerificationDocument["type"],
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                          Uploaded File
                        </label>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {doc.fileName || "No file uploaded"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Upload size={14} />
                        {uploadingDocIndex === index
                          ? "Uploading..."
                          : "Upload"}
                        <input
                          type="file"
                          disabled={
                            isLockedByReview || uploadingDocIndex === index
                          }
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleUploadDocument(index, file);
                            }
                          }}
                        />
                      </label>

                      {verificationDocs.length > 1 && !isLockedByReview && (
                        <button
                          type="button"
                          disabled={uploadingDocIndex !== null}
                          onClick={() =>
                            setVerificationDocs((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  saving || isLockedByReview || uploadingDocIndex !== null
                }
                onClick={handleSubmitVerification}
              >
                {saving ? "Submitting..." : "Submit for Verification"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
