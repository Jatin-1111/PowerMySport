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

export default function AdminExpertsPage() {
  const [experts, setExperts] = useState<AdminExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminExpert | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await expertAdminApi.list({ limit: 100 });
      if (res.success && res.data) setExperts(res.data);
      else setError(res.message || "Failed to load experts.");
    } catch {
      setError("Failed to load experts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyUpdate = useCallback((updated: AdminExpert) => {
    setExperts((list) =>
      list.map((e) => ((e.id || e._id) === (updated.id || updated._id) ? { ...e, ...updated } : e)),
    );
    setSelected((prev) =>
      prev && (prev.id || prev._id) === (updated.id || updated._id) ? { ...prev, ...updated } : prev,
    );
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
      render: (e) => <span className="text-slate-700">{formatInr(e.sessionFee)}</span>,
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
      key: "status",
      header: "Status",
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
        subtitle="Create and manage expert-player profiles. Experts log in with emailed credentials."
        action={
          <Link
            href="/admin/experts/add"
            className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={16} /> Add expert
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 py-10 text-center">
          <p className="font-semibold text-red-600">{error}</p>
          <button
            onClick={load}
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
          emptyMessage="No experts yet. Use “Add expert” to create one."
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
            <StatusBadge status={selected.isActive ? "ACTIVE" : "INACTIVE"} />
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
