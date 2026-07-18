"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  CheckCircle2,
  Clock,
  Phone,
  Search,
  Stethoscope,
  X,
  XCircle,
} from "lucide-react";
import axiosInstance from "@/lib/api/axios";

type ScreeningStatus = "requested" | "scheduled" | "completed" | "cancelled";

interface ScreeningRequest {
  _id: string;
  dependentName: string;
  sport?: string;
  phone: string;
  preferredTime?: string;
  city?: string;
  status: ScreeningStatus;
  adminNotes?: string;
  createdAt: string;
}

const STATUS_META: Record<ScreeningStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  requested: {
    label: "Requested",
    badge: "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700",
    icon: <Clock size={12} />,
  },
  scheduled: {
    label: "Scheduled",
    badge: "inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700",
    icon: <Activity size={12} />,
  },
  completed: {
    label: "Completed",
    badge: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700",
    icon: <CheckCircle2 size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    badge: "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500",
    icon: <XCircle size={12} />,
  },
};

const STATUS_OPTIONS: ScreeningStatus[] = ["requested", "scheduled", "completed", "cancelled"];

export default function ScreeningsPage() {
  const [requests, setRequests] = useState<ScreeningRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function fetchRequests() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      const res = await axiosInstance.get("/screenings/admin", { params });
      setRequests(res.data.data.requests);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  async function updateStatus(id: string, status: ScreeningStatus) {
    setUpdatingId(id);
    try {
      await axiosInstance.patch(`/screenings/admin/${id}/status`, { status });
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status } : r))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = search
    ? requests.filter(
        (r) =>
          r.dependentName.toLowerCase().includes(search.toLowerCase()) ||
          r.phone.includes(search) ||
          r.sport?.toLowerCase().includes(search.toLowerCase()) ||
          r.city?.toLowerCase().includes(search.toLowerCase())
      )
    : requests;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-5 h-5 text-power-orange" />
            <h1 className="text-xl font-bold text-slate-900">Physical Screenings</h1>
          </div>
          <p className="text-sm text-slate-500">{total} total request{total !== 1 ? "s" : ""}</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search child, sport, city…"
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/30 focus:border-power-orange w-52"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/30 focus:border-power-orange bg-white text-slate-700"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Stethoscope className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No screening requests yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Child</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sport</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Availability</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">City</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Received</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{r.dependentName}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.sport ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3.5">
                        <a
                          href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1.5 text-slate-700 hover:text-power-orange transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          {r.phone}
                        </a>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[160px] truncate">
                        {r.preferredTime ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {r.city ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={meta.badge}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                        {format(new Date(r.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={r.status}
                          disabled={updatingId === r._id}
                          onChange={(e) => updateStatus(r._id, e.target.value as ScreeningStatus)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/30 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
