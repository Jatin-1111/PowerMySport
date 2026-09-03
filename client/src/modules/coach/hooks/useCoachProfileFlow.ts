import { toast } from "@/lib/toast";
import { useFetchProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import {
  ALLOWED_VENUE_IMAGE_TYPES,
  GST_REGEX,
  MAX_VENUE_IMAGE_SIZE,
  getCoachProfileBadge,
  getCoachProfileStatusGuidance,
  isSameAvailabilityBySport,
  normalizeSports,
  sortAvailabilitySlots,
  validateAvailabilityBySport,
} from "@/modules/coach/utils/profileFlow";
import { Booking, Coach, IAvailability, ServiceMode, User } from "@/types";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";

/**
 * All state, effects and handlers for the coach profile page — extracted
 * so the route file holds only routing and composition. No logic changed,
 * only where it lives.
 */
export function useCoachProfileFlow() {
  const router = useRouter();
  // Shared cached profile fetch (one entry across all consumers).
  const fetchAuthProfile = useFetchProfile();
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeSportTab, setActiveSportTab] = useState("");
  const [availabilityBySport, setAvailabilityBySport] = useState<Record<string, IAvailability[]>>(
    {}
  );
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [aboutForm, setAboutForm] = useState({
    bio: "",
  });
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [isSavingTax, setIsSavingTax] = useState(false);
  const [taxForm, setTaxForm] = useState({
    gstNumber: "",
  });
  const [isEditingCoaching, setIsEditingCoaching] = useState(false);
  const [isSavingCoaching, setIsSavingCoaching] = useState(false);
  const [selectedVenueImage, setSelectedVenueImage] = useState<string | null>(null);
  const [isEditingVenueImages, setIsEditingVenueImages] = useState(false);
  const [isUploadingVenueImages, setIsUploadingVenueImages] = useState(false);
  const [isSavingVenueImages, setIsSavingVenueImages] = useState(false);
  const [venueImageDraft, setVenueImageDraft] = useState<{
    images: string[];
    imageS3Keys: string[];
  }>({
    images: [],
    imageS3Keys: [],
  });
  const venueImageInputRef = useRef<HTMLInputElement | null>(null);
  const [coachingForm, setCoachingForm] = useState({
    selectedSports: [] as string[],
    pricingMode: "PER_SPORT" as "SAME" | "PER_SPORT",
    hourlyRateInput: "",
    sportPricing: {} as Record<string, string>,
    serviceMode: "FREELANCE" as ServiceMode,
    serviceRadiusKmInput: "10",
    travelBufferTimeInput: "30",
  });
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [checkedInBooking, setCheckedInBooking] = useState<Booking | null>(null);

  const loadUser = async () => {
    try {
      // Shared cache: one profile entry across every consumer.
      await fetchAuthProfile();
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await coachApi.getMyProfile();
      if (response.success && response.data) {
        const sports = response.data.sports || [];
        const bySportFromApi = response.data.availabilityBySport || {};
        const fallbackAvailability = sortAvailabilitySlots(response.data.availability || []);
        const nextBySport: Record<string, IAvailability[]> = {};

        sports.forEach((sport) => {
          nextBySport[sport] = sortAvailabilitySlots(bySportFromApi[sport] || fallbackAvailability);
        });

        setCoachProfile(response.data);
        setAvailabilityBySport(nextBySport);
        if (sports.length > 0) {
          setActiveSportTab(sports[0]);
        }
      }
    } catch {
      console.log("No coach profile yet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCoachCheckIn = async () => {
    const normalizedCode = checkInCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckInMessage("Please enter a check-in code.");
      return;
    }

    if (normalizedCode.length !== 8) {
      setCheckInMessage("Enter the full 8-character check-in code.");
      return;
    }

    try {
      setCheckInLoading(true);
      setCheckInMessage(null);
      setCheckedInBooking(null);

      const response = await bookingApi.checkInBookingByCode(normalizedCode);

      if (response.success && response.data) {
        setCheckedInBooking(response.data);
        setCheckInMessage("Check-in confirmed. Session is now IN_PROGRESS.");
        setCheckInCode("");
        return;
      }

      setCheckInMessage(response.message || "Unable to verify check-in code.");
    } catch (error: any) {
      setCheckInMessage(error?.response?.data?.message || "Unable to verify check-in code.");
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleEditProfileClick = () => {
    if (!user) return;
    setProfileForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    const nextName = profileForm.name.trim();
    const nextEmail = profileForm.email.trim();
    const nextPhone = profileForm.phone.trim();

    if (
      nextName === (user?.name || "") &&
      nextEmail === (user?.email || "") &&
      nextPhone === (user?.phone || "")
    ) {
      toast.info("No profile changes to save.");
      setIsEditingProfile(false);
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await authApi.updateProfile({
        name: nextName,
        email: nextEmail,
        phone: nextPhone,
      });
      if (response.success && response.data) {
        setUser(response.data);
        setIsEditingProfile(false);
        toast.success("Profile updated successfully.");
      } else {
        throw new Error(response.message || "Failed to update profile");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEditAboutClick = () => {
    if (!coachProfile) return;
    setAboutForm({
      bio: coachProfile.bio || "",
    });
    setIsEditingAbout(true);
  };

  const handleSaveAbout = async () => {
    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      toast.error("Coach profile id is missing.");
      return;
    }

    const nextBio = aboutForm.bio.trim();
    if (!nextBio) {
      toast.error("Bio cannot be empty.");
      return;
    }

    if (nextBio === (coachProfile.bio || "")) {
      toast.info("No About changes to save.");
      setIsEditingAbout(false);
      return;
    }

    try {
      setIsSavingAbout(true);
      const response = await coachApi.updateProfile(coachId, { bio: nextBio });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update about section");
      }

      setCoachProfile(response.data);
      setIsEditingAbout(false);
      toast.success("About section updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update about section");
    } finally {
      setIsSavingAbout(false);
    }
  };

  const handleEditTaxClick = () => {
    if (!coachProfile) return;
    setTaxForm({
      gstNumber: coachProfile.gstNumber || "",
    });
    setIsEditingTax(true);
  };

  const handleSaveTax = async () => {
    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      toast.error("Coach profile id is missing.");
      return;
    }

    const nextGst = taxForm.gstNumber.trim().toUpperCase();
    if (nextGst && !GST_REGEX.test(nextGst)) {
      toast.error("Enter a valid GST number, or leave it blank.");
      return;
    }

    if (nextGst === (coachProfile.gstNumber || "")) {
      toast.info("No tax detail changes to save.");
      setIsEditingTax(false);
      return;
    }

    try {
      setIsSavingTax(true);
      const response = await coachApi.updateProfile(coachId, {
        gstNumber: nextGst,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update tax details");
      }

      setCoachProfile(response.data);
      setIsEditingTax(false);
      toast.success("Tax details updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tax details");
    } finally {
      setIsSavingTax(false);
    }
  };

  const handleEditCoachingClick = () => {
    if (!coachProfile) return;

    const sports = coachProfile.sports || [];
    const pricingValues = Object.values(
      (coachProfile.sportPricing || {}) as Record<string, number>
    );
    const hasPerSport = pricingValues.some((value) => value > 0);
    const allMatchHourly =
      hasPerSport &&
      typeof coachProfile.hourlyRate === "number" &&
      pricingValues.every((value) => value === coachProfile.hourlyRate);

    const nextSportPricing = sports.reduce<Record<string, string>>((acc, sport) => {
      const existingPrice = coachProfile.sportPricing?.[sport];
      if (typeof existingPrice === "number" && existingPrice > 0) {
        acc[sport] = String(existingPrice);
      } else if (typeof coachProfile.hourlyRate === "number" && coachProfile.hourlyRate > 0) {
        acc[sport] = String(coachProfile.hourlyRate);
      } else {
        acc[sport] = "";
      }
      return acc;
    }, {});

    setCoachingForm({
      selectedSports: sports,
      pricingMode: allMatchHourly ? "SAME" : "PER_SPORT",
      hourlyRateInput:
        typeof coachProfile.hourlyRate === "number" && coachProfile.hourlyRate > 0
          ? String(coachProfile.hourlyRate)
          : "",
      sportPricing: nextSportPricing,
      serviceMode: coachProfile.serviceMode || "FREELANCE",
      serviceRadiusKmInput: String(coachProfile.serviceRadiusKm || 10),
      travelBufferTimeInput: String(coachProfile.travelBufferTime || 30),
    });
    setIsEditingCoaching(true);
  };

  const handleEditVenueImagesClick = () => {
    if (!coachProfile?.ownVenueDetails) {
      toast.error("Venue details not found.");
      return;
    }

    setVenueImageDraft({
      images: coachProfile.ownVenueDetails.images || [],
      imageS3Keys: coachProfile.ownVenueDetails.imageS3Keys || [],
    });
    setIsEditingVenueImages(true);
  };

  const handleCancelVenueImagesEdit = () => {
    setIsEditingVenueImages(false);
    setVenueImageDraft({
      images: coachProfile?.ownVenueDetails?.images || [],
      imageS3Keys: coachProfile?.ownVenueDetails?.imageS3Keys || [],
    });
  };

  const handleRemoveVenueImage = (index: number) => {
    setVenueImageDraft((prev) => ({
      images: prev.images.filter((_, currentIndex) => currentIndex !== index),
      imageS3Keys: prev.imageS3Keys.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleVenueImagesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    setIsUploadingVenueImages(true);
    try {
      const uploadedImages: Array<{ imageUrl: string; key: string }> = [];

      for (const file of files) {
        if (file.size > MAX_VENUE_IMAGE_SIZE) {
          throw new Error(`${file.name} exceeds 5MB. Please upload a smaller image.`);
        }

        if (!ALLOWED_VENUE_IMAGE_TYPES.includes(file.type)) {
          throw new Error(`${file.name} is not supported. Upload JPG, PNG, or WebP only.`);
        }

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
          throw new Error(`Failed to upload ${file.name}. Please try again.`);
        }

        uploadedImages.push({ imageUrl: downloadUrl, key });
      }

      setVenueImageDraft((prev) => ({
        images: [...prev.images, ...uploadedImages.map((item) => item.imageUrl)],
        imageS3Keys: [...prev.imageS3Keys, ...uploadedImages.map((item) => item.key)],
      }));

      toast.success("Venue images uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload venue images");
    } finally {
      setIsUploadingVenueImages(false);
    }
  };

  const handleSaveVenueImages = async () => {
    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      toast.error("Coach profile id is missing.");
      return;
    }

    const existingImages = coachProfile.ownVenueDetails?.images || [];
    const existingKeys = coachProfile.ownVenueDetails?.imageS3Keys || [];
    if (
      JSON.stringify(existingImages) === JSON.stringify(venueImageDraft.images) &&
      JSON.stringify(existingKeys) === JSON.stringify(venueImageDraft.imageS3Keys)
    ) {
      toast.info("No venue image changes to save.");
      setIsEditingVenueImages(false);
      return;
    }

    if (!coachProfile.ownVenueDetails) {
      toast.error("Venue details not found.");
      return;
    }

    try {
      setIsSavingVenueImages(true);
      const response = await coachApi.updateProfile(coachId, {
        ownVenueDetails: {
          ...coachProfile.ownVenueDetails,
          images: venueImageDraft.images,
          imageS3Keys: venueImageDraft.imageS3Keys,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update venue images");
      }

      setCoachProfile(response.data);
      setVenueImageDraft({
        images: response.data.ownVenueDetails?.images || [],
        imageS3Keys: response.data.ownVenueDetails?.imageS3Keys || [],
      });
      setIsEditingVenueImages(false);
      toast.success("Venue images updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update venue images");
    } finally {
      setIsSavingVenueImages(false);
    }
  };

  const handleSaveCoachingDetails = async () => {
    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      toast.error("Coach profile id is missing.");
      return;
    }

    const nextSports = normalizeSports(coachingForm.selectedSports);
    if (nextSports.length === 0) {
      toast.error("Add at least one sport.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (coachingForm.pricingMode === "SAME") {
      const hourlyRate = Number(coachingForm.hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        toast.error("Please add a valid hourly price greater than 0.");
        return;
      }

      for (const sport of nextSports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of nextSports) {
        const value = Number(coachingForm.sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
    }

    const hourlyRate = Math.min(...Object.values(pricingPayload));

    const parsedServiceRadius = Number(coachingForm.serviceRadiusKmInput);
    const parsedTravelBuffer = Number(coachingForm.travelBufferTimeInput);

    if (
      coachingForm.serviceMode !== "OWN_VENUE" &&
      (!Number.isFinite(parsedServiceRadius) || parsedServiceRadius <= 0)
    ) {
      toast.error("Service radius must be greater than 0.");
      return;
    }

    if (
      coachingForm.serviceMode !== "OWN_VENUE" &&
      (!Number.isFinite(parsedTravelBuffer) || parsedTravelBuffer < 0)
    ) {
      toast.error("Travel buffer time must be 0 or more.");
      return;
    }

    const currentSports = normalizeSports(coachProfile.sports || []);
    const currentHourlyRate = Number(coachProfile.hourlyRate || 0);
    const currentServiceMode = coachProfile.serviceMode || "FREELANCE";
    const currentServiceRadius = Number(coachProfile.serviceRadiusKm || 10);
    const currentTravelBuffer = Number(coachProfile.travelBufferTime || 30);

    const normalizePricing = (pricing: Record<string, number>) =>
      Object.keys(pricing)
        .sort()
        .reduce<Record<string, number>>((acc, sport) => {
          acc[sport] = pricing[sport];
          return acc;
        }, {});

    const currentPricing = normalizePricing(
      (coachProfile.sportPricing || {}) as Record<string, number>
    );
    const nextPricing = normalizePricing(pricingPayload);

    const hasSportsChange = JSON.stringify(currentSports) !== JSON.stringify(nextSports);
    const hasHourlyRateChange = currentHourlyRate !== hourlyRate;
    const hasServiceModeChange = currentServiceMode !== coachingForm.serviceMode;
    const hasServiceRadiusChange =
      coachingForm.serviceMode !== "OWN_VENUE" && currentServiceRadius !== parsedServiceRadius;
    const hasTravelBufferChange =
      coachingForm.serviceMode !== "OWN_VENUE" && currentTravelBuffer !== parsedTravelBuffer;
    const hasSportPricingChange = JSON.stringify(currentPricing) !== JSON.stringify(nextPricing);

    if (
      !hasSportsChange &&
      !hasHourlyRateChange &&
      !hasServiceModeChange &&
      !hasServiceRadiusChange &&
      !hasTravelBufferChange &&
      !hasSportPricingChange
    ) {
      toast.info("No coaching detail changes to save.");
      setIsEditingCoaching(false);
      return;
    }

    const updates: Partial<Coach> = {
      sports: nextSports,
      hourlyRate,
      serviceMode: coachingForm.serviceMode,
      sportPricing: pricingPayload,
    };

    if (coachingForm.serviceMode !== "OWN_VENUE") {
      updates.serviceRadiusKm = parsedServiceRadius;
      updates.travelBufferTime = parsedTravelBuffer;
    }

    try {
      setIsSavingCoaching(true);
      const response = await coachApi.updateProfile(coachId, updates);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update coaching details");
      }

      setCoachProfile(response.data);
      const sports = response.data.sports || [];
      const bySportFromApi = response.data.availabilityBySport || {};
      const fallbackAvailability = sortAvailabilitySlots(response.data.availability || []);
      const nextBySport: Record<string, IAvailability[]> = {};

      sports.forEach((sport) => {
        nextBySport[sport] = sortAvailabilitySlots(bySportFromApi[sport] || fallbackAvailability);
      });

      setAvailabilityBySport(nextBySport);
      if (sports.length > 0 && !sports.includes(activeSportTab)) {
        setActiveSportTab(sports[0]);
      }

      setIsEditingCoaching(false);
      toast.success("Coaching details updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update coaching details");
    } finally {
      setIsSavingCoaching(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      logout();
      router.push("/");
    }
  };

  const addTimeSlot = () => {
    if (!activeSportTab) {
      return;
    }

    setAvailabilityBySport((prev) => ({
      ...prev,
      [activeSportTab]: [
        ...(prev[activeSportTab] || []),
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
      ],
    }));
  };

  const removeTimeSlot = (index: number) => {
    if (!activeSportTab) {
      return;
    }

    setAvailabilityBySport((prev) => ({
      ...prev,
      [activeSportTab]: (prev[activeSportTab] || []).filter((_, i) => i !== index),
    }));
  };

  const updateTimeSlot = (index: number, key: keyof IAvailability, value: number | string) => {
    if (!activeSportTab) {
      return;
    }

    setAvailabilityBySport((prev) => ({
      ...prev,
      [activeSportTab]: (prev[activeSportTab] || []).map((slot, i) =>
        i === index ? { ...slot, [key]: value } : slot
      ),
    }));
  };

  const handleSaveAvailability = async () => {
    if (!coachProfile) {
      toast.error("Coach profile not found.");
      return;
    }

    const validationError = validateAvailabilityBySport(availabilityBySport);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSavingAvailability(true);

      const sortedAvailabilityBySport: Record<string, IAvailability[]> = {};
      Object.entries(availabilityBySport).forEach(([sport, slots]) => {
        sortedAvailabilityBySport[sport] = sortAvailabilitySlots(slots);
      });

      const currentBySportFromCoach = coachProfile.availabilityBySport || {};
      const currentBySport: Record<string, IAvailability[]> = {};

      Object.entries(currentBySportFromCoach).forEach(([sport, slots]) => {
        currentBySport[sport] = sortAvailabilitySlots(slots || []);
      });

      if (isSameAvailabilityBySport(sortedAvailabilityBySport, currentBySport)) {
        toast.info("No time slot changes to save.");
        return;
      }

      const response = await coachApi.updateMyAvailability({
        availabilityBySport: sortedAvailabilityBySport,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to save availability");
      }

      setCoachProfile(response.data);
      const sports = response.data.sports || [];
      const bySportFromApi = response.data.availabilityBySport || {};
      const fallbackAvailability = sortAvailabilitySlots(response.data.availability || []);
      const nextBySport: Record<string, IAvailability[]> = {};

      sports.forEach((sport) => {
        nextBySport[sport] = sortAvailabilitySlots(bySportFromApi[sport] || fallbackAvailability);
      });

      setAvailabilityBySport(nextBySport);
      if (sports.length > 0 && !sports.includes(activeSportTab)) {
        setActiveSportTab(sports[0]);
      }
      toast.success("Time slots updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save time slots");
    } finally {
      setSavingAvailability(false);
    }
  };

  const badge = getCoachProfileBadge(coachProfile);
  const status =
    coachProfile?.verificationStatus || (coachProfile?.isVerified ? "VERIFIED" : "UNVERIFIED");
  const guidance = getCoachProfileStatusGuidance(status);
  const sportsCount = coachProfile?.sports?.length || 0;
  const pricingValues = coachProfile?.sportPricing ? Object.values(coachProfile.sportPricing) : [];
  const basePrice =
    pricingValues.length > 0 ? Math.min(...pricingValues) : (coachProfile?.hourlyRate ?? 0);
  const totalSlots =
    coachProfile?.availabilityBySport && Object.keys(coachProfile.availabilityBySport).length > 0
      ? Object.values(coachProfile.availabilityBySport).reduce(
          (count, slots) => count + (slots?.length || 0),
          0
        )
      : (coachProfile?.availability?.length ?? 0);

  return {
    loading,
    coachProfile,
    user,
    setUser,
    activeSportTab,
    setActiveSportTab,
    availabilityBySport,
    savingAvailability,

    isEditingProfile,
    isSavingProfile,
    profileForm,
    setProfileForm,
    handleEditProfileClick,
    handleCancelEdit,
    handleSaveProfile,

    isEditingAbout,
    setIsEditingAbout,
    isSavingAbout,
    aboutForm,
    setAboutForm,
    handleEditAboutClick,
    handleSaveAbout,

    isEditingTax,
    setIsEditingTax,
    isSavingTax,
    taxForm,
    setTaxForm,
    handleEditTaxClick,
    handleSaveTax,

    isEditingCoaching,
    setIsEditingCoaching,
    isSavingCoaching,
    coachingForm,
    setCoachingForm,
    handleEditCoachingClick,
    handleSaveCoachingDetails,

    selectedVenueImage,
    setSelectedVenueImage,
    isEditingVenueImages,
    isUploadingVenueImages,
    isSavingVenueImages,
    venueImageDraft,
    venueImageInputRef,
    handleEditVenueImagesClick,
    handleCancelVenueImagesEdit,
    handleRemoveVenueImage,
    handleVenueImagesSelected,
    handleSaveVenueImages,

    checkInCode,
    setCheckInCode,
    checkInLoading,
    checkInMessage,
    checkedInBooking,
    handleCoachCheckIn,

    addTimeSlot,
    removeTimeSlot,
    updateTimeSlot,
    handleSaveAvailability,

    handleLogout,

    badge,
    status,
    guidance,
    sportsCount,
    basePrice,
    totalSlots,
  };
}
