"use client";

import { useState } from "react";
import { IndianRupee, Lightbulb } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { VenueCoach } from "@/modules/onboarding/types/onboarding";

interface Step5CoachListProps {
  onFinalize: (coaches: VenueCoach[]) => Promise<void>;
  loading?: boolean;
  error?: string;
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

export default function Step5CoachList({
  onFinalize,
  loading,
  error,
}: Step5CoachListProps) {
  const [coaches, setCoaches] = useState<VenueCoach[]>([]);
  const [formError, setFormError] = useState<string>("");

  // Form state for adding new coach
  const [newCoach, setNewCoach] = useState<VenueCoach>({
    name: "",
    sport: "",
    hourlyRate: 0,
    bio: "",
  });

  const [showForm, setShowForm] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
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

  const handleAddCoach = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    if (!newCoach.name.trim()) {
      setFormError("Coach name is required");
      return;
    }
    if (!newCoach.sport.trim()) {
      setFormError("Sport is required");
      return;
    }
    if (newCoach.hourlyRate <= 0) {
      setFormError("Hourly rate must be greater than 0");
      return;
    }

    // Add coach to list
    setCoaches((prev) => [...prev, { ...newCoach }]);

    // Reset form
    setNewCoach({
      name: "",
      sport: "",
      hourlyRate: 0,
      bio: "",
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
      setFormError(err instanceof Error ? err.message : "Failed to skip");
    }
  };

  const handleComplete = async () => {
    try {
      await onFinalize(coaches);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to finalize");
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto rounded-lg">
      <div className="p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Add In-House Coaches
          </h1>
          <p className="text-gray-600 mt-2">
            Step 5 of 5: List your internal coaches (optional)
          </p>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        {formError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {formError}
          </div>
        )}

        {/* Coaches List */}
        {coaches.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Added Coaches ({coaches.length})
            </h2>
            <div className="space-y-2">
              {coaches.map((coach, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg flex justify-between items-start bg-gray-50"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {coach.name}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <span>{coach.sport}</span>
                      <span className="text-gray-400">|</span>
                      <IndianRupee className="h-4 w-4 text-gray-500" />
                      <span>{coach.hourlyRate}/hour</span>
                    </p>
                    {coach.bio && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        "{coach.bio}"
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCoach(index)}
                    className="text-red-600 hover:text-red-800 font-medium text-sm"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5"
          >
            + Add Coach
          </Button>
        ) : (
          <form
            onSubmit={handleAddCoach}
            className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            {/* Coach Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coach Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={newCoach.name}
                onChange={handleInputChange}
                placeholder="e.g., John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Sport */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sport <span className="text-red-500">*</span>
              </label>
              <select
                name="sport"
                value={newCoach.sport}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center gap-1">
                  <IndianRupee className="h-4 w-4 text-gray-600" />
                  Hourly Rate (INR)
                </span>
                <span className="text-red-500"> *</span>
              </label>
              <input
                type="number"
                name="hourlyRate"
                value={newCoach.hourlyRate}
                onChange={handleInputChange}
                placeholder="500"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio / Expertise (Optional)
              </label>
              <textarea
                name="bio"
                value={newCoach.bio}
                onChange={handleInputChange}
                placeholder="e.g., Certified coach with 5+ years of experience"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2"
              >
                {loading ? "Adding..." : "Add Coach"}
              </Button>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Info Message */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 mt-0.5 text-blue-700" />
            <span>
              <strong>Tip:</strong> You can add coaches now or skip this step
              and add them later from your venue dashboard.
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2.5"
          >
            {loading ? "Processing..." : "Skip"}
          </Button>
          <Button
            type="button"
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5"
          >
            {loading ? "Completing..." : "Complete Onboarding"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
