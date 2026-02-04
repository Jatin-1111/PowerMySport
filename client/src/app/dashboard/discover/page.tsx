"use client";

import React, { useState } from "react";
import { discoveryApi } from "@/lib/discovery";
import { Venue, Coach } from "@/types";

export default function DiscoverPage() {
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [searchParams, setSearchParams] = useState({
    latitude: 28.6139, // Default: Delhi
    longitude: 77.209,
    maxDistance: 10,
    sport: "",
  });

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await discoveryApi.searchNearby(searchParams);
      if (response.success && response.data) {
        setVenues(response.data.venues);
        setCoaches(response.data.coaches);
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert("Failed to search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-deep-slate">
        Discover Venues & Coaches
      </h1>

      {/* Search Form */}
      <div className="bg-card rounded-lg p-6 border border-border mb-8">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={searchParams.latitude}
              onChange={(e) =>
                setSearchParams({
                  ...searchParams,
                  latitude: Number(e.target.value),
                })
              }
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Longitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={searchParams.longitude}
              onChange={(e) =>
                setSearchParams({
                  ...searchParams,
                  longitude: Number(e.target.value),
                })
              }
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Distance (km)
            </label>
            <input
              type="number"
              value={searchParams.maxDistance}
              onChange={(e) =>
                setSearchParams({
                  ...searchParams,
                  maxDistance: Number(e.target.value),
                })
              }
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Sport (optional)
            </label>
            <input
              type="text"
              value={searchParams.sport}
              onChange={(e) =>
                setSearchParams({ ...searchParams, sport: e.target.value })
              }
              placeholder="e.g., Cricket"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="mt-4 bg-power-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Results */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Venues */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-deep-slate">
            Venues ({venues.length})
          </h2>
          <div className="space-y-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-foreground">
                  {venue.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {venue.sports.join(", ")}
                </p>
                <p className="text-power-orange font-bold">
                  ₹{venue.pricePerHour}/hour
                </p>
              </div>
            ))}
            {venues.length === 0 && !loading && (
              <p className="text-muted-foreground text-center py-8">
                No venues found
              </p>
            )}
          </div>
        </div>

        {/* Coaches */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-deep-slate">
            Coaches ({coaches.length})
          </h2>
          <div className="space-y-4">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-foreground">
                  Coach ID: {coach.id}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {coach.sports.join(", ")}
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {coach.serviceMode}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-power-orange font-bold">
                    ₹{coach.hourlyRate}/hour
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ⭐ {coach.rating.toFixed(1)} ({coach.reviewCount})
                  </p>
                </div>
              </div>
            ))}
            {coaches.length === 0 && !loading && (
              <p className="text-muted-foreground text-center py-8">
                No coaches found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
