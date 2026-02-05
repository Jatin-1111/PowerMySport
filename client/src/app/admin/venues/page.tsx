"use client";

import { Card } from "@/components/ui/Card";
import { statsApi } from "@/lib/stats";
import { Venue } from "@/types";
import { useEffect, useState } from "react";

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVenues = async () => {
      try {
        const response = await statsApi.getAllVenues();
        if (response.success && response.data) {
          setVenues(response.data);
        }
      } catch (error) {
        console.error("Failed to load venues:", error);
      } finally {
        setLoading(false);
      }
    };

    loadVenues();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading venues...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">All Venues</h1>

      {venues.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600">No venues listed yet</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <Card
              key={venue.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-bold mb-2 text-slate-900">
                {venue.name}
              </h3>
              <p className="text-sm text-slate-600 mb-3">📍 {venue.location}</p>

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

              <p className="text-xl font-bold text-power-orange">
                ₹{venue.pricePerHour}
                <span className="text-sm text-slate-600">/hour</span>
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
