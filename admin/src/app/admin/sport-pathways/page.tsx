"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi, AdminSportPathway } from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Card } from "@/modules/shared/ui/Card";
import { BadgeCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type VerifiedFilter = "ALL" | "true" | "false";

export default function AdminSportPathwaysPage() {
  const [pathways, setPathways] = useState<AdminSportPathway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("ALL");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [pendingToggle, setPendingToggle] = useState<AdminSportPathway | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const PAGE_SIZE = 20;

  const loadPathways = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await adminApi.getPathways({
        search: search.trim() || undefined,
        isVerified: verifiedFilter === "ALL" ? undefined : verifiedFilter,
        page: currentPage,
        limit: PAGE_SIZE,
      });

      if (response.success && response.data) {
        setPathways(response.data);
        if (response.pagination) {
          setPagination({
            total: response.pagination.total || 0,
            page: response.pagination.page || 1,
            totalPages: response.pagination.totalPages || 1,
          });
        }
        return;
      }

      setError(response.message || "Failed to load pathways.");
    } catch (err) {
      console.error("Failed to load pathways:", err);
      setError("Failed to load pathways.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, verifiedFilter]);

  useEffect(() => {
    loadPathways();
  }, [loadPathways]);

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    const nextVerified = !pendingToggle.isVerified;
    try {
      setActionLoading(true);
      await adminApi.setPathwayVerified(pendingToggle._id, nextVerified);
      toast.success(
        nextVerified ? "Pathway marked as verified." : "Verification removed.",
      );
      setPendingToggle(null);
      await loadPathways();
    } catch (err) {
      console.error("Failed to update verification status:", err);
      toast.error("Failed to update verification status.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && pathways.length === 0) {
    return <div className="text-center py-12">Loading sport pathways...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Sport Pathways"
        subtitle="Review AI-generated development pathways and mark them verified once checked against a sport expert's input."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setCurrentPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by sport name..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={verifiedFilter}
          onChange={(e) => {
            setCurrentPage(1);
            setVerifiedFilter(e.target.value as VerifiedFilter);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All pathways</option>
          <option value="true">Verified only</option>
          <option value="false">Unverified only</option>
        </select>
        <span className="text-sm text-slate-600">{pagination.total} total</span>
      </div>

      {error ? (
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadPathways}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : pathways.length === 0 ? (
        <Card className="bg-white">
          <div className="py-12 text-center text-slate-600">No pathways found.</div>
        </Card>
      ) : (
        <Card className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Sport</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lookups</th>
                <th className="px-4 py-3">Last Refreshed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pathways.map((pathway) => (
                <tr key={pathway._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sport-pathways/${pathway._id}`}
                      className="font-semibold text-slate-900 hover:text-power-orange transition-colors"
                    >
                      {pathway.sportName}
                    </Link>
                    {pathway.cacheKey && (
                      <p className="text-xs text-slate-400">{pathway.cacheKey}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{pathway.category || "Other"}</td>
                  <td className="px-4 py-3">
                    {pathway.isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        <BadgeCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{pathway.lookupCount ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {pathway.lastRefreshedAt
                      ? new Date(pathway.lastRefreshedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/sport-pathways/${pathway._id}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setPendingToggle(pathway)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          pathway.isVerified
                            ? "border border-red-300 text-red-700 hover:bg-red-50"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        {pathway.isVerified ? "Unverify" : "Verify"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm text-slate-600 sm:text-left">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, pagination.total)} of {pagination.total}
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
              .slice(Math.max(0, currentPage - 2), Math.min(pagination.totalPages, currentPage + 1))
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
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingToggle)}
        title={pendingToggle?.isVerified ? "Remove verification?" : "Mark pathway as verified?"}
        description={
          pendingToggle
            ? pendingToggle.isVerified
              ? `${pendingToggle.sportName} will show as unverified and become eligible for automatic AI refresh again.`
              : `${pendingToggle.sportName} will show a "Verified by Expert" badge to parents and be protected from automatic AI refresh.`
            : undefined
        }
        confirmLabel={pendingToggle?.isVerified ? "Unverify" : "Verify"}
        variant={pendingToggle?.isVerified ? "danger" : "default"}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
        loading={actionLoading}
      />
    </div>
  );
}
