"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { Venue } from "@/types";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 12;

  const loadVenues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getAllVenues({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setVenues(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        return;
      }

      setError(response.message || "Failed to load venues.");
    } catch (error) {
      console.error("Failed to load venues:", error);
      setError("Failed to load venues.");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  if (loading) {
    return <div className="text-center py-12">Loading venues...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="All Venues"
          subtitle="Browse and manage all venues listed on the platform."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadVenues}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="All Venues"
        subtitle="Browse and manage all venues listed on the platform."
      />

      {venues.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No venues yet
            </div>
            <p className="max-w-md text-slate-600">
              Approved venues will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map((venue) => (
              <Card
                key={venue.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-bold mb-2 text-slate-900">
                  {venue.name}
                </h3>
                <p className="text-sm text-slate-600 mb-3 flex items-center gap-1">
                  <MapPin size={16} />
                  {typeof venue.location === "object" &&
                  venue.location.coordinates
                    ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
                    : "Location not available"}
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

                <p className="text-xl font-bold text-power-orange">
                  ₹{venue.pricePerHour}
                  <span className="text-sm text-slate-600">/hour</span>
                </p>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm text-slate-600 sm:text-left">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                {pagination.total} venues
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, currentPage - 2),
                    Math.min(pagination.totalPages, currentPage + 1),
                  )
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                        currentPage === page
                          ? "bg-power-orange text-white"
                          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    setCurrentPage(
                      Math.min(pagination.totalPages, currentPage + 1),
                    )
                  }
                  disabled={currentPage === pagination.totalPages}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
