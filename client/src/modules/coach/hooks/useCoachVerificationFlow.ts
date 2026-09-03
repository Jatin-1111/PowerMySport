import { toast } from "@/lib/toast";
import { useFetchProfile } from "@/modules/auth/hooks/useProfile";
import { coachApi } from "@/modules/coach/services/coach";
import {
  getCoachVerificationStatus,
  isCoachVerificationFlowComplete,
} from "@/modules/coach/utils/verification";
import {
  ALLOWED_IMAGE_FILE_TYPES,
  clearCoachVerificationDraft,
  formatOpeningHoursToString,
  getCoachVerificationDraftStorageKey,
  getInitialServiceMode,
  getStatusGuidance,
  getVerificationBadge,
  isValidMobileNumber,
  MAX_FILE_SIZE,
  parseOpeningHoursString,
  readCoachVerificationDraft,
  sanitizeMobileNumber,
  validateVerificationFile,
  writeCoachVerificationDraft,
  VerificationStep,
} from "@/modules/coach/utils/verificationFlow";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { getDefaultOpeningHours } from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { Coach, CoachVerificationDocument, ServiceMode, User } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * All state, effects and handlers for the coach verification flow —
 * extracted from the page component so the route file holds only routing
 * and composition. No logic changed, only where it lives.
 */
export function useCoachVerificationFlow() {
  const router = useRouter();
  // Shared cached profile fetch — one cache entry across every consumer.
  const fetchProfile = useFetchProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(null);
  const [isUploadingVenueImage, setIsUploadingVenueImage] = useState(false);
  const [isDraggingVenueImages, setIsDraggingVenueImages] = useState(false);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<VerificationStep>(1);
  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [pricingMode, setPricingMode] = useState<"SAME" | "PER_SPORT">("PER_SPORT");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportPricing, setSportPricing] = useState<Record<string, string>>({});

  // Service mode tracking
  const [serviceMode, setServiceMode] = useState<ServiceMode>(getInitialServiceMode());
  const [serviceRadiusKmInput, setServiceRadiusKmInput] = useState("10");
  const [travelBufferTimeInput, setTravelBufferTimeInput] = useState("30");

  // Venue details for OWN_VENUE/HYBRID coaches
  const [venueDetails, setVenueDetails] = useState({
    name: "",
    address: "",
    description: "",
    openingHours: getDefaultOpeningHours(),
    images: [] as string[],
    imageS3Keys: [] as string[],
  });

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<GeoSuggestion[]>([]);
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [venueCoordinates, setVenueCoordinates] = useState<[number, number] | null>(null);
  const skipSearchRef = useRef(false); // Flag to skip search effect after selection
  const venueImageInputRef = useRef<HTMLInputElement | null>(null);

  const [verificationDocs, setVerificationDocs] = useState<CoachVerificationDocument[]>([]);
  const [requestedStep, setRequestedStep] = useState<VerificationStep | null>(null);
  const [isEditModeFromProfile, setIsEditModeFromProfile] = useState(false);
  const [resumeStepHint, setResumeStepHint] = useState<VerificationStep | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const hasHydratedDraftRef = useRef(false);
  const hasResolvedInitialStepRef = useRef(false);

  const status = useMemo(() => getCoachVerificationStatus(coachProfile), [coachProfile]);

  const isLockedByReview = status === "PENDING" || status === "REVIEW";
  // Must match the dashboard gate in coach/layout.tsx exactly. If this page
  // only checked `status`, a VERIFIED coach with missing bio/sports would be
  // pushed to /coach/profile while the gate pushed them straight back here.
  const isVerificationDataComplete = useMemo(
    () => isCoachVerificationFlowComplete(coachProfile),
    [coachProfile]
  );
  const draftStorageKey = useMemo(() => getCoachVerificationDraftStorageKey(user?.id), [user?.id]);

  const isStep1Complete = useMemo(() => {
    return (
      Boolean(user?.photoUrl?.trim()) &&
      Boolean(bio.trim()) &&
      Boolean(mobileNumber.trim()) &&
      isValidMobileNumber(mobileNumber)
    );
  }, [user?.photoUrl, bio, mobileNumber]);

  const isStep2Complete = useMemo(() => {
    if (!isStep1Complete || selectedSports.length === 0) {
      return false;
    }

    if (pricingMode === "SAME") {
      const hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return false;
      }
    } else {
      for (const sport of selectedSports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          return false;
        }
      }
    }

    if (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") {
      if (!venueDetails.name.trim() || !venueDetails.address.trim() || !venueCoordinates) {
        return false;
      }
    }

    if (serviceMode !== "OWN_VENUE") {
      const serviceRadiusKm = Number(serviceRadiusKmInput || "10");
      const travelBufferTime = Number(travelBufferTimeInput || "30");

      if (
        !venueCoordinates ||
        !Number.isFinite(serviceRadiusKm) ||
        serviceRadiusKm <= 0 ||
        !Number.isFinite(travelBufferTime) ||
        travelBufferTime < 0
      ) {
        return false;
      }
    }

    return true;
  }, [
    isStep1Complete,
    selectedSports,
    pricingMode,
    hourlyRateInput,
    sportPricing,
    serviceMode,
    venueDetails.name,
    venueDetails.address,
    venueCoordinates,
    serviceRadiusKmInput,
    travelBufferTimeInput,
  ]);

  const serverProgressStep = useMemo<VerificationStep>(() => {
    const raw = Number(coachProfile?.onboardingProgressStep || 1);
    return raw === 2 || raw === 3 ? raw : 1;
  }, [coachProfile?.onboardingProgressStep]);

  const firstIncompleteStep: VerificationStep = useMemo(() => {
    if (!isStep1Complete) {
      return 1;
    }

    return isStep2Complete ? 3 : 2;
  }, [isStep1Complete, isStep2Complete]);

  const maxAccessibleStep: VerificationStep = useMemo(
    () => Math.max(firstIncompleteStep, serverProgressStep) as VerificationStep,
    [firstIncompleteStep, serverProgressStep]
  );

  // A verified coach whose bio/sports are missing is here to restore lost data,
  // not to re-submit. Their `onboardingProgressStep` still says 3, so resume
  // hints would drop them on the submission screen instead of the empty fields.
  const isRestoringVerifiedProfile = status === "VERIFIED" && !isVerificationDataComplete;

  const navigateToStep = useCallback(
    (nextStep: VerificationStep, showError = true) => {
      if (nextStep <= maxAccessibleStep) {
        setStep(nextStep);
        return;
      }

      setStep(maxAccessibleStep);
      if (showError) {
        toast.error("Complete required fields in previous steps first.");
      }
    },
    [maxAccessibleStep]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedStepParam = params.get("step");
    const nextRequestedStep: VerificationStep | null =
      requestedStepParam === "1" || requestedStepParam === "2" || requestedStepParam === "3"
        ? (Number(requestedStepParam) as VerificationStep)
        : null;

    setRequestedStep(nextRequestedStep);
    setIsEditModeFromProfile(params.get("edit") === "true");
  }, []);

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
      }
    );
  };

  // Redirect verified coaches to profile page — only once their profile data is
  // complete, otherwise the dashboard gate bounces them back here immediately.
  useEffect(() => {
    if (
      !loading &&
      status === "VERIFIED" &&
      isVerificationDataComplete &&
      !requestedStep &&
      !isEditModeFromProfile
    ) {
      router.push("/coach/profile");
    }
  }, [loading, status, isVerificationDataComplete, requestedStep, isEditModeFromProfile, router]);

  useEffect(() => {
    if (step > maxAccessibleStep) {
      setStep(maxAccessibleStep);
    }
  }, [step, maxAccessibleStep]);

  const loadProfile = async () => {
    try {
      const [coachResult, userResult] = await Promise.allSettled([
        coachApi.getMyProfile(),
        fetchProfile(),
      ]);

      if (userResult.status === "fulfilled") {
        const profile = userResult.value;
        if (profile) {
          setUser(profile);
          if (profile.phone) {
            setMobileNumber(profile.phone);
          }
        }
      }

      if (coachResult.status === "fulfilled") {
        const coachResponse = coachResult.value;
        if (!coachResponse.success || !coachResponse.data) {
          setCoachProfile(null);
          return;
        }

        const coach = coachResponse.data;
        setCoachProfile(coach);
        setBio(coach.bio || "");
        setSelectedSports(coach.sports || []);
        setHourlyRateInput(
          coach.hourlyRate && coach.hourlyRate > 0 ? String(coach.hourlyRate) : ""
        );

        // Load service mode
        if (coach.serviceMode) {
          setServiceMode(coach.serviceMode);
        }

        if (typeof coach.serviceRadiusKm === "number") {
          setServiceRadiusKmInput(String(coach.serviceRadiusKm));
        }

        if (typeof coach.travelBufferTime === "number") {
          setTravelBufferTimeInput(String(coach.travelBufferTime));
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
            images: venue.images || [],
            imageS3Keys: venue.imageS3Keys || [],
          });
          setAddressQuery(venue.address || "");
          // Load coordinates from location object
          if (venue.location?.coordinates) {
            setVenueCoordinates(venue.location.coordinates);
          }
        }

        if (!coach.ownVenueDetails && coach.baseLocation?.coordinates) {
          setVenueCoordinates(coach.baseLocation.coordinates);
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
        const pricingValues = Object.values((coach.sportPricing || {}) as Record<string, number>);
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
            }))
          );
        }
      } else {
        setCoachProfile(null);
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

  useEffect(() => {
    if (loading || hasHydratedDraftRef.current || isLockedByReview) {
      return;
    }

    if (!draftStorageKey) {
      hasHydratedDraftRef.current = true;
      return;
    }

    const draft = readCoachVerificationDraft(draftStorageKey);
    const serverResumeStep =
      serverProgressStep > 1 ? (serverProgressStep as VerificationStep) : null;

    if (draft) {
      const draftStep: VerificationStep =
        draft.step === 1 || draft.step === 2 || draft.step === 3 ? draft.step : 1;
      const resumeStep = Math.max(draftStep, serverProgressStep) as VerificationStep;

      setBio(draft.bio || "");
      setMobileNumber(draft.mobileNumber || "");
      setHourlyRateInput(draft.hourlyRateInput || "");
      setPricingMode(draft.pricingMode || "PER_SPORT");
      setSelectedSports(draft.selectedSports || []);
      setSportPricing(draft.sportPricing || {});
      setServiceMode(draft.serviceMode || getInitialServiceMode());
      setServiceRadiusKmInput(draft.serviceRadiusKmInput || "10");
      setTravelBufferTimeInput(draft.travelBufferTimeInput || "30");
      setVenueDetails(
        draft.venueDetails || {
          name: "",
          address: "",
          description: "",
          openingHours: getDefaultOpeningHours(),
          images: [],
          imageS3Keys: [],
        }
      );
      setAddressQuery(draft.venueDetails?.address || "");
      setVenueCoordinates(draft.venueCoordinates || null);
      setVerificationDocs(draft.verificationDocs || []);
      setResumeStepHint(resumeStep > 1 ? resumeStep : null);
      setShowResumeBanner(resumeStep > 1);
    } else {
      setResumeStepHint(serverResumeStep);
      setShowResumeBanner(Boolean(serverResumeStep));
    }

    hasHydratedDraftRef.current = true;
  }, [loading, draftStorageKey, isLockedByReview, serverProgressStep]);

  useEffect(() => {
    if (loading || !hasHydratedDraftRef.current || hasResolvedInitialStepRef.current) {
      return;
    }

    const fallbackStep = isRestoringVerifiedProfile
      ? firstIncompleteStep
      : (resumeStepHint ?? maxAccessibleStep);
    const requested = requestedStep ?? fallbackStep;
    const resolvedStep: VerificationStep =
      requested <= maxAccessibleStep ? requested : maxAccessibleStep;

    setStep(resolvedStep);

    if (requestedStep && requestedStep > maxAccessibleStep) {
      toast.error("Please complete previous required steps first.");
    }

    hasResolvedInitialStepRef.current = true;
  }, [
    loading,
    requestedStep,
    resumeStepHint,
    maxAccessibleStep,
    isRestoringVerifiedProfile,
    firstIncompleteStep,
  ]);

  useEffect(() => {
    if (loading || !hasHydratedDraftRef.current || isLockedByReview || !draftStorageKey) {
      return;
    }

    writeCoachVerificationDraft(draftStorageKey, {
      step,
      bio,
      mobileNumber,
      hourlyRateInput,
      pricingMode,
      selectedSports,
      sportPricing,
      serviceMode,
      serviceRadiusKmInput,
      travelBufferTimeInput,
      venueDetails,
      venueCoordinates,
      verificationDocs,
      updatedAt: new Date().toISOString(),
    });
  }, [
    loading,
    draftStorageKey,
    isLockedByReview,
    step,
    bio,
    mobileNumber,
    hourlyRateInput,
    pricingMode,
    selectedSports,
    sportPricing,
    serviceMode,
    serviceRadiusKmInput,
    travelBufferTimeInput,
    venueDetails,
    venueCoordinates,
    verificationDocs,
  ]);

  useEffect(() => {
    // Only drop the local draft once the flow is genuinely done. A VERIFIED
    // coach who is still missing bio/sports needs their in-progress work kept.
    if (isVerificationDataComplete) {
      clearCoachVerificationDraft(draftStorageKey);
    }
  }, [isVerificationDataComplete, draftStorageKey]);

  const handleUploadDocument = async (index: number, file: File) => {
    const validation = validateVerificationFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Invalid file");
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
            : doc
        )
      );
      toast.success(`${fileName} uploaded.`);
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploadingDocIndex(null);
    }
  };

  const handleUploadVenueImage = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Image exceeds 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    if (!ALLOWED_IMAGE_FILE_TYPES.includes(file.type)) {
      toast.error("Invalid image type. Upload JPG, PNG, or WebP only.");
      return;
    }

    setIsUploadingVenueImage(true);
    try {
      const uploadResponse = await coachApi.getVerificationUploadUrl({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        documentType: "OTHER",
        purpose: "VENUE_IMAGE",
      });

      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.message || "Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key } = uploadResponse.data;
      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadResult.ok) {
        throw new Error("Image upload failed. Please try again.");
      }

      setVenueDetails((prev) => ({
        ...prev,
        images: [...(prev.images || []), downloadUrl],
        imageS3Keys: [...(prev.imageS3Keys || []), key],
      }));
      toast.success("Venue image uploaded.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsUploadingVenueImage(false);
    }
  };

  const handleRemoveVenueImage = (index: number) => {
    setVenueDetails((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
      imageS3Keys: (prev.imageS3Keys || []).filter((_, i) => i !== index),
    }));
  };

  const handleVenueImageFile = (file?: File) => {
    if (!file) {
      return;
    }

    void handleUploadVenueImage(file);
  };

  const handleVenueImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingVenueImages(false);

    if (isLockedByReview || isUploadingVenueImage) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    handleVenueImageFile(file);
  };

  const handleStepOneContinue = () => {
    if (!user?.photoUrl?.trim()) {
      toast.error("Profile picture is required to continue.");
      return;
    }

    if (!bio.trim()) {
      toast.error("Bio is required to continue.");
      return;
    }

    if (!mobileNumber.trim()) {
      toast.error("Mobile number is required to continue.");
      return;
    }

    if (!isValidMobileNumber(mobileNumber)) {
      toast.error("Please provide a valid mobile number.");
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

        navigateToStep(2, false);
      } catch (saveError) {
        toast.error(saveError instanceof Error ? saveError.message : "Failed to save step 1");
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleStepTwoContinue = async () => {
    const sports = selectedSports;
    if (sports.length === 0) {
      toast.error("Please add at least one sport you can coach.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      const hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        toast.error("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
    }

    const hourlyRate = Math.min(...Object.values(pricingPayload));
    const serviceRadiusKm = Number(serviceRadiusKmInput || "10");
    const travelBufferTime = Number(travelBufferTimeInput || "30");

    if (serviceMode !== "OWN_VENUE") {
      if (!venueCoordinates) {
        toast.error("Please set your service base location.");
        return;
      }

      if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0) {
        toast.error("Please provide a valid service radius in km.");
        return;
      }

      if (!Number.isFinite(travelBufferTime) || travelBufferTime < 0) {
        toast.error("Please provide a valid travel buffer time.");
        return;
      }
    }

    // Validate venue details if needed
    if (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") {
      if (!venueDetails.name.trim()) {
        toast.error("Please provide a venue name.");
        return;
      }
      if (!venueDetails.address.trim()) {
        toast.error("Please provide a venue address.");
        return;
      }
      if (!venueCoordinates) {
        toast.error("Select a venue address from the suggestions or use your current location.");
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
        baseLocation?: {
          type: "Point";
          coordinates: [number, number];
        };
        serviceRadiusKm?: number;
        travelBufferTime?: number;
        ownVenueDetails?: {
          name: string;
          address: string;
          description: string;
          openingHours: string;
          images: string[];
          imageS3Keys: string[];
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
          images: venueDetails.images || [],
          imageS3Keys: venueDetails.imageS3Keys || [],
          ...(venueCoordinates && {
            location: {
              type: "Point",
              coordinates: venueCoordinates,
            },
          }),
        };
      }

      if (serviceMode !== "OWN_VENUE" && venueCoordinates) {
        payload.baseLocation = {
          type: "Point",
          coordinates: venueCoordinates,
        };
        payload.serviceRadiusKm = serviceRadiusKm;
        payload.travelBufferTime = travelBufferTime;
      }

      const step2Response = await coachApi.saveVerificationStep2(payload);

      if (!step2Response.success || !step2Response.data) {
        throw new Error(step2Response.message || "Failed to save step 2");
      }

      setCoachProfile(step2Response.data);
      localStorage.removeItem("coachServiceMode");

      // An already-verified coach who was only here to restore missing details
      // is done: step 2 keeps their VERIFIED status, so the gate unlocks and the
      // redirect effect takes them back to the dashboard. Sending them to step 3
      // would resubmit for review and un-verify them for no reason.
      if (
        getCoachVerificationStatus(step2Response.data) === "VERIFIED" &&
        isCoachVerificationFlowComplete(step2Response.data) &&
        !requestedStep &&
        !isEditModeFromProfile
      ) {
        clearCoachVerificationDraft(draftStorageKey);
        toast.success("Profile details restored. Taking you to your dashboard.");
        return;
      }

      navigateToStep(3, false);
      toast.success("Step 2 completed. Proceed to final submission.");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to save your profile details"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    const sports = selectedSports;
    let hourlyRate = 0;

    if (!bio.trim()) {
      toast.error("Bio is required.");
      return;
    }

    if (sports.length === 0) {
      toast.error("Please add at least one sport.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        toast.error("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
      hourlyRate = Math.min(...Object.values(pricingPayload));
    }

    const normalizedDocs = verificationDocs
      .filter((doc) => doc.url.trim() && doc.fileName.trim())
      .map((doc) => ({
        type: doc.type,
        url: doc.url.trim(),
        fileName: doc.fileName.trim(),
        s3Key: doc.s3Key,
        uploadedAt: doc.uploadedAt,
      }));

    setSaving(true);
    try {
      const step2SyncResponse = await coachApi.saveVerificationStep2({
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate,
        sportPricing: pricingPayload,
        serviceMode,
        ...(serviceMode === "OWN_VENUE" || serviceMode === "HYBRID"
          ? {
              ownVenueDetails: {
                name: venueDetails.name.trim(),
                address: venueDetails.address.trim(),
                description: venueDetails.description.trim(),
                openingHours: formatOpeningHoursToString(venueDetails.openingHours),
                images: venueDetails.images || [],
                imageS3Keys: venueDetails.imageS3Keys || [],
                ...(venueCoordinates
                  ? {
                      location: {
                        type: "Point" as const,
                        coordinates: venueCoordinates,
                      },
                    }
                  : {}),
              },
            }
          : {}),
        ...(serviceMode !== "OWN_VENUE" && venueCoordinates
          ? {
              baseLocation: {
                type: "Point" as const,
                coordinates: venueCoordinates,
              },
              serviceRadiusKm: Number(serviceRadiusKmInput || "10"),
              travelBufferTime: Number(travelBufferTimeInput || "30"),
            }
          : {}),
      });

      if (!step2SyncResponse.success || !step2SyncResponse.data) {
        throw new Error(step2SyncResponse.message || "Failed to sync profile");
      }

      setCoachProfile(step2SyncResponse.data);

      if (serviceMode === "OWN_VENUE") {
        const ownVenueImages = step2SyncResponse.data.ownVenueDetails?.images || [];
        if (ownVenueImages.length < 3) {
          toast.error("Upload at least 3 venue images before submitting verification.");
          return;
        }
      }

      const response = await coachApi.submitVerificationStep3({
        documents: normalizedDocs,
      });

      if (!response.success) {
        throw new Error(response.message || "Verification submission failed");
      }

      toast.success("Verification submitted. Your profile is now in review.");
      clearCoachVerificationDraft(draftStorageKey);
      await loadProfile();

      // Redirect to coach profile
      setTimeout(() => {
        router.push("/coach/profile");
      }, 2000);
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : "Failed to submit verification"
      );
    } finally {
      setSaving(false);
    }
  };

  const badge = getVerificationBadge(coachProfile);
  const guidance = getStatusGuidance(status, isVerificationDataComplete);
  const canShowResumeBanner = showResumeBanner && !isLockedByReview && !isRestoringVerifiedProfile;

  return {
    loading,
    saving,
    uploadingDocIndex,
    isUploadingVenueImage,
    isDraggingVenueImages,
    setIsDraggingVenueImages,
    coachProfile,
    user,
    setUser,
    step,
    bio,
    setBio,
    mobileNumber,
    setMobileNumber,
    hourlyRateInput,
    setHourlyRateInput,
    pricingMode,
    setPricingMode,
    selectedSports,
    setSelectedSports,
    sportPricing,
    setSportPricing,
    serviceMode,
    serviceRadiusKmInput,
    setServiceRadiusKmInput,
    travelBufferTimeInput,
    setTravelBufferTimeInput,
    venueDetails,
    setVenueDetails,
    addressQuery,
    addressSuggestions,
    isAddressSearching,
    addressSearchError,
    isGeocoding,
    venueImageInputRef,
    verificationDocs,
    setVerificationDocs,
    resumeStepHint,
    setShowResumeBanner,

    status,
    isLockedByReview,
    isVerificationDataComplete,
    isStep1Complete,
    isStep2Complete,
    maxAccessibleStep,
    badge,
    guidance,
    canShowResumeBanner,

    navigateToStep,
    handleAddressChange,
    handleSelectAddressSuggestion,
    handleUseCurrentLocation,
    handleUploadDocument,
    handleUploadVenueImage,
    handleRemoveVenueImage,
    handleVenueImageFile,
    handleVenueImageDrop,
    handleStepOneContinue,
    handleStepTwoContinue,
    handleSubmitVerification,
  };
}
