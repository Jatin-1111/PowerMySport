"use client";

import { toast } from "@/lib/toast";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import { VenueCoach } from "@/modules/onboarding/types/onboarding";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Camera, IndianRupee, Lightbulb, User, X } from "lucide-react";
import { useState } from "react";

interface Step5CoachListProps {
  onFinalize: (coaches: VenueCoach[]) => Promise<void>;
  loading?: boolean;
  venueId?: string; // Made optional to avoid breaking existing usages, but required for photo upload
}

const SPORTS_OPTIONS = [
  "Badminton",
  "Cricket",
  "Football",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Squash",
  "Table Tennis",
  "Gym",
  "Swimming",
];

export default function Step5CoachList({ onFinalize, loading, venueId }: Step5CoachListProps) {
  const [coaches, setCoaches] = useState<VenueCoach[]>([]);

  // Form state for adding new coach
  const [newCoach, setNewCoach] = useState<VenueCoach>({
    name: "",
    sport: "",
    hourlyRate: 0,
    bio: "",
    profilePhoto: "",
  });

  const [showForm, setShowForm] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string>("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "hourlyRate") {
      setNewCoach((prev) => ({
        ...prev,
        [name]: parseFloat(value) || 0,
      }));
    } else {
      setNewCoach((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setPhotoUploadError("Photo must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setPhotoUploadError("Please upload an image file");
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoUploadError("");

    try {
      // Use venueId from props or fallback to URL (though URL might be unreliable in dev/skip flow)
      const targetVenueId = venueId || new URLSearchParams(window.location.search).get("venueId");

      if (!targetVenueId) {
        throw new Error("Venue ID not found. Please try refreshing the page.");
      }

      // Request presigned URL
      // Request presigned URL
      const response = await onboardingApi.getCoachPhotoUploadUrl(
        targetVenueId,
        file.name,
        file.type
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to get upload URL");
      }

      // Upload to S3
      const uploadResponse = await fetch(response.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload photo");
      }

      // Set the download URL
      setNewCoach((prev) => ({
        ...prev,
        profilePhoto: response.data!.downloadUrl,
      }));
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setNewCoach((prev) => ({ ...prev, profilePhoto: "" }));
  };

  const handleAddCoach = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const trimmedName = newCoach.name.trim();
    const trimmedBio = (newCoach.bio ?? "").trim();
    if (trimmedName.length < 2) {
      toast.error("Coach name must be at least 2 characters");
      return;
    }
    if (!newCoach.sport.trim()) {
      toast.error("Sport is required");
      return;
    }
    if (!SPORTS_OPTIONS.includes(newCoach.sport)) {
      toast.error("Select a valid sport");
      return;
    }
    if (newCoach.hourlyRate <= 0) {
      toast.error("Hourly rate must be greater than 0");
      return;
    }
    if (trimmedBio.length > 0) {
      if (trimmedBio.length < 20) {
        toast.error("Coach bio must be at least 20 characters");
        return;
      }
      if (trimmedBio.length > 500) {
        toast.error("Coach bio cannot exceed 500 characters");
        return;
      }
    }

    // Add coach to list
    setCoaches((prev) => [
      ...prev,
      {
        ...newCoach,
        name: trimmedName,
        sport: newCoach.sport.trim(),
        bio: trimmedBio,
      },
    ]);

    // Reset form
    setNewCoach({
      name: "",
      sport: "",
      hourlyRate: 0,
      bio: "",
      profilePhoto: "",
    });
    setShowForm(false);
  };

  const handleRemoveCoach = (index: number) => {
    setCoaches((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSkip = async () => {
    try {
      await onFinalize([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to skip");
    }
  };

  const handleComplete = async () => {
    try {
      await onFinalize(coaches);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finalize");
    }
  };

  return (
    <Card className="shadow-xs mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/90">
      <div className="space-y-6 p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Add In-House Coaches</h1>
          <p className="mt-2 text-slate-600">Step 5 of 5: List your internal coaches (optional)</p>
        </div>

        {/* Coaches List */}
        {coaches.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Added Coaches ({coaches.length})
            </h2>
            <div className="space-y-2">
              {coaches.map((coach, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Coach Photo */}
                    {coach.profilePhoto ? (
                      <img
                        src={coach.profilePhoto}
                        alt={coach.name}
                        className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-gray-300">
                        <User className="h-6 w-6 text-slate-600" />
                      </div>
                    )}

                    {/* Coach Info */}
                    <div>
                      <h3 className="font-semibold text-slate-900">{coach.name}</h3>
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <span>{coach.sport}</span>
                        <span className="text-slate-400">|</span>
                        <IndianRupee className="h-4 w-4 text-slate-500" />
                        <span>{coach.hourlyRate}/hour</span>
                      </p>
                      {coach.bio && (
                        <p className="mt-2 text-sm italic text-slate-600">"{coach.bio}"</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCoach(index)}
                    className="text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Coach Form */}
        {!showForm ? (
          <Button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-power-orange w-full py-2.5 text-white hover:bg-orange-600"
          >
            + Add Coach
          </Button>
        ) : (
          <form
            onSubmit={handleAddCoach}
            className="bg-power-orange/5 border-power-orange/20 space-y-4 rounded-lg border p-4"
          >
            {/* Coach Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Coach Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={newCoach.name}
                onChange={handleInputChange}
                placeholder="e.g., John Doe"
                className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Profile Photo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Profile Photo (Optional)
              </label>
              <div className="flex items-center gap-4">
                {/* Photo Preview */}
                <div className="relative">
                  {newCoach.profilePhoto ? (
                    <div className="relative">
                      <img
                        src={newCoach.profilePhoto}
                        alt="Coach profile"
                        className="h-20 w-20 rounded-full border-2 border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-200">
                      <User className="h-10 w-10 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="">
                  <label className="cursor-pointer">
                    <div className="border-power-orange/30 hover:bg-power-orange/5 flex items-center gap-2 rounded-lg border bg-white px-4 py-2 transition-colors">
                      <Camera className="text-power-orange h-4 w-4" />
                      <span className="text-power-orange text-sm font-medium">
                        {isUploadingPhoto
                          ? "Uploading..."
                          : newCoach.profilePhoto
                            ? "Change Photo"
                            : "Upload Photo"}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={isUploadingPhoto || loading}
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500">JPG, PNG up to 5MB</p>
                  {photoUploadError && (
                    <p className="mt-1 text-xs text-red-600">{photoUploadError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sport */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sport <span className="text-red-500">*</span>
              </label>
              <select
                name="sport"
                value={newCoach.sport}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select a sport</option>
                {SPORTS_OPTIONS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <IndianRupee className="h-4 w-4 text-slate-600" />
                  Hourly Rate (INR)
                </span>
                <span className="text-red-500"> *</span>
              </label>
              <input
                type="number"
                name="hourlyRate"
                value={newCoach.hourlyRate === 0 ? "" : newCoach.hourlyRate}
                onChange={handleInputChange}
                placeholder="500"
                min="0"
                className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Bio */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Bio / Expertise (Optional)
              </label>
              <textarea
                name="bio"
                value={newCoach.bio}
                onChange={handleInputChange}
                placeholder="e.g., Certified coach with 5+ years of experience"
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="bg-power-orange flex-1 py-2 text-white hover:bg-orange-600"
              >
                {loading ? "Adding..." : "Add Coach"}
              </Button>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-600 py-2 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Info Message */}
        <div className="bg-power-orange/5 border-power-orange/20 rounded-lg border p-4">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Lightbulb className="text-power-orange mt-0.5 h-4 w-4" />
            <span>
              <strong>Tip:</strong> You can add coaches now or skip this step and add them later
              from your venue dashboard.
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="flex-1 bg-slate-600 py-2.5 text-white hover:bg-slate-700"
          >
            {loading ? "Processing..." : "Skip"}
          </Button>
          <Button
            type="button"
            onClick={handleComplete}
            disabled={loading}
            className="bg-power-orange flex-1 py-2.5 text-white hover:bg-orange-600"
          >
            {loading ? "Completing..." : "Complete Onboarding"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
