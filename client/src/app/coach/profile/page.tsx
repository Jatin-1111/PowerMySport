"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { coachApi } from "@/lib/coach";
import { Coach, IAvailability } from "@/types";

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
      console.log("No profile found, showing create form");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
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
        venueId:
          formData.serviceMode !== "FREELANCE" ? formData.venueId : undefined,
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

  if (loading) {
    return (
      <div className="bg-card rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-8 border border-border">
      <h2 className="text-2xl font-bold mb-6 text-deep-slate">
        {hasProfile ? "Edit Coach Profile" : "Create Coach Profile"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            rows={4}
            placeholder="Tell us about your coaching experience..."
            required
          />
        </div>

        {/* Certifications */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Certifications (comma-separated)
          </label>
          <input
            type="text"
            value={formData.certifications}
            onChange={(e) =>
              setFormData({ ...formData, certifications: e.target.value })
            }
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            placeholder="e.g., Level 2 Cricket Coach, BCCI Certified"
          />
        </div>

        {/* Sports */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Sports (comma-separated)
          </label>
          <input
            type="text"
            value={formData.sports}
            onChange={(e) =>
              setFormData({ ...formData, sports: e.target.value })
            }
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            placeholder="e.g., Cricket, Badminton"
            required
          />
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Hourly Rate (₹)
          </label>
          <input
            type="number"
            value={formData.hourlyRate}
            onChange={(e) =>
              setFormData({ ...formData, hourlyRate: Number(e.target.value) })
            }
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            min="0"
            required
          />
        </div>

        {/* Service Mode */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
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
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
          >
            <option value="OWN_VENUE">Own Venue (I have my own venue)</option>
            <option value="FREELANCE">Freelance (I travel to venues)</option>
            <option value="HYBRID">Hybrid (Both)</option>
          </select>
        </div>

        {/* Conditional Fields */}
        {formData.serviceMode !== "FREELANCE" && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Venue ID (optional)
            </label>
            <input
              type="text"
              value={formData.venueId}
              onChange={(e) =>
                setFormData({ ...formData, venueId: e.target.value })
              }
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
              placeholder="Enter your venue ID"
            />
          </div>
        )}

        {formData.serviceMode !== "OWN_VENUE" && (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                min="0"
              />
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-power-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving
            ? "Saving..."
            : hasProfile
              ? "Update Profile"
              : "Create Profile"}
        </button>
      </form>
    </div>
  );
}
