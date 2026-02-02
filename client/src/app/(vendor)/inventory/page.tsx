"use client";

import React, { useEffect, useState } from "react";
import { Venue } from "@/types";
import { venueApi } from "@/lib/venue";

export default function InventoryPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    sports: "",
    pricePerHour: "",
    amenities: "",
    description: "",
  });

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const response = await venueApi.getMyVenues();
        if (response.success && response.data) {
          setVenues(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch venues:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVenues();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const venuePayload = {
        name: formData.name,
        location: formData.location,
        sports: formData.sports.split(",").map((s) => s.trim()),
        pricePerHour: parseFloat(formData.pricePerHour),
        amenities: formData.amenities.split(",").map((a) => a.trim()),
        description: formData.description,
      };

      const response = await venueApi.createVenue(venuePayload);
      if (response.success && response.data) {
        setVenues([...venues, response.data]);
        setFormData({
          name: "",
          location: "",
          sports: "",
          pricePerHour: "",
          amenities: "",
          description: "",
        });
        setShowForm(false);
      }
    } catch (error) {
      console.error("Failed to create venue:", error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading venues...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Venue Inventory</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "➕ Add Venue"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg p-6 shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Create New Venue</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Venue Name"
              required
              className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Location"
              required
              className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              name="sports"
              value={formData.sports}
              onChange={handleChange}
              placeholder="Sports (comma separated)"
              required
              className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              name="pricePerHour"
              value={formData.pricePerHour}
              onChange={handleChange}
              placeholder="Price Per Hour"
              required
              className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              name="amenities"
              value={formData.amenities}
              onChange={handleChange}
              placeholder="Amenities (comma separated)"
              className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Description"
              className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
            <button
              type="submit"
              className="col-span-2 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700"
            >
              Create Venue
            </button>
          </form>
        </div>
      )}

      {venues.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">
            No venues yet. Create one to get started!
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <div key={venue.id} className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold mb-2">{venue.name}</h3>
              <p className="text-gray-600">📍 {venue.location}</p>
              <p className="text-gray-600">🏆 {venue.sports.join(", ")}</p>
              <p className="text-gray-600 font-semibold mt-2">
                ₹{venue.pricePerHour}/hour
              </p>
              <p className="text-gray-600 text-sm mt-2">{venue.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
