"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAuditLogEntry, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { useCallback, useEffect, useState } from "react";

const formatAction = (action: string): string =>
  action
    .split(".")
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .join(" · ");

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAuditLogs({ page, limit: 25 });
      if (response.success && response.data) {
        setLogs(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || response.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns: AdminDataTableColumn<AdminAuditLogEntry>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (log) => (
        <span className="whitespace-nowrap text-slate-600">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "admin",
      header: "Admin",
      render: (log) => (
        <div>
          <p className="font-medium text-slate-900">
            {log.admin?.name || "Unknown admin"}
          </p>
          <p className="text-xs text-slate-500">{log.admin?.email}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <span className="rounded-full bg-power-orange/10 px-2.5 py-1 text-xs font-semibold text-power-orange">
          {formatAction(log.action)}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (log) => (
        <span title={log.targetId} className="text-slate-600">
          {log.targetType}
          {log.targetId ? ` #${log.targetId.slice(-8)}` : ""}
        </span>
      ),
    },
    {
      key: "metadata",
      header: "Details",
      className: "max-w-xs",
      render: (log) =>
        log.metadata ? (
          <span className="line-clamp-2 text-xs text-slate-500">
            {JSON.stringify(log.metadata)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Super Admin"
        title="Audit Log"
        subtitle="Who did what, and when — a record of sensitive admin actions across the panel."
      />

      <Card className="bg-white">
        <AdminDataTable
          columns={columns}
          rows={logs}
          getRowKey={(log) => log.id}
          loading={loading}
          emptyMessage="No audit log entries yet."
          pagination={{ page, totalPages, onPageChange: setPage, total }}
          toolbarExtra={
            <ExportCsvButton
              filename="audit-log.csv"
              rows={logs}
              label="Export Page CSV"
              columns={[
                { header: "When", value: (l) => l.createdAt },
                { header: "Admin Name", value: (l) => l.admin?.name || "" },
                { header: "Admin Email", value: (l) => l.admin?.email || "" },
                { header: "Action", value: (l) => l.action },
                { header: "Target Type", value: (l) => l.targetType },
                { header: "Target ID", value: (l) => l.targetId || "" },
                {
                  header: "Metadata",
                  value: (l) => (l.metadata ? JSON.stringify(l.metadata) : ""),
                },
              ]}
            />
          }
        />
      </Card>
    </div>
  );
}
