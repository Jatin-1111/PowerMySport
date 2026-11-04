"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { UserSafetyRecord, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
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
    <Suspense fallback={<SkeletonBlock rows={6} label="Loading user safety" />}>
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
  const [modalAction, setModalAction] = useState<"SUSPEND" | "REACTIVATE" | "DEACTIVATE" | null>(
    null
  );
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
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  const updateSafety = async (
    userId: string,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
    reason?: string
  ) => {
    setBusyUserId(userId);
    try {
      const response = await adminApi.updateUserSafety(userId, {
        action,
        reason,
      });
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

  const handleActionClick = (userId: string, action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE") => {
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
          <StatusBadge
            status={user.isActive ? "Active" : "Suspended"}
            tone={user.isActive ? "green" : "red"}
            size="sm"
          />
          {!user.isActive && (user.suspendedAt || user.deactivatedAt) && (
            <div className="mt-1 text-xs text-slate-500">
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
      header: "Last active",
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
                className={btn("outline", "sm")}
              >
                Suspend
              </button>
              <button
                disabled={busyUserId === user.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(user.id, "DEACTIVATE");
                }}
                className={btn("dangerOutline", "sm")}
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
              className={btn("outline", "sm")}
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
        badge="Trust & Support"
        title="User safety"
        subtitle="Suspend, reactivate or deactivate accounts. Every action needs a reason, which is saved to the audit log."
      />

      <AdminDataTable
        columns={columns}
        rows={visibleUsers}
        getRowKey={(user) => user.id}
        loading={loading}
        emptyMessage="No users found"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by name or email",
        }}
        pagination={{
          page,
          totalPages,
          onPageChange: handlePageChange,
          total,
        }}
        toolbarExtra={
          <div className="flex items-center gap-2">
            <label htmlFor="safety-status" className="text-sm text-slate-600">
              Status
            </label>
            <select
              id="safety-status"
              value={statusFilter}
              onChange={(event) => handleStatusChange(event.target.value as typeof statusFilter)}
              className={`${fieldClass} !w-auto`}
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        }
      />

      {/* Suspension / Deactivation Reason Modal */}
      {modalOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-modal-title"
            className="animate-scale-up w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="safety-modal-title" className="mb-2 text-lg font-semibold text-slate-900">
              {modalAction === "SUSPEND" ? "Suspend this account?" : "Deactivate this account?"}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Say why you are {modalAction === "SUSPEND" ? "suspending" : "deactivating"} this
              account. The reason is required and is saved to the audit log.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="safety-reason" className={labelClass}>
                  Reason
                </label>
                <textarea
                  id="safety-reason"
                  rows={4}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="What happened, and what evidence you have"
                  className={fieldClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModalOpen(false)} className={btn("outline")}>
                  Cancel
                </button>
                <button
                  onClick={handleModalConfirm}
                  disabled={!modalReason.trim()}
                  className={btn("danger")}
                >
                  {modalAction === "SUSPEND" ? "Suspend account" : "Deactivate account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
