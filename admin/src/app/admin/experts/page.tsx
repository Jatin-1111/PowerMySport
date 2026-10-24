"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { ErrorNotice } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { DetailDrawer } from "@/modules/shared/ui/DetailDrawer";
import { expertAdminApi, type AdminExpert } from "@/modules/expert/services/expert";
import { ExpertAdminPanel } from "./ExpertAdminPanel";
import { Plus, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type Tab = "ALL" | "PENDING";

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
      list.map((e) => ((e.id || e._id) === (updated.id || updated._id) ? { ...e, ...updated } : e))
    );
    setSelected((prev) =>
      prev && (prev.id || prev._id) === (updated.id || updated._id) ? { ...prev, ...updated } : prev
    );
    // Refresh pending count after any status change
    expertAdminApi
      .list({ limit: 1 })
      .then((r) => {
        if (r.pendingCount !== undefined) setPendingCount(r.pendingCount);
      })
      .catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter(
      (e) =>
        (e.name || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        (e.sports || []).join(" ").toLowerCase().includes(q)
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
                className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800"
              >
                {s}
              </span>
            ))}
            {e.sports.length > 2 && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                +{e.sports.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500">—</span>
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
            ? "Online or in person"
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
            <span className="text-slate-500">({e.reviewCount})</span>
          </span>
        ) : (
          <span className="text-xs text-slate-500">New</span>
        ),
    },
    {
      key: "verificationStatus",
      header: "Approval",
      render: (e) => {
        const status = e.verificationStatus || "APPROVED";
        return <StatusBadge status={status} size="sm" />;
      },
    },
    {
      key: "status",
      header: "Account",
      render: (e) => <StatusBadge status={e.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Experts"
        subtitle="Manage expert-player profiles. Self-registered experts require approval before going live."
        action={
          <Link href="/admin/experts/add" className={btn("accent")}>
            <Plus size={16} aria-hidden /> Add expert
          </Link>
        }
      />

      <Tabs
        label="Expert list"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "ALL" as const, label: "All experts" },
          { id: "PENDING" as const, label: "Pending review", count: pendingCount },
        ]}
      />

      {error ? (
        <ErrorNotice message={error} onRetry={() => load(tab)} />
      ) : (
        <AdminDataTable<AdminExpert>
          columns={columns}
          rows={visible}
          getRowKey={(e) => e.id || e._id || e.email || ""}
          loading={loading}
          emptyMessage={tab === "PENDING" ? "No experts are waiting for review" : "No experts yet"}
          onRowClick={setSelected}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name, email or sport",
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
                <StatusBadge status={selected.verificationStatus} size="sm" />
              )}
              <StatusBadge status={selected.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>
          ) : null
        }
      >
        {selected && <ExpertAdminPanel expert={selected} onUpdated={applyUpdate} />}
      </DetailDrawer>
    </div>
  );
}
