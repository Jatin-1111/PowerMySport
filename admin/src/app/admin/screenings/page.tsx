"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Activity, CheckCircle2, Clock, Phone, Search, X, XCircle } from "lucide-react";
import axiosInstance from "@/lib/api/axios";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { fieldClass } from "@/modules/shared/ui/buttonStyles";
import { Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";

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
      "inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700",
    icon: <Clock size={12} />,
  },
  scheduled: {
    label: "Scheduled",
    badge:
      "inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700",
    icon: <Activity size={12} />,
  },
  completed: {
    label: "Completed",
    badge:
      "inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700",
    icon: <CheckCircle2 size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    badge:
      "inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500",
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
      <AdminPageHeader
        badge="Content"
        title="Physical screenings"
        subtitle={`${total} request${total !== 1 ? "s" : ""} from parents. Update the status as you contact them.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search child, sport or city"
                aria-label="Search screenings"
                className={`${fieldClass} w-60 pl-9`}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className={`${fieldClass} !w-auto`}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Table */}
      <Panel flush>
        {loading ? (
          <div className="px-5 pb-5">
            <SkeletonBlock rows={5} label="Loading screening requests" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No requests match" : "No screening requests yet"}
            description={search ? "Try a different search." : "Requests from parents appear here."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Child</th>
                  <th>Sport</th>
                  <th>Contact</th>
                  <th>Availability</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r._id}>
                      <td>{r.dependentName}</td>
                      <td>{r.sport ?? <span className="text-slate-500">—</span>}</td>
                      <td>
                        <a
                          href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1.5 text-slate-700 transition-colors hover:text-orange-800"
                        >
                          <Phone className="h-3 w-3" />
                          {r.phone}
                        </a>
                      </td>
                      <td className="max-w-[160px] truncate">
                        {r.preferredTime ?? <span className="text-slate-500">—</span>}
                      </td>
                      <td>{r.city ?? <span className="text-slate-500">—</span>}</td>
                      <td>
                        <span className={meta.badge}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {format(new Date(r.createdAt), "dd MMM yyyy")}
                      </td>
                      <td>
                        <select
                          value={r.status}
                          disabled={updatingId === r._id}
                          onChange={(e) => updateStatus(r._id, e.target.value as ScreeningStatus)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm hover:border-slate-400 disabled:opacity-50"
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
      </Panel>
    </div>
  );
}
