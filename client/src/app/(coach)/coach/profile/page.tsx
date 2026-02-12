"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { coachApi } from "@/modules/coach/services/coach";
import { Coach } from "@/types";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function CoachProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [formData, setFormData] = useState({
    bio: "",
    certifications: "",
    sports: "",
    hourlyRate: 0,
    serviceMode: "FREELANCE" as "OWN_VENUE" | "FREELANCE" | "HYBRID",
    venueId: "",
    serviceRadiusKm: 10,
    travelBufferTime: 30,
  });

  useEffect(() => {
    loadProfile();
  }, []);

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
          hourlyRate: response.data.hourlyRate,
          serviceMode: response.data.serviceMode,
          venueId: response.data.venueId || "",
          serviceRadiusKm: response.data.serviceRadiusKm || 10,
          travelBufferTime: response.data.travelBufferTime || 30,
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
        hourlyRate: Number(formData.hourlyRate),
        serviceMode: formData.serviceMode,
        serviceRadiusKm:
          formData.serviceMode !== "OWN_VENUE"
            ? formData.serviceRadiusKm
            : undefined,
        travelBufferTime:
          formData.serviceMode !== "OWN_VENUE"
            ? formData.travelBufferTime
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
    <Card className="bg-white">
      <h2 className="text-3xl font-bold mb-6 text-slate-900">
        {hasProfile ? "Edit Coach Profile" : "Create Coach Profile"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bio */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all resize-none"
            rows={4}
            placeholder="Tell us about your coaching experience..."
            required
          />
        </div>

        {/* Certifications */}
        <div>
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

        {/* Sports */}
        <div>
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

        {/* Hourly Rate */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Hourly Rate (?)
          </label>
          <input
            type="number"
            value={formData.hourlyRate}
            onChange={(e) =>
              setFormData({ ...formData, hourlyRate: Number(e.target.value) })
            }
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
            min="0"
            required
          />
        </div>

        {/* Service Mode */}
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
            <option value="OWN_VENUE">Own Venue (I have my own venue)</option>
            <option value="FREELANCE">Freelance (I travel to venues)</option>
            <option value="HYBRID">Hybrid (Both)</option>
          </select>
          {formData.serviceMode === "OWN_VENUE" && (
            <p className="text-xs text-slate-500 mt-2">
              ✓ You'll automatically get a dedicated coaching venue managed by
              the platform. View it in your{" "}
              <a
                href="/venue-lister/inventory"
                className="text-power-orange hover:underline"
              >
                venue inventory
              </a>
              .
            </p>
          )}
          {formData.serviceMode === "HYBRID" && (
            <p className="text-xs text-slate-500 mt-2">
              ✓ You'll have both your own dedicated venue and the ability to
              travel to other venues. Manage your venue in{" "}
              <a
                href="/venue-lister/inventory"
                className="text-power-orange hover:underline"
              >
                venue inventory
              </a>
              .
            </p>
          )}
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
                    serviceRadiusKm: Number(e.target.value),
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
                    travelBufferTime: Number(e.target.value),
                  })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                min="0"
              />
            </div>
          </>
        )}

        {/* Submit Button */}
        <div className="flex gap-3">
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
  );
}
