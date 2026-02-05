"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { discoveryApi } from "@/lib/discovery";
import { Coach, Venue } from "@/types";
import { useState } from "react";

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
      <h1 className="text-3xl font-bold mb-8 text-slate-900">
        Discover Venues & Coaches
      </h1>

      {/* Search Form */}
      <Card className="bg-white mb-8">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Sport (optional)
            </label>
            <input
              type="text"
              value={searchParams.sport}
              onChange={(e) =>
                setSearchParams({ ...searchParams, sport: e.target.value })
              }
              placeholder="e.g., Cricket"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
            />
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={loading}
          variant="primary"
          className="mt-4"
        >
          {loading ? "Searching..." : "Search"}
        </Button>
      </Card>

      {/* Results */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Venues */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">
            Venues ({venues.length})
          </h2>
          <div className="space-y-4">
            {venues.map((venue) => (
              <Card
                key={venue.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  {venue.name}
                </h3>
                <p className="text-sm text-slate-600 mb-2">
                  {venue.sports.join(", ")}
                </p>
                <p className="text-power-orange font-bold">
                  ₹{venue.pricePerHour}/hour
                </p>
              </Card>
            ))}
            {venues.length === 0 && !loading && (
              <p className="text-slate-600 text-center py-8">No venues found</p>
            )}
          </div>
        </div>

        {/* Coaches */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">
            Coaches ({coaches.length})
          </h2>
          <div className="space-y-4">
            {coaches.map((coach) => (
              <Card
                key={coach.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  Coach ID: {coach.id}
                </h3>
                <p className="text-sm text-slate-600 mb-2">
                  {coach.sports.join(", ")}
                </p>
                <p className="text-sm text-slate-600 mb-2">
                  {coach.serviceMode}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-power-orange font-bold">
                    ₹{coach.hourlyRate}/hour
                  </p>
                  <p className="text-sm text-slate-600">
                    ⭐ {coach.rating.toFixed(1)} ({coach.reviewCount})
                  </p>
                </div>
              </Card>
            ))}
            {coaches.length === 0 && !loading && (
              <p className="text-slate-600 text-center py-8">
                No coaches found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
