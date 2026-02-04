"use client";

import React, { useState, useEffect } from "react";
import { venueApi } from "@/lib/venue";
import { Venue } from "@/types";
import Link from "next/link";

export default function VenueInventoryPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    sports: "",
    pricePerHour: "",
    amenities: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const venueData = {
        name: formData.name,
        location: formData.location,
        sports: formData.sports.split(",").map((s) => s.trim()),
        pricePerHour: parseFloat(formData.pricePerHour),
        amenities: formData.amenities
          ? formData.amenities.split(",").map((a) => a.trim())
          : [],
        description: formData.description,
      };

      if (editingVenue) {
        await venueApi.updateVenue(editingVenue.id, venueData);
      } else {
        await venueApi.createVenue(venueData);
      }

      // Reset form and reload
      setFormData({
        name: "",
        location: "",
        sports: "",
        pricePerHour: "",
        amenities: "",
        description: "",
      });
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
    setFormData({
      name: venue.name,
      location: venue.location,
      sports: venue.sports.join(", "),
      pricePerHour: venue.pricePerHour.toString(),
      amenities: venue.amenities?.join(", ") || "",
      description: venue.description || "",
    });
    setShowForm(true);
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
      location: "",
      sports: "",
      pricePerHour: "",
      amenities: "",
      description: "",
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading venues...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-deep-slate">My Venues</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-power-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            + Add Venue
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card rounded-lg p-6 border border-border mb-6">
          <h2 className="text-xl font-bold mb-4 text-deep-slate">
            {editingVenue ? "Edit Venue" : "Add New Venue"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Venue Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="e.g., Elite Sports Arena"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="e.g., Mumbai, Maharashtra"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sports (comma-separated) *
                </label>
                <input
                  type="text"
                  name="sports"
                  value={formData.sports}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="e.g., Cricket, Football, Badminton"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="e.g., 1500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Amenities (comma-separated)
              </label>
              <input
                type="text"
                name="amenities"
                value={formData.amenities}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="e.g., Parking, Changing rooms, Cafeteria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="Describe your venue..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-power-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting
                  ? "Saving..."
                  : editingVenue
                    ? "Update Venue"
                    : "Add Venue"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-muted text-foreground px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Venues List */}
      {venues.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground mb-4">No venues added yet</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-power-orange font-semibold hover:underline"
            >
              Add your first venue
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2 text-deep-slate">
                  {venue.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  📍 {venue.location}
                </p>

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
                  <span className="text-sm text-muted-foreground">/hour</span>
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(venue)}
                    className="flex-1 bg-deep-slate text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
                    className="flex-1 bg-error-red text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
