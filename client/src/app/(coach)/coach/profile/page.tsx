"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, User } from "@/types";
import { LogOut, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const SPORTS_OPTIONS = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Basketball",
  "Volleyball",
  "Table Tennis",
  "Swimming",
  "Hockey",
  "Kabaddi",
];

export default function CoachProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);

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
        setCoachProfile(response.data);
      }
    } catch (error) {
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
