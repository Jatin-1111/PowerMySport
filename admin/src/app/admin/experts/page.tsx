"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { DetailDrawer } from "@/modules/shared/ui/DetailDrawer";
import {
  expertAdminApi,
  type AdminExpert,
} from "@/modules/expert/services/expert";
import { ExpertAdminPanel } from "./ExpertAdminPanel";
import { Plus, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type Tab = "ALL" | "PENDING";

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: "UNVERIFIED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const VERIFICATION_BADGE_STYLES: Record<string, string> = {
  UNVERIFIED: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
};

export default function AdminExpertsPage() {
  const [experts, setExperts] = useState<AdminExpert[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminExpert | null>(null);
  const [tab, setTab] = useState<Tab>("ALL");

  const load = useCallback(async (activeTab: Tab = "ALL") => {
    try {
      setLoading(true);
      setError(null);
      const params: Parameters<typeof expertAdminApi.list>[0] = { limit: 100 };
      if (activeTab === "PENDING") params.verificationStatus = "PENDING";
      const res = await expertAdminApi.list(params);
      if (res.success && res.data) {
        setExperts(res.data);
        if (res.pendingCount !== undefined) setPendingCount(res.pendingCount);
      } else {
        setError(res.message || "Failed to load experts.");
      }
    } catch {
      setError("Failed to load experts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  const applyUpdate = useCallback((updated: AdminExpert) => {
    setExperts((list) =>
      list.map((e) =>
        (e.id || e._id) === (updated.id || updated._id)
          ? { ...e, ...updated }
          : e,
      ),
    );
    setSelected((prev) =>
      prev && (prev.id || prev._id) === (updated.id || updated._id)
        ? { ...prev, ...updated }
        : prev,
    );
    // Refresh pending count after any status change
    expertAdminApi.list({ limit: 1 }).then((r) => {
      if (r.pendingCount !== undefined) setPendingCount(r.pendingCount);
    }).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter(
      (e) =>
        (e.name || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        (e.sports || []).join(" ").toLowerCase().includes(q),
    );
  }, [experts, search]);

  const columns: AdminDataTableColumn<AdminExpert>[] = [
    {
      key: "name",
      header: "Expert",
      render: (e) => <EntityBadge name={e.name} email={e.email} />,
    },
    {
      key: "sports",
      header: "Sports",
      render: (e) =>
        e.sports?.length ? (
          <div className="flex flex-wrap gap-1">
            {e.sports.slice(0, 2).map((s) => (
              <span
                key={s}
                className="rounded-full bg-power-orange/10 px-2 py-0.5 text-xs font-medium text-power-orange"
              >
                {s}
              </span>
            ))}
            {e.sports.length > 2 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                +{e.sports.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      render: (e) => (
        <span className="text-slate-700">{formatInr(e.sessionFee)}</span>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (e) => (
        <span className="text-slate-600">
          {e.sessionMode === "BOTH"
            ? "Online / In-person"
            : e.sessionMode === "ONLINE"
              ? "Online"
              : "In-person"}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      render: (e) =>
        e.reviewCount ? (
          <span className="inline-flex items-center gap-1 text-slate-700">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {e.rating.toFixed(1)}
            <span className="text-slate-400">({e.reviewCount})</span>
          </span>
        ) : (
          <span className="text-xs uppercase text-slate-400">New</span>
        ),
    },
    {
      key: "verificationStatus",
      header: "Review",
      render: (e) => {
        const status = e.verificationStatus || "APPROVED";
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${VERIFICATION_BADGE_STYLES[status] || ""}`}>
            {STATUS_LABEL[status] || status}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Active",
      render: (e) => (
        <StatusBadge status={e.isActive ? "ACTIVE" : "INACTIVE"} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Experts"
        subtitle="Manage expert-player profiles. Self-registered experts require approval before going live."
        action={
          <Link
            href="/admin/experts/add"
            className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={16} /> Add expert
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setTab("ALL")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
            tab === "ALL"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setTab("PENDING")}
          className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
            tab === "PENDING"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pending Review
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-10 text-center">
          <p className="font-semibold text-red-600">{error}</p>
          <button
            onClick={() => load(tab)}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <AdminDataTable<AdminExpert>
          columns={columns}
          rows={visible}
          getRowKey={(e) => e.id || e._id || e.email || ""}
          loading={loading}
          emptyMessage={tab === "PENDING" ? "No experts pending review." : "No experts yet. Use Add expert to create one."}
          onRowClick={setSelected}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name, email, or sport",
          }}
        />
      )}

      <DetailDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || "Expert"}
        subtitle={selected?.email}
        headerExtra={
          selected ? (
            <div className="flex items-center gap-2">
              {selected.verificationStatus && selected.verificationStatus !== "APPROVED" && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${VERIFICATION_BADGE_STYLES[selected.verificationStatus] || ""}`}>
                  {selected.verificationStatus}
                </span>
              )}
              <StatusBadge status={selected.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>
          ) : null
        }
      >
        {selected && (
          <ExpertAdminPanel expert={selected} onUpdated={applyUpdate} />
        )}
      </DetailDrawer>
    </div>
  );
}
