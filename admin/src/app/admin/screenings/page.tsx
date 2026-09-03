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

const STATUS_META: Record<
  ScreeningStatus,
  { label: string; badge: string; icon: React.ReactNode }
> = {
  requested: {
    label: "Requested",
    badge:
      "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700",
    icon: <Clock size={12} />,
  },
  scheduled: {
    label: "Scheduled",
    badge:
      "inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700",
    icon: <Activity size={12} />,
  },
  completed: {
    label: "Completed",
    badge:
      "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700",
    icon: <CheckCircle2 size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    badge:
      "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500",
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

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  async function updateStatus(id: string, status: ScreeningStatus) {
    setUpdatingId(id);
    try {
      await axiosInstance.patch(`/screenings/admin/${id}/status`, { status });
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)));
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Stethoscope className="text-power-orange h-5 w-5" />
            <h1 className="text-xl font-bold text-slate-900">Physical Screenings</h1>
          </div>
          <p className="text-sm text-slate-500">
            {total} total request{total !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search child, sport, city…"
              className="focus:ring-power-orange/30 focus:border-power-orange w-52 rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="focus:ring-power-orange/30 focus:border-power-orange rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Stethoscope className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No screening requests yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Child
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sport
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Availability
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    City
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Received
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Update
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r._id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{r.dependentName}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {r.sport ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <a
                          href={`tel:${r.phone}`}
                          className="hover:text-power-orange inline-flex items-center gap-1.5 text-slate-700 transition-colors"
                        >
                          <Phone className="h-3 w-3" />
                          {r.phone}
                        </a>
                      </td>
                      <td className="max-w-[160px] truncate px-5 py-3.5 text-slate-500">
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
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-400">
                        {format(new Date(r.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={r.status}
                          disabled={updatingId === r._id}
                          onChange={(e) => updateStatus(r._id, e.target.value as ScreeningStatus)}
                          className="focus:ring-power-orange/30 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_META[s].label}
                            </option>
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
