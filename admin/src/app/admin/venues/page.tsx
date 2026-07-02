"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import {
  DetailDrawer,
  DetailRow,
  DetailSection,
} from "@/modules/shared/ui/DetailDrawer";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { Venue } from "@/types";
import { formatCurrency } from "@/utils/format";
import { ImageIcon, MapPin, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type SortColumn = "name" | "price" | "rating" | "added";
type SortDirection = "asc" | "desc";

const getVenueId = (venue: Venue): string => venue.id || venue._id || "";

const getVenueImage = (venue: Venue): string | null =>
  venue.coverPhotoUrl || (venue.images && venue.images[0]) || null;

const getVenueLocation = (venue: Venue): string =>
  venue.address ||
  (venue.location?.coordinates
    ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
    : "Location not available");

const formatDate = (value?: string): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

function VenueThumb({ venue, size = 40 }: { venue: Venue; size?: number }) {
  const imageUrl = getVenueImage(venue);
  if (!imageUrl) {
    return (
      <div
        className="flex items-center justify-center rounded bg-slate-100"
        style={{ height: size, width: size }}
      >
        <ImageIcon className="h-4 w-4 text-slate-300" />
      </div>
    );
  }
  return (
    <Image
      src={imageUrl}
      alt={venue.name}
      width={size}
      height={size}
      className="rounded object-cover"
      style={{ height: size, width: size }}
    />
  );
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
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("added");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
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
        if (response.pagination) setPagination(response.pagination);
        return;
      }
      setError(response.message || "Failed to load venues.");
    } catch (loadError) {
      console.error("Failed to load venues:", loadError);
      setError("Failed to load venues.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    const timer = setTimeout(loadVenues, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadVenues, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const onSortChange = (column: string) => {
    const col = column as SortColumn;
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "name" ? "asc" : "desc");
    }
  };

  const visibleVenues = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    return [...venues].sort((left, right) => {
      if (sortColumn === "name") {
        return factor * left.name.localeCompare(right.name);
      }
      if (sortColumn === "price") {
        return factor * (left.pricePerHour - right.pricePerHour);
      }
      if (sortColumn === "rating") {
        return factor * ((left.rating ?? 0) - (right.rating ?? 0));
      }
      return (
        factor *
        (new Date(left.createdAt || 0).getTime() -
          new Date(right.createdAt || 0).getTime())
      );
    });
  }, [venues, sortColumn, sortDirection]);

  const columns: AdminDataTableColumn<Venue>[] = [
    {
      key: "name",
      header: "Venue",
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-3">
          <VenueThumb venue={v} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{v.name}</p>
            <p className="truncate text-xs text-slate-500">
              {getVenueLocation(v)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "approval",
      header: "Approval",
      render: (v) => <StatusBadge status={v.approvalStatus || "PENDING"} />,
    },
    {
      key: "price",
      header: "Price / hr",
      sortable: true,
      align: "right",
      render: (v) => (
        <span className="text-slate-700">{formatCurrency(v.pricePerHour)}</span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      align: "right",
      render: (v) =>
        v.rating ? (
          <span className="inline-flex items-center gap-1 text-slate-700">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {v.rating.toFixed(1)}
            <span className="text-slate-400">({v.reviewCount ?? 0})</span>
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase text-slate-400">
            New
          </span>
        ),
    },
    {
      key: "sports",
      header: "Sports",
      render: (v) =>
        v.sports?.length ? (
          <div className="flex flex-wrap gap-1">
            {v.sports.slice(0, 2).map((sport) => (
              <span
                key={sport}
                className="rounded-full bg-power-orange/10 px-2 py-0.5 text-xs font-medium text-power-orange"
              >
                {sport}
              </span>
            ))}
            {v.sports.length > 2 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                +{v.sports.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "added",
      header: "Added",
      sortable: true,
      render: (v) => (
        <span className="text-slate-600">{formatDate(v.createdAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="All Venues"
          subtitle="Browse and manage all venues listed on the platform."
        />
        <Card className="bg-white">
          <div className="space-y-3 py-10 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={loadVenues}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
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

      <AdminDataTable<Venue>
        columns={columns}
        rows={visibleVenues}
        getRowKey={(v) => getVenueId(v) || v.name}
        loading={loading}
        emptyMessage={
          search
            ? "No venues match your search."
            : "Approved venues will appear here once they complete onboarding."
        }
        onRowClick={setSelectedVenue}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search venues by name...",
        }}
        sort={{
          column: sortColumn,
          direction: sortDirection,
          onChange: onSortChange,
        }}
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          total: pagination.total,
          onPageChange: setCurrentPage,
        }}
        toolbarExtra={
          <ExportCsvButton
            filename="venues.csv"
            rows={visibleVenues}
            label="Export Page CSV"
            columns={[
              { header: "Name", value: (v) => v.name },
              { header: "Address", value: (v) => v.address || "" },
              { header: "Price Per Hour", value: (v) => v.pricePerHour },
              { header: "Rating", value: (v) => v.rating ?? 0 },
              { header: "Reviews", value: (v) => v.reviewCount ?? 0 },
              { header: "Sports", value: (v) => (v.sports || []).join("; ") },
              {
                header: "Approval Status",
                value: (v) => v.approvalStatus || "",
              },
              {
                header: "Created",
                value: (v) =>
                  v.createdAt ? new Date(v.createdAt).toISOString() : "",
              },
            ]}
          />
        }
      />

      <DetailDrawer
        open={Boolean(selectedVenue)}
        onClose={() => setSelectedVenue(null)}
        title={selectedVenue?.name || "Venue"}
        subtitle={selectedVenue ? getVenueLocation(selectedVenue) : undefined}
        headerExtra={
          selectedVenue ? (
            <StatusBadge status={selectedVenue.approvalStatus || "PENDING"} />
          ) : null
        }
        footer={
          selectedVenue ? (
            <div className="flex justify-end">
              <Link
                href={`/admin/venues/${getVenueId(selectedVenue) || "#"}`}
                className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                Open full page
              </Link>
            </div>
          ) : null
        }
      >
        {selectedVenue && (
          <>
            <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100">
              {getVenueImage(selectedVenue) ? (
                <Image
                  src={getVenueImage(selectedVenue) as string}
                  alt={selectedVenue.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </div>

            <DetailSection title="Overview">
              <DetailRow
                label="Approval"
                value={
                  <StatusBadge
                    status={selectedVenue.approvalStatus || "PENDING"}
                  />
                }
              />
              <DetailRow
                label="Price / hr"
                value={formatCurrency(selectedVenue.pricePerHour)}
              />
              <DetailRow
                label="Rating"
                value={`${(selectedVenue.rating ?? 0).toFixed(1)} (${selectedVenue.reviewCount ?? 0} reviews)`}
              />
              <DetailRow
                label="External coaches"
                value={selectedVenue.allowExternalCoaches ? "Allowed" : "No"}
              />
              <DetailRow
                label="Added"
                value={formatDate(selectedVenue.createdAt)}
              />
              {selectedVenue.rejectionReason && (
                <DetailRow
                  label="Rejection reason"
                  value={selectedVenue.rejectionReason}
                />
              )}
            </DetailSection>

            <DetailSection title="Location">
              <p className="flex items-start gap-1.5 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {getVenueLocation(selectedVenue)}
              </p>
            </DetailSection>

            <DetailSection title="Sports & pricing">
              {selectedVenue.sports?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedVenue.sports.map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
                    >
                      {sport}
                      {selectedVenue.sportPricing?.[sport] != null
                        ? ` · ₹${selectedVenue.sportPricing[sport]}`
                        : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No sports listed.</p>
              )}
            </DetailSection>

            <DetailSection title="Amenities">
              {selectedVenue.amenities?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedVenue.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No amenities listed.</p>
              )}
            </DetailSection>

            {selectedVenue.description && (
              <DetailSection title="Description">
                <p className="text-sm leading-relaxed text-slate-700">
                  {selectedVenue.description}
                </p>
              </DetailSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
