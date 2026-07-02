"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { Coach, CoachVerificationStatus } from "@/types";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

type SortBy = "joined_desc" | "joined_asc" | "name_asc" | "rating_desc";

const getCoachName = (coach: Coach): string => {
  const userInfo =
    typeof coach.userId === "object" && coach.userId !== null
      ? (coach.userId as Record<string, unknown>)
      : null;
  return typeof userInfo?.name === "string" ? userInfo.name : "Unnamed coach";
};

const getCoachEmail = (coach: Coach): string => {
  const userInfo =
    typeof coach.userId === "object" && coach.userId !== null
      ? (coach.userId as Record<string, unknown>)
      : null;
  return typeof userInfo?.email === "string" ? userInfo.email : "";
};

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
  const [sortBy, setSortBy] = useState<SortBy>("joined_desc");
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
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
        if (response.pagination) {
          setPagination(response.pagination);
        }
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

  const openEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setEditForm({
      bio: coach.bio || "",
      hourlyRate: coach.hourlyRate || 0,
      verificationStatus: coach.verificationStatus || "UNVERIFIED",
    });
  };

  const closeEdit = () => {
    setEditingCoach(null);
  };

  const saveEdit = async () => {
    if (!editingCoach) return;
    const coachId = editingCoach.id || editingCoach._id;
    if (!coachId) return;

    setSaving(true);
    try {
      const response = await adminApi.updateCoach(coachId, { ...editForm });
      if (response.success) {
        toast.success("Coach updated.");
        closeEdit();
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

  if (loading) {
    return <div className="py-12 text-center">Loading coaches...</div>;
  }

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

  const visibleCoaches = [...coaches]
    .filter((coach) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      const name = getCoachName(coach).toLowerCase();
      const email = getCoachEmail(coach).toLowerCase();
      const sports = (coach.sports || []).join(" ").toLowerCase();
      return (
        name.includes(query) || email.includes(query) || sports.includes(query)
      );
    })
    .sort((left, right) => {
      if (sortBy === "name_asc") {
        return getCoachName(left).localeCompare(getCoachName(right));
      }
      if (sortBy === "joined_asc") {
        return (
          new Date(left.createdAt || 0).getTime() -
          new Date(right.createdAt || 0).getTime()
        );
      }
      if (sortBy === "rating_desc") {
        return (right.rating ?? 0) - (left.rating ?? 0);
      }
      return (
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime()
      );
    });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Coaches"
        subtitle="Browse and manage coach accounts on the platform."
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {pagination.total} coach{pagination.total === 1 ? "" : "es"} found
        </p>
        <Link
          href="/admin/coaches/add"
          className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <Plus size={16} /> Add coach
        </Link>
      </div>

      <Card className="bg-white">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, email, or sport (this page)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="joined_desc">Newest joined first</option>
            <option value="joined_asc">Oldest joined first</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="rating_desc">Rating (High-Low)</option>
          </select>
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
                value: (c) => (c.createdAt ? new Date(c.createdAt).toISOString() : ""),
              },
            ]}
          />
        </div>
      </Card>

      {visibleCoaches.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              {coaches.length === 0 ? "No coaches yet" : "No matches on this page"}
            </div>
            <p className="max-w-md text-slate-600">
              {coaches.length === 0
                ? "Coach accounts created from the admin portal will appear here."
                : "Try a different search term, or clear the search to see all coaches on this page."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleCoaches.map((coach, coachIndex) => {
            const coachKey =
              coach.id ||
              coach._id ||
              `${coach.bio}-${coach.createdAt}-${coachIndex}`;
            const userInfo =
              typeof coach.userId === "object" && coach.userId !== null
                ? (coach.userId as Record<string, unknown>)
                : null;
            const displayName =
              typeof userInfo?.name === "string"
                ? userInfo.name
                : "Unnamed coach";

            return (
              <Card
                key={coachKey}
                className="bg-white transition-shadow hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {displayName}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {typeof userInfo?.email === "string"
                          ? userInfo.email
                          : "No email"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        {coach.verificationStatus || "UNVERIFIED"}
                      </span>
                      <button
                        onClick={() => openEdit(coach)}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-power-orange"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                  </div>

                  <p className="line-clamp-3 text-sm text-slate-600">
                    {coach.bio || "No bio provided."}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={16} />
                    <span>
                      {coach.serviceMode}
                      {coach.ownVenueDetails?.address
                        ? ` • ${coach.ownVenueDetails.address}`
                        : ""}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {coach.sports?.length ? (
                      coach.sports.map((sport) => (
                        <span
                          key={`${coachKey}-${sport}`}
                          className="rounded-full bg-power-orange/10 px-2 py-1 text-xs font-medium text-power-orange"
                        >
                          {sport}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No sports</span>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p>
                      Rate:{" "}
                      <span className="font-semibold">₹{coach.hourlyRate}</span>
                    </p>
                    <p>
                      Rating:{" "}
                      <span className="font-semibold">{coach.rating ?? 0}</span>
                    </p>
                    <p>
                      Reviews:{" "}
                      <span className="font-semibold">
                        {coach.reviewCount ?? 0}
                      </span>
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm text-slate-600 sm:text-left">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
            {pagination.total} coaches
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
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
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : null}

      {editingCoach && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeEdit}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit coach</h2>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bio
                </label>
                <textarea
                  rows={4}
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
                        verificationStatus: e.target.value as CoachVerificationStatus,
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeEdit}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
