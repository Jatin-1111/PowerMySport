"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import PublicPageHeader from "@/modules/shared/components/PublicPageHeader";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Coach } from "@/types";
import { Users, IndianRupee, Search, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CoachesPage() {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [sportFilter, setSportFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    setLoading(true);
    try {
      const response = await discoveryApi.searchNearby({});
      if (response.success && response.data) {
        setCoaches(response.data.coaches);
        setFilteredCoaches(response.data.coaches);
      }
    } catch (error) {
      console.error("Failed to load coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (sportFilter) {
      const filtered = coaches.filter((coach) =>
        coach.sports.some((sport) =>
          sport.toLowerCase().includes(sportFilter.toLowerCase()),
        ),
      );
      setFilteredCoaches(filtered);
    } else {
      setFilteredCoaches(coaches);
    }
  };

  return (
    <>
      <PublicPageHeader
        title="Find Expert Coaches"
        subtitle="Learn from experienced coaches. Browse and book training sessions with professionals in your favorite sports."
        icon={Users}
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
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-turf-green/50 bg-white text-slate-900"
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
          {/* Coaches Grid */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-turf-green mx-auto mb-4"></div>
              <p className="text-slate-600">Loading coaches...</p>
            </div>
          ) : filteredCoaches.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <Users size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg">
                {sportFilter
                  ? "No coaches found for that sport"
                  : "No coaches available"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCoaches.map((coach) => (
                <Card
                  key={coach.id}
                  className="bg-white border border-slate-200 hover:border-turf-green hover:shadow-lg transition-all overflow-hidden group"
                >
                  <div className="bg-gradient-to-br from-turf-green/5 to-power-orange/5 p-5 border-b border-slate-200">
                    <div className="mb-3">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {coach.sports[0]} Coach
                      </h3>
                      <p className="text-sm text-slate-600">
                        {coach.sports.join(", ")}
                      </p>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Star
                          size={18}
                          className="text-yellow-500 fill-yellow-500"
                        />
                        <span className="font-bold text-slate-900">
                          {coach.rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        ({coach.reviewCount} reviews)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 bg-turf-green/10 border border-turf-green/30 rounded-full text-turf-green font-semibold">
                        {coach.serviceMode}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Experience/Bio */}
                    <p className="text-sm text-slate-600 mb-5 pb-5 border-b border-slate-200">
                      Expert coach offering professional training sessions to
                      help you improve your skills.
                    </p>

                    {/* Price */}
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Per hour
                      </span>
                      <p className="text-2xl font-bold text-turf-green flex items-center gap-1">
                        <IndianRupee size={20} />
                        {coach.hourlyRate}
                      </p>
                    </div>

                    <Button
                      className="w-full bg-turf-green hover:bg-green-700 text-white"
                      onClick={() =>
                        router.push(`/coaches/${coach.id || coach._id}`)
                      }
                    >
                      <span>Book Coach</span>
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Results Count */}
          {!loading && filteredCoaches.length > 0 && (
            <p className="text-center mt-8 text-slate-600 text-sm">
              Showing {filteredCoaches.length} coach
              {filteredCoaches.length !== 1 ? "es" : ""}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
