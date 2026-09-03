"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  adminApi,
  AdminCalendarFreshnessRow,
  AdminDataSourceSubmission,
  DataSourceStatus,
  DataSourceTargetOption,
  DataSourceTargetType,
} from "@/modules/admin/services/admin";
import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";
import { Card } from "@/modules/shared/ui/Card";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const toSportSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

const STATUS_BADGE: Record<DataSourceStatus, string> = {
  PENDING_EXTRACTION: "bg-slate-100 text-slate-700 border border-slate-200",
  EXTRACTION_FAILED: "bg-red-100 text-red-700 border border-red-200",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  APPROVED: "bg-green-100 text-green-700 border border-green-200",
  REJECTED: "bg-slate-100 text-slate-500 border border-slate-200",
};

const TARGET_LABEL: Record<DataSourceTargetType, string> = {
  FEDERATION: "Federation",
  CURATED_TOURNAMENT: "Curated Tournament",
  TOURNAMENT_CALENDAR: "Tournament Calendar",
};

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminDataSourcesPage() {
  const [submissions, setSubmissions] = useState<AdminDataSourceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DataSourceStatus | "ALL">("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState<DataSourceTargetType | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const PAGE_SIZE = 15;

  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await adminApi.listDataSources({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        targetType: targetTypeFilter === "ALL" ? undefined : targetTypeFilter,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setSubmissions(response.data);
        if (response.pagination) {
          setPagination({
            total: response.pagination.total || 0,
            page: response.pagination.page || 1,
            totalPages: response.pagination.totalPages || 1,
          });
        }
        return;
      }
      setError(response.message || "Failed to load data sources.");
    } catch (err) {
      console.error("Failed to load data sources:", err);
      setError("Failed to load data sources.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetTypeFilter, currentPage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Federation & Tournament Data Sources"
        subtitle="Submit a link or PDF for a federation/tournament — AI extracts the fields, you review and approve before anything goes live."
        action={
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="bg-power-orange inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={16} /> Add Source
          </button>
        }
      />

      <CalendarFreshnessCard />

      {showAddForm && (
        <AddSourceForm
          onCreated={() => {
            setShowAddForm(false);
            load();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">{pagination.total} source(s)</div>
        <div className="flex flex-wrap gap-2">
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setCurrentPage(1);
              setTargetTypeFilter(e.target.value as DataSourceTargetType | "ALL");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All target types</option>
            <option value="FEDERATION">Federation</option>
            <option value="CURATED_TOURNAMENT">Curated Tournament</option>
            <option value="TOURNAMENT_CALENDAR">Tournament Calendar</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setCurrentPage(1);
              setStatusFilter(e.target.value as DataSourceStatus | "ALL");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING_EXTRACTION">Pending Extraction</option>
            <option value="EXTRACTION_FAILED">Extraction Failed</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">Loading data sources...</div>
      ) : error ? (
        <Card className="bg-white">
          <div className="space-y-3 py-10 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={load}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : submissions.length === 0 ? (
        <Card className="bg-white">
          <div className="py-12 text-center text-slate-600">No data sources found.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <Link key={s._id} href={`/admin/data-sources/${s._id}`}>
              <Card variant="interactive" className="bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {TARGET_LABEL[s.targetType]}
                      </span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-sm capitalize text-slate-700">{s.sportSlug}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[s.status]}`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {s.sourceKind === "PDF" ? <Upload size={12} /> : <LinkIcon size={12} />}
                      {s.sourceKind === "PDF" ? s.fileName || "Uploaded PDF" : s.sourceUrl}
                    </div>
                    {s.extractionError && (
                      <p className="text-xs text-red-600">{s.extractionError}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FRESHNESS_THRESHOLDS = { freshDays: 45, agingDays: 90 };

function freshnessBadge(lastCheckedAt: string | null): { label: string; className: string } {
  if (!lastCheckedAt) {
    return { label: "Never", className: "bg-red-100 text-red-700 border border-red-200" };
  }
  const days = Math.floor((Date.now() - new Date(lastCheckedAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days < FRESHNESS_THRESHOLDS.freshDays) {
    return {
      label: `${days}d ago`,
      className: "bg-green-100 text-green-700 border border-green-200",
    };
  }
  if (days < FRESHNESS_THRESHOLDS.agingDays) {
    return {
      label: `${days}d ago`,
      className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    };
  }
  return { label: `${days}d ago`, className: "bg-red-100 text-red-700 border border-red-200" };
}

function CalendarFreshnessCard() {
  const [rows, setRows] = useState<AdminCalendarFreshnessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getCalendarFreshness()
      .then((res) => {
        if (res.success && res.data) setRows(res.data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <Card className="bg-white">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock size={16} className="text-slate-500" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Tournament Calendar Freshness
        </h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        There's no longer an automatic refresh — this shows how long it's been since each sport's
        calendar was last updated by an approved Tournament Calendar source.
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => {
          const badge = freshnessBadge(row.lastCheckedAt);
          return (
            <span
              key={row.sportSlug}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${badge.className}`}
            >
              {row.sportName}: {badge.label}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function AddSourceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [targetType, setTargetType] = useState<DataSourceTargetType>("FEDERATION");
  const [sportName, setSportName] = useState(SUPPORTED_SPORT_NAMES[0]);
  const [targets, setTargets] = useState<DataSourceTargetOption[]>([]);
  const [selectedTargetSlug, setSelectedTargetSlug] = useState<string>("__new__");
  const [newFederationSlug, setNewFederationSlug] = useState("");
  const [newTournamentSlug, setNewTournamentSlug] = useState("");
  const [sourceKind, setSourceKind] = useState<"LINK" | "PDF">("LINK");
  const [sourceUrl, setSourceUrl] = useState("");
  const [originUrl, setOriginUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sportSlug = toSportSlug(sportName);
  const needsTarget = targetType !== "TOURNAMENT_CALENDAR";

  useEffect(() => {
    if (!needsTarget) {
      setTargets([]);
      return;
    }
    adminApi
      .listDataSourceTargets(targetType, sportSlug)
      .then((res) => {
        if (res.success && res.data) setTargets(res.data);
      })
      .catch(() => setTargets([]));
  }, [targetType, sportSlug, needsTarget]);

  const uploadPdfIfNeeded = async (): Promise<{ s3Key?: string; fileName?: string }> => {
    if (sourceKind !== "PDF" || !file) return {};
    const uploadRes = await adminApi.getDataSourceUploadUrl(file.name, file.type, sportSlug);
    if (!uploadRes.success || !uploadRes.data) {
      throw new Error(uploadRes.message || "Failed to get upload URL");
    }
    // Plain axios (not the authenticated instance) — this PUT goes straight to S3.
    await axios.put(uploadRes.data.uploadUrl, file, { headers: { "Content-Type": file.type } });
    return { s3Key: uploadRes.data.key, fileName: uploadRes.data.fileName };
  };

  const handleSubmit = async () => {
    if (
      targetType === "FEDERATION" &&
      selectedTargetSlug === "__new__" &&
      !newFederationSlug.trim()
    ) {
      toast.error("Enter a federation slug (e.g. bai).");
      return;
    }
    if (targetType === "CURATED_TOURNAMENT") {
      if (selectedTargetSlug === "__new__" && !newTournamentSlug.trim()) {
        toast.error("Enter a tournament slug.");
        return;
      }
    }
    if (sourceKind === "LINK" && !sourceUrl.trim()) {
      toast.error("Enter a source URL.");
      return;
    }
    if (sourceKind === "PDF" && !file) {
      toast.error("Choose a PDF to upload.");
      return;
    }

    setSubmitting(true);
    try {
      const { s3Key, fileName } = await uploadPdfIfNeeded();

      const federationSlug =
        targetType === "FEDERATION"
          ? selectedTargetSlug === "__new__"
            ? newFederationSlug.trim().toLowerCase()
            : selectedTargetSlug
          : targetType === "CURATED_TOURNAMENT"
            ? selectedTargetSlug === "__new__"
              ? undefined // curated tournament's federationSlug comes from an existing Federation, not created here
              : selectedTargetSlug
            : undefined;

      const tournamentSlug =
        targetType === "CURATED_TOURNAMENT"
          ? selectedTargetSlug === "__new__"
            ? newTournamentSlug.trim().toLowerCase().replace(/\s+/g, "-")
            : selectedTargetSlug
          : undefined;

      const response = await adminApi.createDataSource({
        targetType,
        sportSlug,
        ...(federationSlug ? { federationSlug } : {}),
        ...(tournamentSlug ? { tournamentSlug } : {}),
        sourceKind,
        ...(sourceKind === "LINK" ? { sourceUrl: sourceUrl.trim() } : { s3Key, fileName }),
        ...(originUrl.trim() ? { originUrl: originUrl.trim() } : {}),
      });

      if (response.success && response.data) {
        toast.success("Source submitted — extraction complete.");
        onCreated();
      } else {
        toast.error(response.message || "Failed to submit source.");
      }
    } catch (err) {
      console.error("Failed to submit data source:", err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : "Failed to submit source.");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-4 bg-white">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">New Data Source</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Target Type
          </label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as DataSourceTargetType);
              setSelectedTargetSlug("__new__");
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="FEDERATION">Federation</option>
            <option value="CURATED_TOURNAMENT">Curated Tournament</option>
            <option value="TOURNAMENT_CALENDAR">Tournament Calendar</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sport
          </label>
          <select
            value={sportName}
            onChange={(e) => {
              setSportName(e.target.value);
              setSelectedTargetSlug("__new__");
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {SUPPORTED_SPORT_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsTarget && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {targetType === "FEDERATION" ? "Federation" : "Tournament"}
          </label>
          <select
            value={selectedTargetSlug}
            onChange={(e) => setSelectedTargetSlug(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="__new__">+ Create new</option>
            {targets.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTargetSlug === "__new__" && targetType === "FEDERATION" && (
            <input
              value={newFederationSlug}
              onChange={(e) => setNewFederationSlug(e.target.value)}
              placeholder="New federation slug (e.g. bai)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          )}
          {selectedTargetSlug === "__new__" && targetType === "CURATED_TOURNAMENT" && (
            <input
              value={newTournamentSlug}
              onChange={(e) => setNewTournamentSlug(e.target.value)}
              placeholder="New tournament slug (e.g. india-open-bwf-super-500)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Source
        </label>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setSourceKind("LINK")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              sourceKind === "LINK"
                ? "bg-power-orange text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => setSourceKind("PDF")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              sourceKind === "PDF"
                ? "bg-power-orange text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            PDF Upload
          </button>
        </div>
        {sourceKind === "LINK" ? (
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.badmintonindia.org/tournaments"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        ) : (
          <>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={originUrl}
              onChange={(e) => setOriginUrl(e.target.value)}
              placeholder="Official page this PDF came from (optional, used as the public citation)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Extracting..." : "Submit & Extract"}
        </button>
      </div>
    </Card>
  );
}
