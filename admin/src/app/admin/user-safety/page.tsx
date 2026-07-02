"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { UserSafetyRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { toast } from "@/lib/toast";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";

const formatDate = (value?: string | null): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function AdminUserSafetyPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
      <AdminUserSafetyPageContent />
    </Suspense>
  );
}

function AdminUserSafetyPageContent() {
  const router = useRouter();
  const pathname = usePathname();

  // Local React State for status filter and page selection
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<UserSafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  // Modal safety states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<"SUSPEND" | "REACTIVATE" | "DEACTIVATE" | null>(null);
  const [modalReason, setModalReason] = useState("");

  // Restore states from URL query params on initial mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status") as "ALL" | "ACTIVE" | "SUSPENDED";
    if (statusParam === "ALL" || statusParam === "ACTIVE" || statusParam === "SUSPENDED") {
      setStatusFilter(statusParam);
    }
    const pageParam = Number(params.get("page"));
    if (!isNaN(pageParam) && pageParam > 0) {
      setPage(pageParam);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUserSafetyList({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setUsers(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || response.data.length);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users list.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleStatusChange = (newStatus: "ALL" | "ACTIVE" | "SUSPENDED") => {
    setStatusFilter(newStatus);
    setPage(1);

    const current = new URLSearchParams(window.location.search);
    current.set("status", newStatus);
    current.set("page", "1");
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);

    const current = new URLSearchParams(window.location.search);
    current.set("page", String(newPage));
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const visibleUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const updateSafety = async (
    userId: string,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
    reason?: string
  ) => {
    setBusyUserId(userId);
    try {
      const response = await adminApi.updateUserSafety(userId, { action, reason });
      if (response.success) {
        toast.success(`User ${action.toLowerCase()}d successfully.`);
        await loadUsers();
      } else {
        toast.error(response.message || `Failed to ${action.toLowerCase()} user.`);
      }
    } catch (e) {
      console.error(e);
      toast.error(`An error occurred while trying to ${action.toLowerCase()} user.`);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleActionClick = (
    userId: string,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
  ) => {
    if (action === "REACTIVATE") {
      updateSafety(userId, "REACTIVATE");
    } else {
      setModalUserId(userId);
      setModalAction(action);
      setModalReason("");
      setModalOpen(true);
    }
  };

  const handleModalConfirm = () => {
    if (!modalUserId || !modalAction) return;
    if ((modalAction === "SUSPEND" || modalAction === "DEACTIVATE") && !modalReason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    
    updateSafety(modalUserId, modalAction, modalReason.trim());
    setModalOpen(false);
    setModalUserId(null);
    setModalAction(null);
    setModalReason("");
  };

  const columns: AdminDataTableColumn<UserSafetyRecord>[] = [
    {
      key: "name",
      header: "Name",
      render: (user) => (
        <div>
          <div className="font-medium text-slate-900">{user.name}</div>
          <div className="text-xs text-slate-500">{user.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user) => user.role,
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <div>
          <div>{user.isActive ? "ACTIVE" : "SUSPENDED"}</div>
          {!user.isActive && (user.suspendedAt || user.deactivatedAt) && (
            <div className="text-xs text-slate-400">
              since {formatDate(user.suspendedAt || user.deactivatedAt)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "suspensionReason",
      header: "Reason",
      className: "max-w-sm",
      render: (user) => user.suspensionReason || "—",
    },
    {
      key: "lastActiveAt",
      header: "Last Active",
      render: (user) => formatDate(user.lastActiveAt),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => (
        <div className="flex gap-2">
          {user.isActive ? (
            <>
              <button
                disabled={busyUserId === user.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(user.id, "SUSPEND");
                }}
                className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 cursor-pointer disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                disabled={busyUserId === user.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(user.id, "DEACTIVATE");
                }}
                className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-200 cursor-pointer disabled:opacity-50"
              >
                Deactivate
              </button>
            </>
          ) : (
            <button
              disabled={busyUserId === user.id}
              onClick={(e) => {
                e.stopPropagation();
                handleActionClick(user.id, "REACTIVATE");
              }}
              className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-200 cursor-pointer disabled:opacity-50"
            >
              Reactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="User Safety"
        subtitle="Suspend, reactivate, or deactivate accounts with audit-friendly reasons."
      />

      <Card className="bg-white">
        <AdminDataTable
          columns={columns}
          rows={visibleUsers}
          getRowKey={(user) => user.id}
          loading={loading}
          emptyMessage="No users found."
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name or email...",
          }}
          pagination={{ page, totalPages, onPageChange: handlePageChange, total }}
          toolbarExtra={
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Filter:</label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusChange(event.target.value as typeof statusFilter)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          }
        />
      </Card>

      {/* Suspension / Deactivation Reason Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {modalAction === "SUSPEND" ? "Suspend Account" : "Deactivate Account"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Please enter the reason for {modalAction === "SUSPEND" ? "suspending" : "deactivating"} this user account. This reason is required and will be saved in the database.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Enter detailed reason here..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalConfirm}
                  disabled={!modalReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm {modalAction === "SUSPEND" ? "Suspension" : "Deactivation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
