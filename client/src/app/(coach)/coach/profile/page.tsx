"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, User } from "@/types";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function CoachProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    bio: "",
    certifications: "",
    sports: "",
    hourlyRate: "",
    serviceMode: "FREELANCE" as "OWN_VENUE" | "FREELANCE" | "HYBRID",
    venueId: "",
    serviceRadiusKm: "10",
    travelBufferTime: "30",
  });

  useEffect(() => {
    loadProfile();
    loadUser();
  }, []);

  const getVerificationBadge = (coachData: Coach | null) => {
    if (!coachData) {
      return {
        label: "Unverified",
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
          label: "Pending",
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
          label: "Unverified",
          className: "bg-slate-100 text-slate-700 border border-slate-200",
        };
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
        setHasProfile(true);
        setCoachProfile(response.data);
        setFormData({
          bio: response.data.bio,
          certifications: response.data.certifications.join(", "),
          sports: response.data.sports.join(", "),
          hourlyRate: response.data.hourlyRate.toString(),
          serviceMode: response.data.serviceMode,
          venueId: response.data.venueId || "",
          serviceRadiusKm: (response.data.serviceRadiusKm ?? 10).toString(),
          travelBufferTime: (response.data.travelBufferTime ?? 30).toString(),
        });
      }
    } catch (error) {
      // No profile found, check if there's a serviceMode from registration
      const registrationServiceMode =
        typeof window !== "undefined"
          ? (localStorage.getItem("coachServiceMode") as
              | "OWN_VENUE"
              | "FREELANCE"
              | "HYBRID"
              | null)
          : null;

      if (registrationServiceMode) {
        setFormData((prev) => ({
          ...prev,
          serviceMode: registrationServiceMode,
        }));
        // Clear from localStorage after using
        localStorage.removeItem("coachServiceMode");
      }
      console.log("No profile found, showing create form");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate Venue ID format if present
      if (
        formData.serviceMode !== "FREELANCE" &&
        formData.venueId &&
        formData.venueId.trim() !== ""
      ) {
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!objectIdPattern.test(formData.venueId.trim())) {
          alert(
            "Invalid Venue ID. It must be a 24-character hexadecimal string.",
          );
          setSaving(false);
          return;
        }
      }

      const payload = {
        bio: formData.bio,
        certifications: formData.certifications
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c),
        sports: formData.sports
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
        hourlyRate: Number(formData.hourlyRate || 0),
        serviceMode: formData.serviceMode,
        serviceRadiusKm:
          formData.serviceMode !== "OWN_VENUE"
            ? formData.serviceRadiusKm.trim() === ""
              ? undefined
              : Number(formData.serviceRadiusKm)
            : undefined,
        travelBufferTime:
          formData.serviceMode !== "OWN_VENUE"
            ? formData.travelBufferTime.trim() === ""
              ? undefined
              : Number(formData.travelBufferTime)
            : undefined,
        availability: [], // TODO: Add availability editor
      };

      if (hasProfile && coachProfile) {
        await coachApi.updateProfile(coachProfile.id, payload);
        alert("Profile updated successfully!");
      } else {
        await coachApi.createProfile(payload);
        alert("Profile created successfully!");
        setHasProfile(true);
      }
      await loadProfile();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to save profile");
    } finally {
      setSaving(false);
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
      <Card className="text-center bg-white">
        <p className="text-slate-600">Loading profile...</p>
      </Card>
    );
  }

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
                {hasProfile ? "Edit Coach Profile" : "Create Coach Profile"}
              </h2>
              <p className="text-sm text-slate-600">{user?.name || "Coach"}</p>
              {user?.email && (
                <p className="text-xs text-slate-500">{user.email}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const badge = getVerificationBadge(coachProfile);
              return (
                <span
                  className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}
                >
                  {badge.label}
                </span>
              );
            })()}
            <Link href="/coach/verification">
              <Button
                type="button"
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ShieldCheck size={18} />
                Verification
              </Button>
            </Link>
          </div>
        </div>
        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {coachProfile.verificationNotes}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="bg-white">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all resize-none"
                  rows={4}
                  placeholder="Tell us about your coaching experience..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Certifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.certifications}
                  onChange={(e) =>
                    setFormData({ ...formData, certifications: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Level 2 Cricket Coach, BCCI Certified"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Sports (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.sports}
                  onChange={(e) =>
                    setFormData({ ...formData, sports: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Cricket, Badminton"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Hourly Rate (₹)
                </label>
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hourlyRate: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Service Mode
                </label>
                <select
                  value={formData.serviceMode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      serviceMode: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                >
                  <option value="OWN_VENUE">
                    Own Venue (I have my own venue)
                  </option>
                  <option value="FREELANCE">
                    Freelance (I travel to venues)
                  </option>
                  <option value="HYBRID">Hybrid (Both)</option>
                </select>
              </div>

              {formData.serviceMode !== "OWN_VENUE" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Service Radius (km)
                    </label>
                    <input
                      type="number"
                      value={formData.serviceRadiusKm}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          serviceRadiusKm: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Travel Buffer Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.travelBufferTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          travelBufferTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                      min="0"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={saving}
                variant="primary"
                className="flex-1"
              >
                {saving
                  ? "Saving..."
                  : hasProfile
                    ? "Update Profile"
                    : "Create Profile"}
              </Button>
              <Button
                type="button"
                onClick={handleLogout}
                variant="secondary"
                className="flex items-center justify-center gap-2 px-6"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="bg-white">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Profile Snapshot
            </h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Service Mode</span>
                <span className="font-semibold text-slate-900">
                  {formData.serviceMode}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Hourly Rate</span>
                <span className="font-semibold text-slate-900">
                  ₹{formData.hourlyRate || "0"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sports</span>
                <span className="font-semibold text-slate-900">
                  {
                    formData.sports
                      .split(",")
                      .map((sport) => sport.trim())
                      .filter(Boolean).length
                  }
                </span>
              </div>
              {formData.serviceMode !== "OWN_VENUE" && (
                <div className="flex items-center justify-between">
                  <span>Service Radius</span>
                  <span className="font-semibold text-slate-900">
                    {formData.serviceRadiusKm || "0"} km
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Verification
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Upload documents and track verification status.
            </p>
            <Link href="/coach/verification">
              <Button
                type="button"
                variant="secondary"
                className="flex w-full items-center justify-center gap-2"
              >
                <ShieldCheck size={18} />
                Go to Verification
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
