import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { OpeningHours } from "@/modules/onboarding/components/OpeningHoursInput";
import { CoachVerificationDocument, ServiceMode } from "@/types";
import {
  CreateCoachResponseData,
  emptyVenueHours,
  formatOpeningHoursToString,
  FormErrors,
  getApiConflictPayload,
  isValidMobileNumber,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOC_TYPES,
  PricingMode,
  sanitizeMobileNumber,
  Step,
  toCoachId,
  UploadedDocument,
  UploadedVenueImage,
} from "@/modules/admin/utils/coachOnboardingHelpers";

/**
 * All state, effects and handlers for the admin coach-onboarding form —
 * extracted so the component holds only composition and JSX. `handleSubmit`
 * in particular is unchanged: it creates a real coach account, uploads
 * documents/venue images, and activates verification, so this was a pure
 * relocation, not a rewrite.
 */
export function useCoachOnboardingFlow() {
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
  const [baseLocationSuggestions, setBaseLocationSuggestions] = useState<GeoSuggestion[]>([]);
  const [baseLocationSearching, setBaseLocationSearching] = useState(false);
  const [baseLocationError, setBaseLocationError] = useState("");
  const [baseLocation, setBaseLocation] = useState<[number, number] | null>(null);
  const baseLocationSkipRef = useRef(false);

  const [venueAddressQuery, setVenueAddressQuery] = useState("");
  const [venueAddressSuggestions, setVenueAddressSuggestions] = useState<GeoSuggestion[]>([]);
  const [venueAddressSearching, setVenueAddressSearching] = useState(false);
  const [venueAddressError, setVenueAddressError] = useState("");
  const [venueLocation, setVenueLocation] = useState<[number, number] | null>(null);
  const venueLocationSkipRef = useRef(false);

  const [venueName, setVenueName] = useState("");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueOpeningHours, setVenueOpeningHours] = useState<OpeningHours>(emptyVenueHours());
  const [venueImageDrafts, setVenueImageDrafts] = useState<UploadedVenueImage[]>([]);
  const venueImageInputRef = useRef<HTMLInputElement | null>(null);
  const venueImagePreviewUrlsRef = useRef<string[]>([]);

  const [verificationDocs, setVerificationDocs] = useState<UploadedDocument[]>([]);

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
    if (lastName.trim().length < 2) nextErrors.lastName = "Last name must be at least 2 characters";
    if (!email.trim()) nextErrors.email = "Email is required";
    if (!phone.trim()) nextErrors.phone = "Phone is required";
    if (!bio.trim()) nextErrors.bio = "Bio is required";
    if (bio.trim().length < 20) nextErrors.bio = "Bio must be at least 20 characters";
    if (!isValidMobileNumber(phone)) nextErrors.phone = "Please provide a valid phone number";

    if (!profilePhotoUrl.trim()) {
      nextErrors.profilePhoto = "Profile photo is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = () => {
    const nextErrors: FormErrors = {};

    if (sports.length === 0) nextErrors.sports = "At least one sport is required";

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
        nextErrors.baseLocation = "Base location is required for this service mode";
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
      if (!venueAddressQuery.trim()) nextErrors.venueAddress = "Venue address is required";
      if (!venueLocation) nextErrors.venueAddress = "Select a venue location from suggestions";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep3 = () => {
    const nextErrors: FormErrors = {};

    if (isOwnVenue && venueImageDrafts.length < 3) {
      nextErrors.venueImages = "OWN_VENUE coaches require at least 3 venue images";
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
        toast.error(`Invalid image type for ${file.name}. Use JPG, PNG, or WebP.`);
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
      toast.error(`Invalid file type for ${file.name}. Use JPG, PNG, WebP or PDF.`);
      return;
    }

    setVerificationDocs((prev) =>
      prev.map((doc, currentIndex) =>
        currentIndex === index ? { ...doc, file, fileName: file.name } : doc
      )
    );
  };

  const addDocumentRow = () => {
    setVerificationDocs((prev) => [...prev, { type: "CERTIFICATION", file: null, fileName: "" }]);
  };

  const removeDocumentRow = (index: number) => {
    setVerificationDocs((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const removeVenueImage = (index: number) => {
    setVenueImageDrafts((prev) =>
      prev.filter((image, currentIndex) => {
        if (currentIndex === index) {
          URL.revokeObjectURL(image.previewUrl);
          venueImagePreviewUrlsRef.current = venueImagePreviewUrlsRef.current.filter(
            (previewUrl) => previewUrl !== image.previewUrl
          );
          return false;
        }

        return true;
      })
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
    }>
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
        item.file.type || "application/octet-stream"
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
            data.message || "An account already exists. Convert it to a coach account to continue?"
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
      const uploadedVenueImages = venueFiles.length ? await uploadFiles(coachId, venueFiles) : [];

      if (uploadedVenueImages.length > 0 && isOwnVenue) {
        const responseData = createResponse.data as CreateCoachResponseData;
        const existingOwnVenue =
          responseData.coach?.ownVenueDetails || responseData.data?.coach?.ownVenueDetails || {};
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
      toast.error(error instanceof Error ? error.message : "Failed to create coach");
    } finally {
      setCreating(false);
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    loading,
    creating,
    successCoachId,
    successCoachLink,
    errors,
    setErrors,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    phone,
    setPhone,
    bio,
    setBio,
    profilePhotoUrl,
    setProfilePhotoUrl,
    profilePhotoKey,
    setProfilePhotoKey,

    sports,
    setSports,
    pricingMode,
    setPricingMode,
    hourlyRateInput,
    setHourlyRateInput,
    sportPricing,
    setSportPricing,
    serviceMode,
    setServiceMode,
    serviceRadiusKmInput,
    setServiceRadiusKmInput,
    travelBufferTimeInput,
    setTravelBufferTimeInput,

    baseLocationQuery,
    setBaseLocationQuery,
    baseLocationSuggestions,
    baseLocationSearching,
    baseLocationError,
    setBaseLocation,
    setBaseLocationError,
    handleSelectBaseLocation,

    venueAddressQuery,
    setVenueAddressQuery,
    venueAddressSuggestions,
    venueAddressSearching,
    venueAddressError,
    setVenueLocation,
    setVenueAddressError,
    handleSelectVenueLocation,

    venueName,
    setVenueName,
    venueDescription,
    setVenueDescription,
    venueOpeningHours,
    setVenueOpeningHours,
    venueImageDrafts,
    venueImageInputRef,
    handleVenueImageSelect,
    removeVenueImage,

    verificationDocs,
    setVerificationDocs,
    handleDocumentSelect,
    addDocumentRow,
    removeDocumentRow,

    isOwnVenue,
    needsBaseLocation,

    handleContinueFromStep1,
    handleContinueFromStep2,
    handleSubmit,
  };
}
