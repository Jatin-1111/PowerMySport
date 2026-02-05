"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { venueApi } from "@/lib/venue";
import { Venue } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

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
        <p className="text-slate-600">Loading venues...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">Search Venues</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by venue name or sport..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
        />
      </div>

      {/* Venues Grid */}
      {filteredVenues.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600">
            {searchTerm
              ? "No venues found matching your search"
              : "No venues available"}
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => (
            <Card
              key={venue.id}
              className="bg-white overflow-hidden hover:shadow-lg transition-shadow p-0"
            >
              {/* Venue Image */}
              {venue.images && venue.images.length > 0 ? (
                <img
                  src={venue.images[0]}
                  alt={venue.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                  <span className="text-4xl">🏟️</span>
                </div>
              )}

              {/* Venue Details */}
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2 text-slate-900">
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
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {venue.description}
                  </p>
                )}

                {/* Amenities */}
                {venue.amenities && venue.amenities.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-600 mb-1">Amenities:</p>
                    <div className="flex flex-wrap gap-1">
                      {venue.amenities.slice(0, 3).map((amenity, index) => (
                        <span
                          key={index}
                          className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700"
                        >
                          {amenity}
                        </span>
                      ))}
                      {venue.amenities.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{venue.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Book Button */}
                <Link href={`/dashboard/book/${venue.id}`}>
                  <Button variant="primary" className="w-full">
                    Book Now
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
