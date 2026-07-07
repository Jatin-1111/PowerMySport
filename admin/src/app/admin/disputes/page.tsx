"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileSearch,
  Gavel,
  Loader2,
  RefreshCw,
  Search,
  ShieldOff,
  SplitSquareHorizontal,
  User,
  XCircle,
} from "lucide-react";

type DisputeType = "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
type Resolution = "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND";
type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

interface Dispute {
  id: string;
  bookingId: string;
  playerName: string;
  playerEmail: string;
  venueName: string;
  amount: number;
  disputeType: DisputeType;
  status: DisputeStatus;
  description: string;
  evidence?: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: Resolution;
  refundAmount?: number;
}

const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  NO_SHOW: "No Show",
  POOR_QUALITY: "Poor Quality",
  PAYMENT_ISSUE: "Payment Issue",
  OTHER: "Other",
};

const DISPUTE_TYPE_ICONS: Record<
  DisputeType,
  React.ComponentType<{ className?: string }>
> = {
  NO_SHOW: Ban,
  POOR_QUALITY: ShieldOff,
  PAYMENT_ISSUE: CircleDollarSign,
  OTHER: AlertTriangle,
};

const DISPUTE_TYPE_COLORS: Record<DisputeType, string> = {
  NO_SHOW: "bg-red-100 text-red-700 border-red-200",
  POOR_QUALITY: "bg-amber-100 text-amber-700 border-amber-200",
  PAYMENT_ISSUE: "bg-purple-100 text-purple-700 border-purple-200",
  OTHER: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_COLORS: Record<DisputeStatus, string> = {
  OPEN: "bg-red-50 text-red-700 border-red-200",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "ALL">(
    "ALL",
  );
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionForm, setResolutionForm] = useState({
    resolution: "FULL_REFUND" as Resolution,
    reason: "",
    evidence: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    resolution: "FULL_REFUND" as Resolution,
    reason: "",
    evidence: "",
  });

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getDisputes();
      if (response.success && response.data) {
        // Map backend Dispute model to frontend UI model
        const mappedDisputes = response.data.map((d: any) => ({
          id: d._id || d.id,
          bookingId: d.bookingId?._id || d.bookingId || "",
          playerName: d.userId
            ? `${d.userId.firstName || ""} ${d.userId.lastName || ""}`.trim()
            : "Unknown User",
          playerEmail: d.userId?.email || "N/A",
          venueName: d.bookingId?.venueId?.name || "N/A",
          amount: d.bookingId?.totalAmount || 0,
          disputeType: d.disputeType,
          status: d.status,
          description: d.disputeDetails || d.reasoning || "",
          evidence: d.evidence || "",
          createdAt: d.createdAt,
          resolvedAt: d.status === "RESOLVED" ? d.updatedAt : undefined,
          resolution: d.recommendedAction,
          refundAmount: d.refundPercentage
            ? (d.bookingId?.totalAmount || 0) * (d.refundPercentage / 100)
            : 0,
        }));
        setDisputes(mappedDisputes);
      } else {
        setDisputes([]);
      }
    } catch {
      toast.error("Failed to load disputes");
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (dispute: Dispute) => {
    if (!resolutionForm.reason.trim()) {
      toast.error("Please provide a resolution reason");
      return;
    }

    setResolving(dispute.id);
    try {
      await adminApi.handleDispute(dispute.bookingId, {
        disputeType: dispute.disputeType,
        resolution: resolutionForm.resolution,
        evidence: resolutionForm.evidence || undefined,
      });

      toast.success(
        `Dispute resolved — ${resolutionForm.resolution.replace(/_/g, " ").toLowerCase()} applied`,
      );
      setSelectedDispute(null);
      setResolutionForm({
        resolution: "FULL_REFUND",
        reason: "",
        evidence: "",
      });

      // Update local state
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === dispute.id
            ? {
                ...d,
                status: "RESOLVED",
                resolution: resolutionForm.resolution,
                resolvedAt: new Date().toISOString(),
                refundAmount:
                  resolutionForm.resolution === "FULL_REFUND"
                    ? d.amount
                    : resolutionForm.resolution === "PARTIAL_REFUND"
                      ? Math.round(d.amount * 0.5)
                      : 0,
              }
            : d,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to resolve dispute",
      );
    } finally {
      setResolving(null);
    }
  };

  const toggleSelected = (disputeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(disputeId)) {
        next.delete(disputeId);
      } else {
        next.add(disputeId);
      }
      return next;
    });
  };

  const handleBulkResolve = async () => {
    if (!bulkForm.reason.trim()) {
      toast.error("Please provide a resolution reason");
      return;
    }

    const targets = disputes.filter((d) => selectedIds.has(d.id));
    if (targets.length === 0) return;

    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map((d) =>
          adminApi.handleDispute(d.bookingId, {
            disputeType: d.disputeType,
            resolution: bulkForm.resolution,
            evidence: bulkForm.evidence || undefined,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = targets.length - failed;
      const resolvedIds = new Set(
        targets
          .filter((_, index) => results[index].status === "fulfilled")
          .map((d) => d.id),
      );

      if (succeeded > 0) {
        toast.success(
          `Resolved ${succeeded} dispute${succeeded === 1 ? "" : "s"} — ${bulkForm.resolution.replace(/_/g, " ").toLowerCase()} applied`,
        );
        setDisputes((prev) =>
          prev.map((d) =>
            resolvedIds.has(d.id)
              ? {
                  ...d,
                  status: "RESOLVED",
                  resolution: bulkForm.resolution,
                  resolvedAt: new Date().toISOString(),
                  refundAmount:
                    bulkForm.resolution === "FULL_REFUND"
                      ? d.amount
                      : bulkForm.resolution === "PARTIAL_REFUND"
                        ? Math.round(d.amount * 0.5)
                        : 0,
                }
              : d,
          ),
        );
      }
      if (failed > 0) {
        toast.error(
          `Failed to resolve ${failed} dispute${failed === 1 ? "" : "s"}`,
        );
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        resolvedIds.forEach((id) => next.delete(id));
        return next;
      });
      setBulkModalOpen(false);
      setBulkForm({ resolution: "FULL_REFUND", reason: "", evidence: "" });
    } finally {
      setBulkBusy(false);
    }
  };

  const filtered = disputes.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bookingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.venueName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const actionableFiltered = filtered.filter((d) => d.status !== "RESOLVED");

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === actionableFiltered.length
        ? new Set()
        : new Set(actionableFiltered.map((d) => d.id)),
    );
  };

  const stats = {
    open: disputes.filter((d) => d.status === "OPEN").length,
    underReview: disputes.filter((d) => d.status === "UNDER_REVIEW").length,
    resolved: disputes.filter((d) => d.status === "RESOLVED").length,
    totalAmount: disputes.reduce((sum, d) => sum + d.amount, 0),
  };

  return (
    <div>
      <AdminPageHeader
        title="Dispute Management"
        subtitle="Review and resolve player disputes with venues and bookings"
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Open Disputes",
            value: stats.open,
            color: "text-red-600",
            bg: "bg-red-50 border-red-100",
            icon: XCircle,
          },
          {
            label: "Under Review",
            value: stats.underReview,
            color: "text-amber-600",
            bg: "bg-amber-50 border-amber-100",
            icon: FileSearch,
          },
          {
            label: "Resolved",
            value: stats.resolved,
            color: "text-emerald-600",
            bg: "bg-emerald-50 border-emerald-100",
            icon: BadgeCheck,
          },
          {
            label: "Total Amount",
            value: `₹${stats.totalAmount.toLocaleString("en-IN")}`,
            color: "text-indigo-600",
            bg: "bg-indigo-50 border-indigo-100",
            icon: CircleDollarSign,
          },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border p-5 ${bg}`}>
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <p className="text-sm font-medium text-slate-500">{label}</p>
            </div>
            <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by player, booking ID, venue…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "OPEN", "UNDER_REVIEW", "RESOLVED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "border-indigo-300 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s === "ALL"
                ? "All"
                : s === "UNDER_REVIEW"
                  ? "Under Review"
                  : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button
          onClick={loadDisputes}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {actionableFiltered.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={
                selectedIds.size > 0 &&
                selectedIds.size === actionableFiltered.length
              }
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300"
            />
            Select all actionable ({actionableFiltered.length})
          </label>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-indigo-700">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setBulkModalOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Resolve Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Disputes List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Gavel className="mb-4 h-14 w-14 text-slate-300" />
          <p className="text-lg font-semibold text-slate-600">
            No disputes found
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {statusFilter !== "ALL"
              ? "Try changing the filter"
              : "All clear — no disputes to review"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((dispute) => {
            const TypeIcon = DISPUTE_TYPE_ICONS[dispute.disputeType];
            const isExpanded = expandedId === dispute.id;
            return (
              <div
                key={dispute.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Header row */}
                <div className="flex items-start gap-4 p-5">
                  {dispute.status !== "RESOLVED" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(dispute.id)}
                      onChange={() => toggleSelected(dispute.id)}
                      className="mt-3 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                  )}
                  <div className="shrink-0 rounded-xl bg-slate-100 p-2.5">
                    <TypeIcon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DISPUTE_TYPE_COLORS[dispute.disputeType]}`}
                      >
                        {DISPUTE_TYPE_LABELS[dispute.disputeType]}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[dispute.status]}`}
                      >
                        {dispute.status === "UNDER_REVIEW"
                          ? "Under Review"
                          : dispute.status.charAt(0) +
                            dispute.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {dispute.bookingId} — {dispute.venueName}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {dispute.playerName}
                      </span>
                      <span>₹{dispute.amount.toLocaleString("en-IN")}</span>
                      <span>
                        {new Date(dispute.createdAt).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {dispute.status !== "RESOLVED" && (
                      <button
                        onClick={() => setSelectedDispute(dispute)}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : dispute.id)
                      }
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Player's Description
                      </p>
                      <p className="text-sm text-slate-700">
                        {dispute.description}
                      </p>
                    </div>
                    {dispute.evidence && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Evidence
                        </p>
                        <p className="text-sm text-slate-700">
                          {dispute.evidence}
                        </p>
                      </div>
                    )}
                    {dispute.status === "RESOLVED" && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold text-emerald-700 mb-1">
                          Resolution
                        </p>
                        <p className="text-sm font-semibold text-emerald-800">
                          {dispute.resolution?.replace(/_/g, " ")}
                          {dispute.refundAmount
                            ? ` — ₹${dispute.refundAmount.toLocaleString("en-IN")} refunded`
                            : ""}
                        </p>
                        {dispute.resolvedAt && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Resolved{" "}
                            {new Date(dispute.resolvedAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2.5">
                  <Gavel className="h-5 w-5 text-indigo-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Resolve Dispute
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedDispute.bookingId} · ₹
                    {selectedDispute.amount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Dispute summary */}
            <div className="mx-6 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Dispute
              </p>
              <p className="text-sm text-slate-700">
                {selectedDispute.description}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DISPUTE_TYPE_COLORS[selectedDispute.disputeType]}`}
                >
                  {DISPUTE_TYPE_LABELS[selectedDispute.disputeType]}
                </span>
                <span className="text-xs text-slate-500">
                  Raised by {selectedDispute.playerName}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4 px-6 py-4">
              {/* Resolution type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: "FULL_REFUND",
                        label: "Full Refund",
                        sublabel: `₹${selectedDispute.amount.toLocaleString("en-IN")}`,
                        icon: BadgeCheck,
                        color:
                          "border-emerald-300 bg-emerald-50 text-emerald-800",
                      },
                      {
                        value: "PARTIAL_REFUND",
                        label: "Partial Refund",
                        sublabel: `₹${Math.round(selectedDispute.amount * 0.5).toLocaleString("en-IN")}`,
                        icon: SplitSquareHorizontal,
                        color: "border-amber-300 bg-amber-50 text-amber-800",
                      },
                      {
                        value: "NO_REFUND",
                        label: "No Refund",
                        sublabel: "₹0",
                        icon: XCircle,
                        color: "border-red-300 bg-red-50 text-red-800",
                      },
                    ] as const
                  ).map(({ value, label, sublabel, icon: Icon, color }) => (
                    <button
                      key={value}
                      onClick={() =>
                        setResolutionForm((f) => ({ ...f, resolution: value }))
                      }
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                        resolutionForm.resolution === value
                          ? color +
                            " ring-2 ring-offset-1 ring-current/30 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-xs opacity-70">{sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Resolution Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this resolution was chosen…"
                  value={resolutionForm.reason}
                  onChange={(e) =>
                    setResolutionForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Evidence */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Evidence Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="Reference to attached evidence…"
                  value={resolutionForm.evidence}
                  onChange={(e) =>
                    setResolutionForm((f) => ({
                      ...f,
                      evidence: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => {
                  setSelectedDispute(null);
                  setResolutionForm({
                    resolution: "FULL_REFUND",
                    reason: "",
                    evidence: "",
                  });
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(selectedDispute)}
                disabled={!!resolving || !resolutionForm.reason.trim()}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resolving === selectedDispute.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="h-4 w-4" />
                )}
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Resolution Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2.5">
                  <Gavel className="h-5 w-5 text-indigo-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Resolve {selectedIds.size} Dispute
                    {selectedIds.size === 1 ? "" : "s"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    The same resolution will be applied to every selected
                    dispute.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Resolution
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: "FULL_REFUND",
                        label: "Full Refund",
                        icon: BadgeCheck,
                        color:
                          "border-emerald-300 bg-emerald-50 text-emerald-800",
                      },
                      {
                        value: "PARTIAL_REFUND",
                        label: "Partial Refund",
                        icon: SplitSquareHorizontal,
                        color: "border-amber-300 bg-amber-50 text-amber-800",
                      },
                      {
                        value: "NO_REFUND",
                        label: "No Refund",
                        icon: XCircle,
                        color: "border-red-300 bg-red-50 text-red-800",
                      },
                    ] as const
                  ).map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      onClick={() =>
                        setBulkForm((f) => ({ ...f, resolution: value }))
                      }
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                        bulkForm.resolution === value
                          ? color +
                            " ring-2 ring-offset-1 ring-current/30 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Resolution Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this resolution was chosen…"
                  value={bulkForm.reason}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Evidence Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="Reference to attached evidence…"
                  value={bulkForm.evidence}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, evidence: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => {
                  setBulkModalOpen(false);
                  setBulkForm({
                    resolution: "FULL_REFUND",
                    reason: "",
                    evidence: "",
                  });
                }}
                disabled={bulkBusy}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkResolve}
                disabled={bulkBusy || !bulkForm.reason.trim()}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="h-4 w-4" />
                )}
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
