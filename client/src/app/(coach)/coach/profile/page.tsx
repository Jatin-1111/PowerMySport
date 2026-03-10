"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { coachApi } from "@/modules/coach/services/coach";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, IAvailability, ServiceMode, User } from "@/types";
import {
  AlertCircle,
  CheckCircle,
  Clock3,
  LogOut,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const sortAvailabilitySlots = (slots: IAvailability[]) =>
  [...slots].sort((first, second) => {
    if (first.dayOfWeek !== second.dayOfWeek) {
      return first.dayOfWeek - second.dayOfWeek;
    }
    if (first.startTime !== second.startTime) {
      return first.startTime.localeCompare(second.startTime);
    }
    return first.endTime.localeCompare(second.endTime);
  });

const normalizeSports = (sports: string[]) =>
  [...new Set(sports.map((sport) => sport.trim()).filter(Boolean))].sort();

const normalizeAvailabilityBySport = (
  bySport: Record<string, IAvailability[]>,
) => {
  const normalized: Record<string, IAvailability[]> = {};

  Object.entries(bySport).forEach(([sport, slots]) => {
    normalized[sport] = sortAvailabilitySlots(slots).map((slot) => ({
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  });

  return normalized;
};

const isSameAvailabilityBySport = (
  first: Record<string, IAvailability[]>,
  second: Record<string, IAvailability[]>,
) =>
  JSON.stringify(normalizeAvailabilityBySport(first)) ===
  JSON.stringify(normalizeAvailabilityBySport(second));

export default function CoachProfilePage() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeSportTab, setActiveSportTab] = useState("");
  const [availabilityBySport, setAvailabilityBySport] = useState<
    Record<string, IAvailability[]>
  >({});
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
  const [isEditingCoaching, setIsEditingCoaching] = useState(false);
  const [isSavingCoaching, setIsSavingCoaching] = useState(false);
  const [selectedVenueImage, setSelectedVenueImage] = useState<string | null>(
    null,
  );
  const [coachingForm, setCoachingForm] = useState({
    selectedSports: [] as string[],
    pricingMode: "PER_SPORT" as "SAME" | "PER_SPORT",
    hourlyRateInput: "",
    sportPricing: {} as Record<string, string>,
    serviceMode: "FREELANCE" as ServiceMode,
    serviceRadiusKmInput: "10",
    travelBufferTimeInput: "30",
  });

  useEffect(() => {
    loadProfile();
    loadUser();
  }, []);

  const getVerificationBadge = (coachData: Coach | null) => {
    if (!coachData) {
      return {
        label: "Not Started",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
        icon: AlertCircle,
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
          icon: CheckCircle,
        };
      case "PENDING":
        return {
          label: "Pending Review",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
          icon: AlertCircle,
        };
      case "REVIEW":
        return {
          label: "In Review",
          className: "bg-blue-100 text-blue-700 border border-blue-200",
          icon: AlertCircle,
        };
      case "REJECTED":
        return {
          label: "Rejected",
          className: "bg-red-100 text-red-700 border border-red-200",
          icon: AlertCircle,
        };
      default:
        return {
          label: "Not Started",
          className: "bg-slate-100 text-slate-700 border border-slate-200",
          icon: AlertCircle,
        };
    }
  };

  const getStatusGuidance = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Your verification is submitted and pending review. You'll be notified once reviewed.";
      case "REVIEW":
        return "Your verification is currently under review. Edits are temporarily disabled.";
      case "VERIFIED":
        return "You are verified and your profile is visible to players.";
      case "REJECTED":
        return "Your verification was rejected. Update your profile details here and submit required verification updates when prompted.";
      default:
        return "Get started with our 3-step verification process to become a verified coach.";
    }
  };

  const loadUser = async () => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update about section",
      );
    } finally {
      setIsSavingAbout(false);
    }
  };

  const handleEditCoachingClick = () => {
    if (!coachProfile) return;

    const sports = coachProfile.sports || [];
    const pricingValues = Object.values(
      (coachProfile.sportPricing || {}) as Record<string, number>,
    );
    const hasPerSport = pricingValues.some((value) => value > 0);
    const allMatchHourly =
      hasPerSport &&
      typeof coachProfile.hourlyRate === "number" &&
      pricingValues.every((value) => value === coachProfile.hourlyRate);

    const nextSportPricing = sports.reduce<Record<string, string>>(
      (acc, sport) => {
        const existingPrice = coachProfile.sportPricing?.[sport];
        if (typeof existingPrice === "number" && existingPrice > 0) {
          acc[sport] = String(existingPrice);
        } else if (
          typeof coachProfile.hourlyRate === "number" &&
          coachProfile.hourlyRate > 0
        ) {
          acc[sport] = String(coachProfile.hourlyRate);
        } else {
          acc[sport] = "";
        }
        return acc;
      },
      {},
    );

    setCoachingForm({
      selectedSports: sports,
      pricingMode: allMatchHourly ? "SAME" : "PER_SPORT",
      hourlyRateInput:
        typeof coachProfile.hourlyRate === "number" &&
        coachProfile.hourlyRate > 0
          ? String(coachProfile.hourlyRate)
          : "",
      sportPricing: nextSportPricing,
      serviceMode: coachProfile.serviceMode || "FREELANCE",
      serviceRadiusKmInput: String(coachProfile.serviceRadiusKm || 10),
      travelBufferTimeInput: String(coachProfile.travelBufferTime || 30),
    });
    setIsEditingCoaching(true);
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

    const hourlyRate = Math.max(...Object.values(pricingPayload));

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
      (coachProfile.sportPricing || {}) as Record<string, number>,
    );
    const nextPricing = normalizePricing(pricingPayload);

    const hasSportsChange =
      JSON.stringify(currentSports) !== JSON.stringify(nextSports);
    const hasHourlyRateChange = currentHourlyRate !== hourlyRate;
    const hasServiceModeChange =
      currentServiceMode !== coachingForm.serviceMode;
    const hasServiceRadiusChange =
      coachingForm.serviceMode !== "OWN_VENUE" &&
      currentServiceRadius !== parsedServiceRadius;
    const hasTravelBufferChange =
      coachingForm.serviceMode !== "OWN_VENUE" &&
      currentTravelBuffer !== parsedTravelBuffer;
    const hasSportPricingChange =
      JSON.stringify(currentPricing) !== JSON.stringify(nextPricing);

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
        throw new Error(
          response.message || "Failed to update coaching details",
        );
      }

      setCoachProfile(response.data);
      const sports = response.data.sports || [];
      const bySportFromApi = response.data.availabilityBySport || {};
      const fallbackAvailability = sortAvailabilitySlots(
        response.data.availability || [],
      );
      const nextBySport: Record<string, IAvailability[]> = {};

      sports.forEach((sport) => {
        nextBySport[sport] = sortAvailabilitySlots(
          bySportFromApi[sport] || fallbackAvailability,
        );
      });

      setAvailabilityBySport(nextBySport);
      if (sports.length > 0 && !sports.includes(activeSportTab)) {
        setActiveSportTab(sports[0]);
      }

      setIsEditingCoaching(false);
      toast.success("Coaching details updated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update coaching details",
      );
    } finally {
      setIsSavingCoaching(false);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await coachApi.getMyProfile();
      if (response.success && response.data) {
        const sports = response.data.sports || [];
        const bySportFromApi = response.data.availabilityBySport || {};
        const fallbackAvailability = sortAvailabilitySlots(
          response.data.availability || [],
        );
        const nextBySport: Record<string, IAvailability[]> = {};

        sports.forEach((sport) => {
          nextBySport[sport] = sortAvailabilitySlots(
            bySportFromApi[sport] || fallbackAvailability,
          );
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
      [activeSportTab]: (prev[activeSportTab] || []).filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const updateTimeSlot = (
    index: number,
    key: keyof IAvailability,
    value: number | string,
  ) => {
    if (!activeSportTab) {
      return;
    }

    setAvailabilityBySport((prev) => ({
      ...prev,
      [activeSportTab]: (prev[activeSportTab] || []).map((slot, i) =>
        i === index ? { ...slot, [key]: value } : slot,
      ),
    }));
  };

  const validateAvailabilityBySport = (
    bySport: Record<string, IAvailability[]>,
  ) => {
    for (const [sport, slots] of Object.entries(bySport)) {
      for (const slot of slots) {
        if (!slot.startTime || !slot.endTime) {
          return `Each time slot in ${sport} must include start and end time.`;
        }
        if (slot.startTime >= slot.endTime) {
          return `End time must be later than start time in ${sport}.`;
        }
      }
    }
    return "";
  };

  const flattenAvailability = (bySport: Record<string, IAvailability[]>) => {
    const dedupe = new Set<string>();
    const merged: IAvailability[] = [];

    Object.values(bySport).forEach((slots) => {
      slots.forEach((slot) => {
        const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
        if (!dedupe.has(key)) {
          dedupe.add(key);
          merged.push(slot);
        }
      });
    });

    return sortAvailabilitySlots(merged);
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

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      toast.error("Coach profile id is missing.");
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

      if (
        isSameAvailabilityBySport(sortedAvailabilityBySport, currentBySport)
      ) {
        toast.info("No time slot changes to save.");
        return;
      }

      const flattenedAvailability = flattenAvailability(
        sortedAvailabilityBySport,
      );

      const response = await coachApi.updateProfile(coachId, {
        availability: flattenedAvailability,
        availabilityBySport: sortedAvailabilityBySport,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to save availability");
      }

      setCoachProfile(response.data);
      const sports = response.data.sports || [];
      const bySportFromApi = response.data.availabilityBySport || {};
      const fallbackAvailability = sortAvailabilitySlots(
        response.data.availability || [],
      );
      const nextBySport: Record<string, IAvailability[]> = {};

      sports.forEach((sport) => {
        nextBySport[sport] = sortAvailabilitySlots(
          bySportFromApi[sport] || fallbackAvailability,
        );
      });

      setAvailabilityBySport(nextBySport);
      if (sports.length > 0 && !sports.includes(activeSportTab)) {
        setActiveSportTab(sports[0]);
      }
      toast.success("Time slots updated successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save time slots",
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading profile...</p>
      </Card>
    );
  }

  const badge = getVerificationBadge(coachProfile);
  const status =
    coachProfile?.verificationStatus ||
    (coachProfile?.isVerified ? "VERIFIED" : "UNVERIFIED");
  const guidance = getStatusGuidance(status);
  const BadgeIcon = badge.icon;
  const sportsCount = coachProfile?.sports?.length || 0;
  const pricingValues = coachProfile?.sportPricing
    ? Object.values(coachProfile.sportPricing)
    : [];
  const basePrice =
    pricingValues.length > 0
      ? Math.min(...pricingValues)
      : (coachProfile?.hourlyRate ?? 0);
  const totalSlots =
    coachProfile?.availabilityBySport &&
    Object.keys(coachProfile.availabilityBySport).length > 0
      ? Object.values(coachProfile.availabilityBySport).reduce(
          (count, slots) => count + (slots?.length || 0),
          0,
        )
      : (coachProfile?.availability?.length ?? 0);

  return (
    <div className="space-y-8 pb-8">
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="bg-linear-to-r from-slate-50 to-white px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProfilePictureUpload
                currentPhotoUrl={user?.photoUrl}
                onUploadSuccess={(updatedUser) => {
                  setUser(updatedUser);
                }}
                size="xl"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Coach Dashboard
                </p>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
                  {user?.name || "Coach"}
                </h2>
                <div className="mt-2 space-y-1">
                  {user?.email && (
                    <p className="break-all text-sm font-medium text-slate-600">
                      {user.email}
                    </p>
                  )}
                  {user?.phone && (
                    <p className="text-sm text-slate-600">{user.phone}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
              >
                <BadgeIcon size={14} />
                {badge.label}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {guidance}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sports
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {sportsCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Starting Price
              </p>
              <p className="mt-1 text-xl font-bold text-power-orange sm:text-2xl">
                ₹{basePrice || 0}/hr
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service Mode
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {coachProfile?.serviceMode === "OWN_VENUE"
                  ? "Own Venue"
                  : coachProfile?.serviceMode === "HYBRID"
                    ? "Hybrid"
                    : "Freelance"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Time Slots
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalSlots}
              </p>
            </div>
          </div>

          {coachProfile?.verificationNotes && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="mb-1 font-semibold">Rejection Notes:</p>
              {coachProfile.verificationNotes}
            </div>
          )}
        </div>
      </Card>

      {coachProfile ? (
        <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
          <div className="space-y-6 xl:col-span-8">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  About You
                </h3>
                {!isEditingAbout && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleEditAboutClick}
                  >
                    Edit About
                  </Button>
                )}
              </div>
              {isEditingAbout ? (
                <div className="space-y-3">
                  <textarea
                    value={aboutForm.bio}
                    onChange={(event) =>
                      setAboutForm({ bio: event.target.value })
                    }
                    rows={5}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                    placeholder="Tell players about your experience and coaching style"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveAbout}
                      loading={isSavingAbout}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingAbout(false)}
                      disabled={isSavingAbout}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {coachProfile.bio || "No bio added yet"}
                </p>
              )}
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Coaching Details
                </h3>
                {!isEditingCoaching && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleEditCoachingClick}
                  >
                    Edit Details
                  </Button>
                )}
              </div>
              {isEditingCoaching ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sports You Can Coach
                    </label>
                    <SportsMultiSelect
                      value={coachingForm.selectedSports}
                      onChange={(sports) => {
                        const updatedPricing = { ...coachingForm.sportPricing };

                        sports.forEach((sport) => {
                          if (!updatedPricing[sport]) {
                            updatedPricing[sport] =
                              coachingForm.pricingMode === "SAME"
                                ? coachingForm.hourlyRateInput || ""
                                : "";
                          }
                        });

                        Object.keys(updatedPricing).forEach((sport) => {
                          if (!sports.includes(sport)) {
                            delete updatedPricing[sport];
                          }
                        });

                        setCoachingForm((prev) => ({
                          ...prev,
                          selectedSports: sports,
                          sportPricing: updatedPricing,
                        }));
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Pricing
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="profilePricingMode"
                          value="SAME"
                          checked={coachingForm.pricingMode === "SAME"}
                          onChange={() =>
                            setCoachingForm((prev) => {
                              const updatedPricing = {
                                ...prev.sportPricing,
                              };
                              prev.selectedSports.forEach((sport) => {
                                updatedPricing[sport] =
                                  prev.hourlyRateInput || "";
                              });

                              return {
                                ...prev,
                                pricingMode: "SAME",
                                sportPricing: updatedPricing,
                              };
                            })
                          }
                        />
                        Same price for all sports
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="profilePricingMode"
                          value="PER_SPORT"
                          checked={coachingForm.pricingMode === "PER_SPORT"}
                          onChange={() =>
                            setCoachingForm((prev) => ({
                              ...prev,
                              pricingMode: "PER_SPORT",
                            }))
                          }
                        />
                        Different price per sport
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {coachingForm.pricingMode === "SAME"
                          ? "Hourly Price"
                          : "Base Hourly Rate"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={0.01}
                        value={coachingForm.hourlyRateInput}
                        onChange={(event) =>
                          setCoachingForm((prev) => {
                            const nextValue = event.target.value;
                            const updatedPricing = { ...prev.sportPricing };

                            if (prev.pricingMode === "SAME") {
                              prev.selectedSports.forEach((sport) => {
                                updatedPricing[sport] = nextValue;
                              });
                            }

                            return {
                              ...prev,
                              hourlyRateInput: nextValue,
                              sportPricing: updatedPricing,
                            };
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                        placeholder="500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Service Mode
                      </label>
                      <select
                        value={coachingForm.serviceMode}
                        onChange={(event) =>
                          setCoachingForm((prev) => ({
                            ...prev,
                            serviceMode: event.target.value as ServiceMode,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                      >
                        <option value="FREELANCE">Freelance</option>
                        <option value="OWN_VENUE">Own Venue</option>
                        <option value="HYBRID">Hybrid</option>
                      </select>
                    </div>
                  </div>

                  {coachingForm.pricingMode === "PER_SPORT" &&
                    coachingForm.selectedSports.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-900">
                          Price per Sport
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {coachingForm.selectedSports.map((sport) => (
                            <div key={sport}>
                              <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                                {sport}
                              </label>
                              <input
                                type="number"
                                min={1}
                                step={0.01}
                                value={coachingForm.sportPricing[sport] || ""}
                                onChange={(event) =>
                                  setCoachingForm((prev) => ({
                                    ...prev,
                                    sportPricing: {
                                      ...prev.sportPricing,
                                      [sport]: event.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                                placeholder="600"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {coachingForm.serviceMode !== "OWN_VENUE" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Service Radius (km)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={coachingForm.serviceRadiusKmInput}
                          onChange={(event) =>
                            setCoachingForm((prev) => ({
                              ...prev,
                              serviceRadiusKmInput: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Travel Buffer (minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={coachingForm.travelBufferTimeInput}
                          onChange={(event) =>
                            setCoachingForm((prev) => ({
                              ...prev,
                              travelBufferTimeInput: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCoachingDetails}
                      loading={isSavingCoaching}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingCoaching(false)}
                      disabled={isSavingCoaching}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Sports You Coach
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {coachProfile.sports && coachProfile.sports.length > 0 ? (
                        coachProfile.sports.map((sport) => (
                          <span
                            key={sport}
                            className="inline-flex items-center rounded-full bg-power-orange/10 px-3 py-1 text-sm font-medium text-power-orange border border-power-orange/20"
                          >
                            {sport}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No sports added yet
                        </p>
                      )}
                    </div>
                  </div>

                  {coachProfile.sportPricing &&
                    Object.keys(coachProfile.sportPricing).length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                          Pricing per Sport
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(coachProfile.sportPricing).map(
                            ([sport, price]) => (
                              <div
                                key={sport}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                              >
                                <span className="text-sm font-medium text-slate-700">
                                  {sport}
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                  ₹{price}/hr
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {coachProfile.hourlyRate && !coachProfile.sportPricing && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Hourly Rate
                      </p>
                      <p className="text-2xl font-bold text-power-orange">
                        ₹{coachProfile.hourlyRate}/hr
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Service Mode
                    </p>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                      {coachProfile.serviceMode === "OWN_VENUE"
                        ? "Own Venue"
                        : coachProfile.serviceMode === "HYBRID"
                          ? "Hybrid"
                          : "Freelance"}
                    </div>
                  </div>

                  {(coachProfile.serviceMode === "OWN_VENUE" ||
                    coachProfile.serviceMode === "HYBRID") &&
                    coachProfile.ownVenueDetails && (
                      <div className="border-t border-slate-200 pt-4 mt-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                          Your Venue
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {coachProfile.ownVenueDetails.name}
                            </p>
                            {coachProfile.ownVenueDetails.address && (
                              <p className="text-sm text-slate-600">
                                {coachProfile.ownVenueDetails.address}
                              </p>
                            )}
                          </div>
                          {coachProfile.ownVenueDetails.description && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                Description
                              </p>
                              <p className="text-sm text-slate-700">
                                {coachProfile.ownVenueDetails.description}
                              </p>
                            </div>
                          )}
                          {coachProfile.ownVenueDetails.openingHours && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                Opening Hours
                              </p>
                              <p className="text-sm text-slate-700">
                                {coachProfile.ownVenueDetails.openingHours}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                              Venue Images
                            </p>
                            {coachProfile.ownVenueDetails.images &&
                            coachProfile.ownVenueDetails.images.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {coachProfile.ownVenueDetails.images.map(
                                  (imageUrl, index) => (
                                    <button
                                      type="button"
                                      key={`${imageUrl}-${index}`}
                                      onClick={() =>
                                        setSelectedVenueImage(imageUrl)
                                      }
                                      className="group relative overflow-hidden rounded-lg border border-slate-200"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`Venue image ${index + 1}`}
                                        className="h-32 w-full object-cover"
                                      />
                                      <div className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/25" />
                                      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-800 opacity-0 transition-opacity group-hover:opacity-100">
                                        View
                                      </span>
                                    </button>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No venue images uploaded yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {coachProfile.serviceMode !== "OWN_VENUE" && (
                    <>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Service Radius
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {coachProfile.serviceRadiusKm || 10} km
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Travel Buffer Time
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {coachProfile.travelBufferTime || 30} minutes
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Availability / Time Slots
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={addTimeSlot}
                  disabled={!activeSportTab}
                >
                  <Plus size={16} />
                  Add Slot
                </Button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {(coachProfile.sports || []).map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setActiveSportTab(sport)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      activeSportTab === sport
                        ? "border-power-orange bg-orange-50 text-power-orange"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {!activeSportTab ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No sports found for this coach profile.
                  </div>
                ) : (availabilityBySport[activeSportTab] || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No time slots added yet for {activeSportTab}.
                  </div>
                ) : (
                  (availabilityBySport[activeSportTab] || []).map(
                    (slot, index) => (
                      <div
                        key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
                        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
                      >
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Day
                          </label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(event) =>
                              updateTimeSlot(
                                index,
                                "dayOfWeek",
                                Number(event.target.value),
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            {DAYS.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(event) =>
                              updateTimeSlot(
                                index,
                                "startTime",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(event) =>
                              updateTimeSlot(
                                index,
                                "endTime",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeTimeSlot(index)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50"
                          aria-label="Remove time slot"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ),
                  )
                )}
              </div>

              <div className="mt-4 flex items-center justify-end">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveAvailability}
                  disabled={savingAvailability || !coachProfile}
                  className="flex items-center gap-2"
                >
                  <Clock3 size={16} />
                  {savingAvailability ? "Saving..." : "Save Time Slots"}
                </Button>
              </div>
            </Card>

            {coachProfile.verificationDocuments &&
              coachProfile.verificationDocuments.length > 0 && (
                <Card className="border border-slate-200 bg-white shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Verification Documents
                  </h3>
                  <div className="space-y-2">
                    {coachProfile.verificationDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {doc.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.fileName}
                          </p>
                        </div>
                        <CheckCircle size={16} className="text-green-600" />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
          </div>

          <div className="space-y-6 xl:col-span-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Verification Status
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded ${badge.className}`}
                  >
                    <BadgeIcon size={12} />
                    {badge.label}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  {guidance}
                </div>
                {status === "VERIFIED" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-700 inline-flex items-center gap-1.5">
                      <CheckCircle size={13} />
                      Profile verified and visible to players
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Profile Info
                </h3>
                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={handleEditProfileClick}
                    className="px-3 py-1.5 bg-power-orange text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                      placeholder="Your email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-power-orange focus:outline-none"
                      placeholder="Your phone number"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="flex-1 rounded-lg bg-power-orange px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                    >
                      {isSavingProfile ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingProfile}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Name
                    </p>
                    <p className="font-medium text-slate-900">
                      {user?.name || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Email
                    </p>
                    <p className="break-all font-medium text-slate-900">
                      {user?.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Phone
                    </p>
                    <p className="font-medium text-slate-900">
                      {user?.phone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Role
                    </p>
                    <p className="font-medium text-slate-900">Coach</p>
                  </div>
                </div>
              )}
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={handleLogout}
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  Logout
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="bg-white">
          <div className="text-center py-8">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Coach Profile Yet
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Complete the verification process to create your coach profile and
              start accepting bookings.
            </p>
            <Link href="/coach/verification">
              <Button type="button" variant="primary" className="mx-auto">
                Start Verification
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {selectedVenueImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setSelectedVenueImage(null)}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedVenueImage(null)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/95 p-2 text-slate-800 shadow-sm transition-colors hover:bg-white"
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
            <img
              src={selectedVenueImage}
              alt="Venue image preview"
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
