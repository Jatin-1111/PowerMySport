"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import PublicPageHeader from "@/modules/shared/components/PublicPageHeader";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Venue } from "@/types";
import {
  Building2,
  IndianRupee,
  MapPin,
  Search,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function VenuesPage() {
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [sportFilter, setSportFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const response = await discoveryApi.searchNearby({});
      if (response.success && response.data) {
        setVenues(response.data.venues);
        setFilteredVenues(response.data.venues);
      }
    } catch (error) {
      console.error("Failed to load venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (sportFilter) {
      const filtered = venues.filter((venue) =>
        venue.sports.some((sport) =>
          sport.toLowerCase().includes(sportFilter.toLowerCase()),
        ),
      );
      setFilteredVenues(filtered);
    } else {
      setFilteredVenues(venues);
    }
  };

  const getDisplayPrice = (venue: Venue) => {
    if (venue.sportPricing) {
      const values = Object.values(venue.sportPricing).filter(
        (value) => typeof value === "number" && value >= 0,
      );
      if (values.length > 0) {
        return Math.min(...values);
      }
    }
    return venue.pricePerHour;
  };

  return (
    <>
      <PublicPageHeader
        title="Discover Venues"
        subtitle="Browse and book from our collection of premium sports venues. Find the perfect space for your next game."
        icon={Building2}
      >
        <div className="max-w-2xl">
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                placeholder="Search by sport (e.g. Cricket, Tennis, Basketball)..."
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="whitespace-nowrap"
            >
              Search
            </Button>
          </form>
        </div>
      </PublicPageHeader>

      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-12">
          {/* Venues Grid */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange mx-auto mb-4"></div>
              <p className="text-slate-600">Loading venues...</p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg">
                {sportFilter
                  ? "No venues found for that sport"
                  : "No venues available"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVenues.map((venue) => (
                <Card
                  key={venue.id}
                  className="bg-white border border-slate-200 hover:border-power-orange hover:shadow-lg transition-all overflow-hidden group"
                >
                  {venue.images && venue.images.length > 0 && (
                    <div className="h-48 w-full overflow-hidden bg-slate-200">
                      <img
                        src={venue.images[0]}
                        alt={venue.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-900 mb-3">
                      {venue.name}
                    </h3>

                    <div className="space-y-3 mb-5 pb-5 border-b border-slate-200">
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <MapPin
                          size={16}
                          className="text-power-orange flex-shrink-0"
                        />
                        {venue.location
                          ? `${venue.location.coordinates[1].toFixed(3)}°N, ${venue.location.coordinates[0].toFixed(3)}°E`
                          : "Location available"}
                      </p>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">
                          Sports:
                        </span>{" "}
                        {venue.sports.join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Price per hour
                        </p>
                        <p className="text-2xl font-bold text-power-orange flex items-center gap-1 mt-1">
                          <IndianRupee size={20} />
                          {getDisplayPrice(venue)}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      variant="primary"
                      onClick={() =>
                        router.push(`/venues/${venue.id || venue._id}`)
                      }
                    >
                      <span>Book Now</span>
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Results Count */}
          {!loading && filteredVenues.length > 0 && (
            <p className="text-center mt-8 text-slate-600 text-sm">
              Showing {filteredVenues.length} venue
              {filteredVenues.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
