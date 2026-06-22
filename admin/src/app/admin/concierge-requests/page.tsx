"use client";

import { useEffect, useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { conciergeApi, ConciergeRequest } from "@/lib/api/conciergeApi";
import { format } from "date-fns";
import {
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Trophy,
  Bookmark,
  AlertCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  pending: {
    label: "Pending",
    icon: <Clock size={14} />,
    badge: "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700",
  },
  processing: {
    label: "Processing",
    icon: <Loader2 size={14} className="animate-spin" />,
    badge: "inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle size={14} />,
    badge: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle size={14} />,
    badge: "inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return <span className={cfg.badge}>{cfg.icon} {cfg.label}</span>;
}

function RequestRow({ req, onStatusChange, onDownload }: {
  req: ConciergeRequest;
  onStatusChange: (id: string, status: ConciergeRequest["status"], notes?: string) => Promise<void>;
  onDownload: (requestId: string, s3Key: string, fileName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(req.adminNotes || "");
  const [pendingStatus, setPendingStatus] = useState(req.status);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanged = pendingStatus !== req.status || notes !== (req.adminNotes || "");

  const handleSave = async () => {
    setSaving(true);
    await onStatusChange(req._id, pendingStatus, notes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-3">
      {/* Row header */}
      <button
        type="button"
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* User */}
          <div>
            <p className="font-semibold text-slate-900 truncate">{req.userId?.name || "Unknown"}</p>
            <p className="text-xs text-slate-500 truncate">{req.userId?.email || "N/A"}</p>
          </div>
          {/* Request */}
          <div>
            <p className="font-semibold text-slate-900 capitalize truncate">{req.sportSlug} · {req.itemType || "Tournament"}</p>
            <p className="text-xs text-slate-600 truncate">{req.itemName || req.prerequisiteName || "General Request"}</p>
          </div>
          {/* Status + date */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={req.status} />
            <span className="text-xs text-slate-400">{format(new Date(req.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-5 bg-slate-50/40">
          {/* Request details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request Details</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-slate-500 shrink-0">Sport:</span>
                  <span className="font-semibold text-slate-900 capitalize">{req.sportSlug}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-500 shrink-0">Type:</span>
                  <span className="font-semibold text-slate-900 capitalize">{req.itemType || "Tournament"}</span>
                </div>
                {req.itemName && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 shrink-0">For:</span>
                    <span className="font-semibold text-slate-900">{req.itemName}</span>
                  </div>
                )}
                {req.prerequisiteName && (
                  <div className="flex gap-2">
                    <span className="text-slate-500 shrink-0">Prerequisite:</span>
                    <span className="font-semibold text-slate-900">{req.prerequisiteName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Documents Submitted</p>
              {req.documents.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No documents attached</p>
              ) : (
                <div className="space-y-2">
                  {req.documents.map((doc, idx) => (
                    <button
                      key={idx}
                      onClick={() => onDownload(req._id, doc.s3Key, doc.documentName)}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition"
                    >
                      <Download size={13} />
                      <span className="truncate flex-1 text-left">{doc.documentName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action panel — status + notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MessageSquare size={12} /> Admin Response to Parent
            </p>

            {/* Status selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Update Status</label>
              <div className="flex flex-wrap gap-2">
                {(["pending", "processing", "completed", "rejected"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = pendingStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPendingStatus(s)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? s === "completed" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : s === "rejected" ? "bg-red-600 text-white border-red-600 shadow-sm"
                            : s === "processing" ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Notes for Parent{" "}
                <span className="font-normal text-slate-400">(shown in their dashboard)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={
                  pendingStatus === "completed"
                    ? "e.g. Your child's AITA registration ID is IND-2024-XXXXX. It has been linked to your profile. Next step: Register for the upcoming Delhi Sub-Junior tournament at aita.tn.nic.in before March 15."
                    : pendingStatus === "rejected"
                    ? "e.g. We were unable to process this request because the birth certificate provided was unclear. Please resubmit with a legible copy."
                    : pendingStatus === "processing"
                    ? "e.g. We have received your documents and are processing your BCCI registration. Estimated time: 3-5 business days."
                    : "Add any notes or updates for the parent..."
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none transition"
              />
              <p className="mt-1 text-[10px] text-slate-400 text-right">{notes.length}/2000</p>
            </div>

            {/* Suggested next-step templates */}
            {pendingStatus === "completed" && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1">
                  <Trophy size={12} /> Suggested Next Steps for Parent
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Register for the next qualifying tournament",
                    "Attend the upcoming training camp",
                    "Apply for the state selection trials",
                    "Your ID is now active — you can register independently",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setNotes(prev => prev ? `${prev}\n\nNext step: ${suggestion}.` : `Next step: ${suggestion}.`)}
                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Existing admin notes from DB */}
            {req.adminNotes && req.adminNotes !== notes && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Current Saved Note
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">{req.adminNotes}</p>
              </div>
            )}

            {/* Save button */}
            <div className="flex items-center justify-between">
              {saved && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle size={14} /> Saved successfully
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanged}
                className="ml-auto flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {saving ? "Saving..." : "Save & Notify Parent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConciergeRequestsAdminPage() {
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await conciergeApi.getAllRequests();
      setRequests(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch concierge requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusChange = async (
    id: string,
    newStatus: ConciergeRequest["status"],
    adminNotes?: string,
  ) => {
    try {
      const updated = await conciergeApi.updateStatus(id, newStatus, adminNotes);
      setRequests((prev) =>
        prev.map((req) => (req._id === id ? { ...req, status: updated.status, adminNotes: updated.adminNotes } : req)),
      );
    } catch (err) {
      alert("Failed to update request");
    }
  };

  const handleDownload = async (requestId: string, s3Key: string, fileName: string) => {
    try {
      const url = await conciergeApi.getDocumentDownloadUrl(requestId, s3Key);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Failed to get document download URL");
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.userId?.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sportSlug.toLowerCase().includes(search.toLowerCase()) ||
      (r.itemName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    processing: requests.filter(r => r.status === "processing").length,
    completed: requests.filter(r => r.status === "completed").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Concierge Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review document submissions, update status, and send responses back to parents.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by user, sport, or tournament..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "processing", "completed", "rejected"] as const).map((s) => {
          const active = statusFilter === s;
          const count = counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="flex h-48 items-center justify-center text-red-500">{error}</div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <FileText size={40} className="mb-3 text-slate-300" />
          <p className="font-semibold text-slate-700">No requests found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div>
          {filteredRequests.map((req) => (
            <RequestRow
              key={req._id}
              req={req}
              onStatusChange={handleStatusChange}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
