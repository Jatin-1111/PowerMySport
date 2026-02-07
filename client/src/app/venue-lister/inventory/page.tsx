"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { venueApi } from "@/lib/venue";
import { useAuthStore } from "@/store/authStore";
import { Venue } from "@/types";
import { MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function VenueInventoryPage() {
  const { user } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    location: null as { lat: number; lng: number } | null,
    sports: "",
    pricePerHour: "",
    amenities: "",
    description: "",
    openingHours: "9:00 AM - 9:00 PM",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("");

  // Check if user can add more venues (defaults to false for venue listers from inquiry)
  const canAddMoreVenues = user?.venueListerProfile?.canAddMoreVenues ?? true;

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const response = await venueApi.getMyVenues();
      if (response.success && response.data) {
        setVenues(response.data);
      }
    } catch (error) {
      console.error("Failed to load venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGetLocation = () => {
    setLocationStatus("Getting location...");
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        }));
        setLocationStatus("Location captured! ✅");
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationStatus("Unable to retrieve your location");
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate location for new venues
      if (!formData.location && !editingVenue) {
        // If we are editing, we might keep existing location if not updated
        // But for new venues, we require it OR we default to something?
        // User asked to fix the crash. Safest is to REQUIRE it or default to 0,0 if really needed.
        // But better to ask user.
        alert("Please capture the GPS location of the venue using the button.");
        setIsSubmitting(false);
        return;
      }

      const venueData: any = {
        name: formData.name,
        address: formData.address, // Send address string
        sports: formData.sports.split(",").map((s) => s.trim()),
        pricePerHour: parseFloat(formData.pricePerHour),
        amenities: formData.amenities
          ? formData.amenities.split(",").map((a) => a.trim())
          : [],
        description: formData.description,
        openingHours: formData.openingHours,
      };

      // Transform location to GeoJSON if present
      if (formData.location) {
        venueData.location = {
          type: "Point",
          coordinates: [formData.location.lng, formData.location.lat],
        };
      }

      if (editingVenue) {
        await venueApi.updateVenue(editingVenue.id, venueData);
      } else {
        await venueApi.createVenue(venueData);
      }

      // Reset form and reload
      setFormData({
        name: "",
        address: "",
        location: null,
        sports: "",
        pricePerHour: "",
        amenities: "",
        description: "",
        openingHours: "9:00 AM - 9:00 PM",
      });
      setLocationStatus("");
      setShowForm(false);
      setEditingVenue(null);
      loadVenues();
    } catch (error: any) {
      console.error("Failed to save venue:", error);
      alert(error.response?.data?.message || "Failed to save venue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    // Extract coordinates if available
    let loc = null;
    if (
      venue.location &&
      venue.location.coordinates &&
      venue.location.coordinates.length === 2
    ) {
      loc = {
        lng: venue.location.coordinates[0],
        lat: venue.location.coordinates[1],
      };
    }

    setFormData({
      name: venue.name,
      address:
        `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}` ||
        "",
      location: loc,
      sports: venue.sports.join(", "),
      pricePerHour: venue.pricePerHour.toString(),
      amenities: venue.amenities?.join(", ") || "",
      description: venue.description || "",
      openingHours: "9:00 AM - 9:00 PM",
    });
    setShowForm(true);
    setLocationStatus(loc ? "Location matched from saved data" : "");
  };

  const handleDelete = async (venueId: string) => {
    if (!confirm("Are you sure you want to delete this venue?")) return;

    try {
      await venueApi.deleteVenue(venueId);
      loadVenues();
    } catch (error) {
      console.error("Failed to delete venue:", error);
      alert("Failed to delete venue");
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVenue(null);
    setFormData({
      name: "",
      address: "",
      location: null,
      sports: "",
      pricePerHour: "",
      amenities: "",
      description: "",
      openingHours: "9:00 AM - 9:00 PM",
    });
    setLocationStatus("");
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Loading venues...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">My Venues</h1>
        {!showForm && canAddMoreVenues && (
          <Button onClick={() => setShowForm(true)} variant="primary">
            + Add Venue
          </Button>
        )}
      </div>

      {/* Restriction message for venue listers who cannot add more */}
      {!canAddMoreVenues && !showForm && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            <strong>Note:</strong> You can only manage your approved venue. To
            add more venues, please contact our admin team.
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="bg-white mb-6">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            {editingVenue ? "Edit Venue" : "Add New Venue"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Venue Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Elite Sports Arena"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Address (Display Only) *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Mumbai, Maharashtra"
                />
              </div>
            </div>

            {/* GPS Location Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                GPS Location (Required for Search) *
              </label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <MapPin size={18} />
                  {formData.location
                    ? "Update Location"
                    : "Get Current Location"}
                </Button>
                {locationStatus && (
                  <span
                    className={`text-sm ${
                      locationStatus.includes("✅")
                        ? "text-green-600 font-medium"
                        : "text-slate-500"
                    }`}
                  >
                    {locationStatus}
                  </span>
                )}
              </div>
              {formData.location && (
                <p className="text-xs text-slate-500 mt-2">
                  Lat: {formData.location.lat.toFixed(6)}, Lng:{" "}
                  {formData.location.lng.toFixed(6)}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Sports (comma-separated) *
                </label>
                <input
                  type="text"
                  name="sports"
                  value={formData.sports}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Cricket, Football, Badminton"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Price per Hour (₹) *
                </label>
                <input
                  type="number"
                  name="pricePerHour"
                  value={formData.pricePerHour}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., 1500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Opening Hours
              </label>
              <input
                type="text"
                name="openingHours"
                value={formData.openingHours}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="e.g., Mon-Sun: 9 AM - 10 PM"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Amenities (comma-separated)
              </label>
              <input
                type="text"
                name="amenities"
                value={formData.amenities}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="e.g., Parking, Changing rooms, Cafeteria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                placeholder="Describe your venue..."
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} variant="primary">
                {isSubmitting
                  ? "Saving..."
                  : editingVenue
                    ? "Update Venue"
                    : "Add Venue"}
              </Button>
              <Button type="button" onClick={handleCancel} variant="secondary">
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Venues List */}
      {venues.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600 mb-4">No venues added yet</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
            >
              Add your first venue
            </button>
          )}
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className="bg-white hover:shadow-lg transition-shadow p-0 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2 text-slate-900">
                  {venue.name}
                </h3>
                <p className="text-sm text-slate-600 mb-1">
                  📍{" "}
                  {venue.location?.coordinates
                    ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
                    : "Location not set"}
                </p>
                <p className="text-xs text-slate-500 mb-3">🕒 Hours not set</p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {venue.sports.map((sport, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full"
                    >
                      {sport}
                    </span>
                  ))}
                </div>

                <p className="text-2xl font-bold text-power-orange mb-4">
                  ₹{venue.pricePerHour}
                  <span className="text-sm text-slate-600">/hour</span>
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEdit(venue)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(venue.id)}
                    variant="danger"
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


