"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, IAvailability, User } from "@/types";
import {
  LogOut,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock3,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

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

export default function CoachProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeSportTab, setActiveSportTab] = useState("");
  const [availabilityBySport, setAvailabilityBySport] = useState<
    Record<string, IAvailability[]>
  >({});
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");

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
        return "Your verification is submitted and pending admin review. You'll be notified once reviewed.";
      case "REVIEW":
        return "Your verification is currently under review. Edits are temporarily disabled.";
      case "VERIFIED":
        return "You are verified! Use the verification page to update your profile or resubmit documents.";
      case "REJECTED":
        return "Your verification was rejected. Update documents and resubmit through the verification page.";
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
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const addTimeSlot = () => {
    setAvailabilityMessage("");
    setAvailabilityError("");
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
    setAvailabilityMessage("");
    setAvailabilityError("");
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
    setAvailabilityMessage("");
    setAvailabilityError("");
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
      setAvailabilityError("Coach profile not found.");
      return;
    }

    const validationError = validateAvailabilityBySport(availabilityBySport);
    if (validationError) {
      setAvailabilityError(validationError);
      return;
    }

    const coachId = coachProfile.id || coachProfile._id;
    if (!coachId) {
      setAvailabilityError("Coach profile id is missing.");
      return;
    }

    try {
      setSavingAvailability(true);
      setAvailabilityError("");
      setAvailabilityMessage("");

      const sortedAvailabilityBySport: Record<string, IAvailability[]> = {};
      Object.entries(availabilityBySport).forEach(([sport, slots]) => {
        sortedAvailabilityBySport[sport] = sortAvailabilitySlots(slots);
      });

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
      setAvailabilityMessage("Time slots updated successfully.");
    } catch (error) {
      setAvailabilityError(
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

  return (
    <div className="space-y-6">
      <Card className="bg-white">
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
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Coach Profile
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                {user?.name || "Coach"}
              </h2>
              {user?.email && (
                <p className="text-sm text-slate-600">{user.email}</p>
              )}
              {user?.phone && (
                <p className="text-sm text-slate-600">{user.phone}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}
            >
              <BadgeIcon size={14} />
              {badge.label}
            </span>
            <Link href="/coach/verification">
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ShieldCheck size={18} />
                Edit Profile
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {guidance}
        </div>

        {coachProfile?.verificationNotes && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold mb-1">Rejection Notes:</p>
            {coachProfile.verificationNotes}
          </div>
        )}
      </Card>

      {coachProfile ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                About You
              </h3>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {coachProfile.bio || "No bio added yet"}
              </p>
            </Card>

            <Card className="bg-white">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Coaching Details
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Sports You Teach
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
            </Card>

            <Card className="bg-white">
              <div className="mb-4 flex items-center justify-between">
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

              {availabilityError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {availabilityError}
                </div>
              )}

              {availabilityMessage && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                  {availabilityMessage}
                </div>
              )}

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
                <Card className="bg-white">
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

          <div className="space-y-6">
            <Card className="bg-white">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Profile Info
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Email
                  </p>
                  <p className="font-medium text-slate-900">{user?.email}</p>
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
            </Card>

            <Card className="bg-white">
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
                {status === "VERIFIED" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-700">
                      ✓ Profile verified and visible to players
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <div className="pt-3">
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
    </div>
  );
}
