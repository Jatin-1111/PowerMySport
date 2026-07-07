"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import {
  DetailDrawer,
  DetailRow,
  DetailSection,
} from "@/modules/shared/ui/DetailDrawer";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { Coach, CoachVerificationStatus } from "@/types";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const VERIFICATION_STATUSES: CoachVerificationStatus[] = [
  "UNVERIFIED",
  "PENDING",
  "REVIEW",
  "VERIFIED",
  "REJECTED",
];

interface CoachEditForm {
  bio: string;
  hourlyRate: number;
  verificationStatus: CoachVerificationStatus;
}

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type SortColumn = "name" | "joined" | "rating";
type SortDirection = "asc" | "desc";

const getCoachUser = (coach: Coach): Record<string, unknown> | null =>
  typeof coach.userId === "object" && coach.userId !== null
    ? (coach.userId as Record<string, unknown>)
    : null;

const getCoachName = (coach: Coach): string => {
  const user = getCoachUser(coach);
  return typeof user?.name === "string" ? user.name : "Unnamed coach";
};

const getCoachEmail = (coach: Coach): string => {
  const user = getCoachUser(coach);
  return typeof user?.email === "string" ? user.email : "";
};

const getCoachId = (coach: Coach): string => coach.id || coach._id || "";

const formatDate = (value?: string): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function AdminCoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("joined");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CoachEditForm>({
    bio: "",
    hourlyRate: 0,
    verificationStatus: "UNVERIFIED",
  });
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 12;

  const loadCoaches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getCoaches({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setCoaches(response.data);
        if (response.pagination) setPagination(response.pagination);
        return;
      }
      setError(response.message || "Failed to load coaches.");
    } catch (loadError) {
      console.error("Failed to load coaches:", loadError);
      setError("Failed to load coaches.");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  const openCoach = (coach: Coach) => {
    setSelectedCoach(coach);
    setEditing(false);
    setEditForm({
      bio: coach.bio || "",
      hourlyRate: coach.hourlyRate || 0,
      verificationStatus: coach.verificationStatus || "UNVERIFIED",
    });
  };

  const closeCoach = () => {
    setSelectedCoach(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!selectedCoach) return;
    const coachId = getCoachId(selectedCoach);
    if (!coachId) return;

    setSaving(true);
    try {
      const response = await adminApi.updateCoach(coachId, { ...editForm });
      if (response.success) {
        toast.success("Coach updated.");
        setEditing(false);
        setSelectedCoach(null);
        await loadCoaches();
      } else {
        toast.error(response.message || "Failed to update coach.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update coach.");
    } finally {
      setSaving(false);
    }
  };

  const onSortChange = (column: string) => {
    const col = column as SortColumn;
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "name" ? "asc" : "desc");
    }
  };

  const visibleCoaches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = coaches.filter((coach) => {
      if (!query) return true;
      return (
        getCoachName(coach).toLowerCase().includes(query) ||
        getCoachEmail(coach).toLowerCase().includes(query) ||
        (coach.sports || []).join(" ").toLowerCase().includes(query)
      );
    });

    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (sortColumn === "name") {
        return factor * getCoachName(left).localeCompare(getCoachName(right));
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
  }, [coaches, searchQuery, sortColumn, sortDirection]);

  const columns: AdminDataTableColumn<Coach>[] = [
    {
      key: "name",
      header: "Coach",
      sortable: true,
      render: (c) => (
        <EntityBadge name={getCoachName(c)} email={getCoachEmail(c)} />
      ),
    },
    {
      key: "verification",
      header: "Verification",
      render: (c) => (
        <StatusBadge status={c.verificationStatus || "UNVERIFIED"} />
      ),
    },
    {
      key: "sports",
      header: "Sports",
      render: (c) =>
        c.sports?.length ? (
          <div className="flex flex-wrap gap-1">
            {c.sports.slice(0, 2).map((sport) => (
              <span
                key={sport}
                className="rounded-full bg-power-orange/10 px-2 py-0.5 text-xs font-medium text-power-orange"
              >
                {sport}
              </span>
            ))}
            {c.sports.length > 2 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                +{c.sports.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (c) => <span className="text-slate-700">₹{c.hourlyRate}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      align: "right",
      render: (c) => (
        <span className="text-slate-700">
          {(c.rating ?? 0).toFixed(1)}{" "}
          <span className="text-slate-400">({c.reviewCount ?? 0})</span>
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      render: (c) => (
        <span className="text-slate-600">{formatDate(c.createdAt)}</span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Coaches"
          subtitle="Browse and manage coach accounts on the platform."
        />
        <Card className="bg-white">
          <div className="space-y-3 py-10 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={loadCoaches}
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
        title="Coaches"
        subtitle="Browse and manage coach accounts on the platform."
        action={
          <Link
            href="/admin/coaches/add"
            className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={16} /> Add coach
          </Link>
        }
      />

      <AdminDataTable<Coach>
        columns={columns}
        rows={visibleCoaches}
        getRowKey={(c) => getCoachId(c) || getCoachName(c)}
        loading={loading}
        emptyMessage={
          coaches.length === 0
            ? "Coach accounts created from the admin portal will appear here."
            : "No coaches match your search on this page."
        }
        onRowClick={openCoach}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search this page by name, email, or sport",
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
            filename="coaches.csv"
            rows={visibleCoaches}
            label="Export Page CSV"
            columns={[
              { header: "Name", value: (c) => getCoachName(c) },
              { header: "Email", value: (c) => getCoachEmail(c) },
              {
                header: "Verification Status",
                value: (c) => c.verificationStatus || "UNVERIFIED",
              },
              { header: "Sports", value: (c) => (c.sports || []).join("; ") },
              { header: "Hourly Rate", value: (c) => c.hourlyRate },
              { header: "Rating", value: (c) => c.rating ?? 0 },
              { header: "Reviews", value: (c) => c.reviewCount ?? 0 },
              {
                header: "Joined",
                value: (c) =>
                  c.createdAt ? new Date(c.createdAt).toISOString() : "",
              },
            ]}
          />
        }
      />

      <DetailDrawer
        open={Boolean(selectedCoach)}
        onClose={closeCoach}
        title={selectedCoach ? getCoachName(selectedCoach) : "Coach"}
        subtitle={selectedCoach ? getCoachEmail(selectedCoach) : undefined}
        headerExtra={
          selectedCoach ? (
            <StatusBadge
              status={selectedCoach.verificationStatus || "UNVERIFIED"}
            />
          ) : null
        }
        footer={
          selectedCoach ? (
            editing ? (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Edit coach
                </button>
              </div>
            )
          ) : null
        }
      >
        {selectedCoach && !editing && (
          <>
            <DetailSection title="Overview">
              <DetailRow
                label="Service mode"
                value={selectedCoach.serviceMode || "—"}
              />
              <DetailRow
                label="Hourly rate"
                value={`₹${selectedCoach.hourlyRate}`}
              />
              <DetailRow
                label="Rating"
                value={`${(selectedCoach.rating ?? 0).toFixed(1)} (${selectedCoach.reviewCount ?? 0} reviews)`}
              />
              <DetailRow
                label="Joined"
                value={formatDate(selectedCoach.createdAt)}
              />
              {selectedCoach.ownVenueDetails?.address && (
                <DetailRow
                  label="Own venue"
                  value={selectedCoach.ownVenueDetails.address}
                />
              )}
            </DetailSection>

            <DetailSection title="Bio">
              <p className="text-sm leading-relaxed text-slate-700">
                {selectedCoach.bio || "No bio provided."}
              </p>
            </DetailSection>

            <DetailSection title="Sports">
              {selectedCoach.sports?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCoach.sports.map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
                    >
                      {sport}
                      {selectedCoach.sportPricing?.[sport] != null
                        ? ` · ₹${selectedCoach.sportPricing[sport]}`
                        : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No sports listed.</p>
              )}
            </DetailSection>

            <DetailSection title="Certifications">
              {selectedCoach.certifications?.length ? (
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                  {selectedCoach.certifications.map((cert, index) => (
                    <li key={`${cert}-${index}`}>{cert}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  No certifications listed.
                </p>
              )}
            </DetailSection>

            <DetailSection title="Verification">
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    status={selectedCoach.verificationStatus || "UNVERIFIED"}
                  />
                }
              />
              <DetailRow
                label="Documents"
                value={selectedCoach.verificationDocuments?.length ?? 0}
              />
              <DetailRow
                label="Submitted"
                value={formatDate(selectedCoach.verificationSubmittedAt)}
              />
              <DetailRow
                label="Verified"
                value={formatDate(selectedCoach.verifiedAt)}
              />
              {selectedCoach.verificationNotes && (
                <DetailRow
                  label="Notes"
                  value={selectedCoach.verificationNotes}
                />
              )}
            </DetailSection>
          </>
        )}

        {selectedCoach && editing && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bio
              </label>
              <textarea
                rows={5}
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hourly rate (₹)
                </label>
                <input
                  type="number"
                  value={editForm.hourlyRate}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      hourlyRate: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Verification status
                </label>
                <select
                  value={editForm.verificationStatus}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      verificationStatus: e.target
                        .value as CoachVerificationStatus,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {VERIFICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
