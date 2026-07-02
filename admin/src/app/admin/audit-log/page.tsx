"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAuditLogEntry, adminApi } from "@/modules/admin/services/admin";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { StatusBadge, StatusTone } from "@/modules/shared/ui/StatusBadge";
import {
  DetailDrawer,
  DetailRow,
  DetailSection,
} from "@/modules/shared/ui/DetailDrawer";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { useCallback, useEffect, useMemo, useState } from "react";

type SortColumn = "createdAt" | "admin" | "action";
type SortDirection = "asc" | "desc";

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

/**
 * Derive a semantic colour for an audit action from its verb, so destructive
 * actions (ban/delete/reject) read red, approvals green, edits blue, etc.
 */
const actionTone = (action: string): StatusTone => {
  const a = action.toLowerCase();
  if (/(ban|delete|remove|reject|revoke|suspend|disable|deactivat)/.test(a))
    return "red";
  if (/(approve|verify|activat|enable|create|add|grant|resolve)/.test(a))
    return "green";
  if (/refund/.test(a)) return "purple";
  if (/(update|edit|change|assign|reset)/.test(a)) return "blue";
  return "orange";
};

const metadataFieldCount = (metadata?: Record<string, unknown>): number =>
  metadata ? Object.keys(metadata).length : 0;

const renderMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogEntry | null>(
    null,
  );

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

  const onSortChange = (column: string) => {
    const col = column as SortColumn;
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "admin" ? "asc" : "desc");
    }
  };

  const visibleLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = logs.filter((log) => {
      if (!query) return true;
      return (
        (log.admin?.name || "").toLowerCase().includes(query) ||
        (log.admin?.email || "").toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.targetType.toLowerCase().includes(query) ||
        (log.targetId || "").toLowerCase().includes(query)
      );
    });

    const factor = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (sortColumn === "admin") {
        return (
          factor *
          (left.admin?.name || "").localeCompare(right.admin?.name || "")
        );
      }
      if (sortColumn === "action") {
        return factor * left.action.localeCompare(right.action);
      }
      return (
        factor *
        (new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime())
      );
    });
  }, [logs, searchQuery, sortColumn, sortDirection]);

  const columns: AdminDataTableColumn<AdminAuditLogEntry>[] = [
    {
      key: "createdAt",
      header: "When",
      sortable: true,
      render: (log) => (
        <span className="whitespace-nowrap text-slate-600">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "admin",
      header: "Admin",
      sortable: true,
      render: (log) => (
        <EntityBadge
          name={log.admin?.name}
          email={log.admin?.email}
          fallbackLabel="Unknown admin"
        />
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (log) => (
        <StatusBadge
          status={formatAction(log.action)}
          tone={actionTone(log.action)}
          dot={false}
        />
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
      align: "right",
      render: (log) => {
        const count = metadataFieldCount(log.metadata);
        return count > 0 ? (
          <span className="text-xs font-medium text-power-orange">
            {count} field{count === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Super Admin"
        title="Audit Log"
        subtitle="Who did what, and when — a record of sensitive admin actions across the panel."
      />

      <AdminDataTable
        columns={columns}
        rows={visibleLogs}
        getRowKey={(log) => log.id}
        loading={loading}
        emptyMessage={
          searchQuery
            ? "No audit entries match your search on this page."
            : "No audit log entries yet."
        }
        onRowClick={setSelectedLog}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search this page by admin, action, or target",
        }}
        sort={{
          column: sortColumn,
          direction: sortDirection,
          onChange: onSortChange,
        }}
        pagination={{ page, totalPages, onPageChange: setPage, total }}
        toolbarExtra={
          <ExportCsvButton
            filename="audit-log.csv"
            rows={visibleLogs}
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

      <DetailDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? formatAction(selectedLog.action) : "Audit entry"}
        subtitle={
          selectedLog
            ? new Date(selectedLog.createdAt).toLocaleString()
            : undefined
        }
        headerExtra={
          selectedLog ? (
            <StatusBadge
              status={formatAction(selectedLog.action)}
              tone={actionTone(selectedLog.action)}
              dot={false}
            />
          ) : null
        }
      >
        {selectedLog && (
          <>
            <DetailSection title="Admin">
              <EntityBadge
                name={selectedLog.admin?.name}
                email={selectedLog.admin?.email}
                fallbackLabel="Unknown admin"
              />
            </DetailSection>

            <DetailSection title="Action">
              <DetailRow label="Action key" value={selectedLog.action} />
              <DetailRow label="Target type" value={selectedLog.targetType} />
              <DetailRow
                label="Target ID"
                value={
                  selectedLog.targetId ? (
                    <span className="font-mono text-xs">
                      {selectedLog.targetId}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Timestamp"
                value={new Date(selectedLog.createdAt).toLocaleString()}
              />
            </DetailSection>

            <DetailSection title="Metadata">
              {metadataFieldCount(selectedLog.metadata) > 0 ? (
                <div className="space-y-2">
                  {Object.entries(
                    selectedLog.metadata as Record<string, unknown>,
                  ).map(([key, value]) => (
                    <DetailRow
                      key={key}
                      label={key}
                      value={
                        typeof value === "object" && value !== null ? (
                          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-left text-xs text-slate-700">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          renderMetadataValue(value)
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No additional metadata recorded.
                </p>
              )}
            </DetailSection>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
