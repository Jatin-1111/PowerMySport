"use client";

import React, { useState, useEffect } from "react";
import { Venue } from "@/types";
import { venueApi } from "@/lib/venue";
import Link from "next/link";

export default function SearchPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const response = await venueApi.getAllVenues();
      if (response.success && response.data) {
        setVenues(response.data);
      }
    } catch (error) {
      console.error("Failed to load venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.sports.some((sport) =>
        sport.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading venues...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">Search Venues</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by venue name or sport..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
        />
      </div>

      {/* Venues Grid */}
      {filteredVenues.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">
            {searchTerm
              ? "No venues found matching your search"
              : "No venues available"}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <div
              key={venue.id}
              className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Venue Image */}
              {venue.images && venue.images.length > 0 ? (
                <img
                  src={venue.images[0]}
                  alt={venue.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-muted flex items-center justify-center">
                  <span className="text-4xl">🏟️</span>
                </div>
              )}

              {/* Venue Details */}
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2 text-deep-slate">
                  {venue.name}
                </h3>

                {/* Sports */}
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

                {/* Price */}
                <p className="text-2xl font-bold text-power-orange mb-3">
                  ₹{venue.pricePerHour}
                  <span className="text-sm text-muted-foreground">/hour</span>
                </p>

                {/* Description */}
                {venue.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {venue.description}
                  </p>
                )}

                {/* Amenities */}
                {venue.amenities && venue.amenities.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Amenities:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {venue.amenities.slice(0, 3).map((amenity, index) => (
                        <span
                          key={index}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                      {venue.amenities.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{venue.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Book Button */}
                <Link
                  href={`/dashboard/book/${venue.id}`}
                  className="block w-full bg-power-orange text-white text-center py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                >
                  Book Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
