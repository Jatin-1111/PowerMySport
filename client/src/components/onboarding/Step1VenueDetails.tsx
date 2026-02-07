"use client";

import { useState } from "react";
import { OnboardingStep1Payload } from "@/types/onboarding";

interface Step1VenueDetailsProps {
  onSubmit: (data: OnboardingStep1Payload) => Promise<void>;
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

const AMENITIES_OPTIONS = [
  "Parking",
  "Restroom",
  "Water",
  "Changing Room",
  "Lockers",
  "Cafeteria",
  "AC",
  "Lights",
  "Equipment Rental",
  "WiFi",
];

export default function Step1VenueDetails({
  onSubmit,
  loading,
  error,
}: Step1VenueDetailsProps) {
  const [formData, setFormData] = useState<OnboardingStep1Payload>({
    name: "",
    sports: [],
    pricePerHour: 0,
    amenities: [],
    address: "",
    openingHours: "9:00 AM - 9:00 PM",
    description: "",
    allowExternalCoaches: true,
    location: {
      type: "Point",
      coordinates: [77.2, 28.7], // Default Delhi coordinates
    },
  });

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else if (name === "pricePerHour") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseFloat(value) || 0,
      }));
    } else if (name === "lat" || name === "lng") {
      const coord = parseFloat(value) || 0;
      const newCoords: [number, number] = [
        name === "lng" ? coord : formData.location.coordinates[0],
        name === "lat" ? coord : formData.location.coordinates[1],
      ];
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          coordinates: newCoords,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => {
      const updated = prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport];
      setFormData((prev) => ({
        ...prev,
        sports: updated,
      }));
      return updated;
    });
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) => {
      const updated = prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity];
      setFormData((prev) => ({
        ...prev,
        amenities: updated,
      }));
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert("Please enter venue name");
      return;
    }
    if (formData.sports.length === 0) {
      alert("Please select at least one sport");
      return;
    }
    if (formData.pricePerHour <= 0) {
      alert("Please enter valid price per hour");
      return;
    }
    if (!formData.address.trim()) {
      alert("Please enter venue address");
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      console.error("Form submission error:", err);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add Your Venue</h1>
        <p className="text-gray-600 mt-2">Step 1 of 3: Basic Details</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Venue Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Central Sports Complex"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Sports Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sports Available <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SPORTS_OPTIONS.map((sport) => (
              <label
                key={sport}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">{sport}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Per Hour */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price per Hour (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="pricePerHour"
              value={formData.pricePerHour}
              onChange={handleInputChange}
              placeholder="500"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Opening Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opening Hours
            </label>
            <input
              type="text"
              name="openingHours"
              value={formData.openingHours}
              onChange={handleInputChange}
              placeholder="9:00 AM - 9:00 PM"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="123 Street, City, State"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Location Coordinates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location Coordinates
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Longitude
              </label>
              <input
                type="number"
                name="lng"
                value={formData.location.coordinates[0]}
                onChange={handleInputChange}
                placeholder="77.2"
                step="0.0001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Latitude
              </label>
              <input
                type="number"
                name="lat"
                value={formData.location.coordinates[1]}
                onChange={handleInputChange}
                placeholder="28.7"
                step="0.0001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Tell players about your venue..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amenities
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">{amenity}</span>
              </label>
            ))}
          </div>
        </div>

        {/* External Coaches */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="allowExternalCoaches"
            checked={formData.allowExternalCoaches}
            onChange={handleInputChange}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label className="text-sm text-gray-700">
            Allow external coaches at your venue?
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Creating Venue..." : "Continue to Step 2: Upload Images"}
        </button>
      </form>
    </div>
  );
}

