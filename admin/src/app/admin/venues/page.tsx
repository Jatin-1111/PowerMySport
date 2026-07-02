"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { Venue } from "@/types";
import { ChevronLeft, ChevronRight, MapPin, Star, Calendar, ImageIcon, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type SortBy = "newest" | "rating_desc" | "price_asc" | "price_desc";

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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const PAGE_SIZE = 12;

  const loadVenues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getAllVenues({
        page: currentPage,
        limit: PAGE_SIZE,
        search: search || undefined,
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
  }, [currentPage, search]);

  useEffect(() => {
    const t = setTimeout(loadVenues, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadVenues, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const visibleVenues = [...venues].sort((left, right) => {
    if (sortBy === "rating_desc") return (right.rating ?? 0) - (left.rating ?? 0);
    if (sortBy === "price_asc") return left.pricePerHour - right.pricePerHour;
    if (sortBy === "price_desc") return right.pricePerHour - left.pricePerHour;
    return (
      new Date(right.createdAt || 0).getTime() -
      new Date(left.createdAt || 0).getTime()
    );
  });

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-power-orange"></div>
      </div>
    );
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

      <Card className="bg-white">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search venues by name..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="rating_desc">Rating (High-Low)</option>
            <option value="price_asc">Price (Low-High)</option>
            <option value="price_desc">Price (High-Low)</option>
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <ExportCsvButton
            filename="venues.csv"
            rows={visibleVenues}
            label="Export Page CSV"
            columns={[
              { header: "Name", value: (v) => v.name },
              { header: "Address", value: (v) => v.address || "" },
              { header: "Price Per Hour", value: (v) => v.pricePerHour },
              { header: "Rating", value: (v) => v.rating ?? 0 },
              {
                header: "Sports",
                value: (v) => (v.sports || []).join("; "),
              },
              {
                header: "Approval Status",
                value: (v) => v.approvalStatus || "",
              },
              {
                header: "Created",
                value: (v) => (v.createdAt ? new Date(v.createdAt).toISOString() : ""),
              },
            ]}
          />
        </div>
      </Card>

      {visibleVenues.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No venues yet
            </div>
            <p className="max-w-md text-slate-600">
              {venues.length === 0
                ? "Approved venues will appear here once they complete onboarding."
                : "No venues match your search."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleVenues.map((venue, venueIndex) => {
              const venueKey =
                venue.id ||
                venue._id ||
                `${venue.name}-${venue.createdAt}-${venueIndex}`;
              
              const imageUrl = venue.coverPhotoUrl || (venue.images && venue.images[0]) || null;
              const joinedDate = venue.createdAt ? new Date(venue.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric"
              }) : "Unknown";

              return (
                <div
                  key={venueKey}
                  className="group flex flex-col overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  {/* Image Header */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={venue.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <ImageIcon className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    {/* Price Badge Overlay */}
                    <div className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                      <p className="text-sm font-bold text-power-orange">
                        ₹{venue.pricePerHour}
                        <span className="text-xs text-slate-500 font-medium">/hr</span>
                      </p>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold leading-tight text-slate-900 line-clamp-1">
                        {venue.name}
                      </h3>
                      {venue.rating ? (
                        <div className="flex shrink-0 items-center gap-1 rounded bg-amber-100/50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {venue.rating.toFixed(1)}
                        </div>
                      ) : (
                        <div className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          New
                        </div>
                      )}
                    </div>

                    <p className="mb-4 flex items-start gap-1.5 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="line-clamp-2 leading-snug">
                        {venue.address || (venue.location?.coordinates ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}` : "Location not available")}
                      </span>
                    </p>

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {venue.sports?.slice(0, 3).map((sport, index) => (
                        <span
                          key={`${venueKey}-${sport}-${index}`}
                          className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
                        >
                          {sport}
                        </span>
                      ))}
                      {venue.sports?.length > 3 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          +{venue.sports.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        Added {joinedDate}
                      </div>
                      
                      <Link 
                        href={`/admin/venues/${venue.id || venue._id || '#'}`}
                        className="flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-power-orange transition-colors"
                      >
                        View
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
              <p className="text-center text-sm text-slate-600 sm:text-left">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                <span className="font-semibold text-slate-900">{pagination.total}</span> venues
              </p>
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        currentPage === page
                          ? "bg-power-orange text-white shadow-sm"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
