"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import PermissionSelector from "@/modules/admin/components/PermissionSelector";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Mail, Pencil } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { RoleTemplate } from "@/types";

const formatLastLogin = (value?: string) => {
  if (!value) return "Never logged in";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Never logged in";
  }
};

const PERMISSION_LABELS: Record<string, string> = {
  // Users
  "users:view": "View Users",
  "users:manage": "Manage Users",
  // Venues
  "venues:view": "View Venues",
  "venues:manage": "Manage Venues",
  "venues:create": "Create Venues",
  // Bookings
  "bookings:view": "View Bookings",
  "bookings:manage": "Manage Bookings",
  "bookings:refund": "Process Refunds",
  // Coaches
  "coaches:view": "View Coaches",
  "coaches:manage": "Manage Coaches",
  "coaches:verify": "Verify Coaches",
  "coaches:create": "Create Coaches",
  // Academies
  "academies:view": "View Academies",
  "academies:manage": "Manage Academies",
  // Inquiries
  "inquiries:view": "View Inquiries",
  "inquiries:manage": "Manage Inquiries",
  // Disputes
  "disputes:view": "View Disputes",
  "disputes:resolve": "Resolve Disputes",
  // Analytics
  "analytics:view": "View Analytics",
  "analytics:export": "Export Reports",
  // Admins
  "admins:view": "View Admins",
  "admins:manage": "Manage Admins",
  // Reviews
  "reviews:view": "View Reviews",
  "reviews:manage": "Manage Reviews",
  // Products
  "products:view": "View Products",
  "products:create": "Create Products",
  "products:manage": "Manage Products",
  // Orders
  "orders:view": "View Orders",
  "orders:manage": "Manage Orders",
  "orders:refund": "Refund Orders",
};

const formatPermissionLabel = (permission: string): string => {
  if (PERMISSION_LABELS[permission]) {
    return PERMISSION_LABELS[permission];
  }

  return permission
    .replace(/:/g, " ")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvitationEmail, setLastInvitationEmail] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    permissions: [] as string[],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"role" | "name" | "email">("role");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    permissions: [] as string[],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Admin | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  // Reading localStorage synchronously in useMemo would return a different
  // value during SSR (no window) vs. the client's first render, causing a
  // hydration mismatch. useSyncExternalStore is React's supported fix: the
  // server/first-paint snapshot is always null, then it syncs to the real
  // client value in a passive effect after hydration completes.
  const storedAdminRaw = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => (typeof window === "undefined" ? null : localStorage.getItem("admin")),
    () => null,
  );

  const storedAdmin = useMemo(() => {
    if (!storedAdminRaw) return null;
    try {
      return JSON.parse(storedAdminRaw) as { id?: string; role?: string };
    } catch {
      return null;
    }
  }, [storedAdminRaw]);

  const canManageAdmins =
    storedAdmin?.role === "SYSTEM_ADMIN" ||
    storedAdmin?.role === "SUPER_ADMIN" ||
    storedAdmin?.role === "Admin";

  const currentAdminId = storedAdmin?.id || null;

  const loadAdmins = useCallback(async () => {
    if (!canManageAdmins) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getAllAdmins();
      if (response.success && response.data) {
        setAdmins(response.data);
        return;
      }

      setError(response.message || "Failed to load admins.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins.");
    } finally {
      setLoading(false);
    }
  }, [canManageAdmins]);

  const loadRoleTemplates = useCallback(async () => {
    try {
      const response = await adminApi.getRoleTemplates();
      if (response.success && response.data) {
        setRoleTemplates(response.data);
      }
    } catch (err) {
      console.error("Failed to load role templates:", err);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
    loadRoleTemplates();
  }, [loadAdmins, loadRoleTemplates]);

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }

    if (!form.role) {
      toast.error("Please select a role template.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminApi.createAdmin({
        name: form.name,
        email: form.email,
        role: form.role,
        permissions: form.permissions,
      });
      if (!response.success) {
        toast.error(response.message || "Failed to create admin.");
        return;
      }

      toast.success(
        "Admin created successfully. Temporary password sent to email.",
      );
      setLastInvitationEmail(form.email.trim().toLowerCase());
      setForm({
        name: "",
        email: "",
        role: "",
        permissions: [],
      });
      await loadAdmins();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create admin.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditForm({
      name: admin.name,
      role: admin.role,
      permissions: [...admin.permissions],
    });
  };

  const closeEdit = () => {
    setEditingAdmin(null);
  };

  const saveEdit = async () => {
    if (!editingAdmin) return;
    if (!editForm.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!editForm.role) {
      toast.error("Please select a role.");
      return;
    }

    setEditSaving(true);
    try {
      if (editForm.name.trim() !== editingAdmin.name) {
        await adminApi.updateAdminProfile(editingAdmin.id, editForm.name.trim());
      }
      if (editForm.role !== editingAdmin.role) {
        await adminApi.updateAdminRole(editingAdmin.id, editForm.role);
      }
      await adminApi.updateAdminPermissions(
        editingAdmin.id,
        editForm.permissions,
      );

      toast.success("Admin updated successfully.");
      closeEdit();
      await loadAdmins();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update admin.",
      );
    } finally {
      setEditSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;

    setStatusBusy(true);
    try {
      const response = await adminApi.updateAdminStatus(
        statusTarget.id,
        !statusTarget.isActive,
      );
      if (!response.success) {
        toast.error(response.message || "Failed to update admin status.");
        return;
      }

      toast.success(
        `Admin ${statusTarget.isActive ? "deactivated" : "activated"} successfully.`,
      );
      setStatusTarget(null);
      await loadAdmins();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update admin status.",
      );
    } finally {
      setStatusBusy(false);
    }
  };

  const visibleAdmins = [...admins]
    .filter((admin) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query)
      );
    })
    .sort((left, right) => {
      if (sortBy === "name") {
        return left.name.localeCompare(right.name);
      }
      if (sortBy === "email") {
        return left.email.localeCompare(right.email);
      }
      const roleRank = (value: string) => {
        if (value === "SYSTEM_ADMIN") return 0;
        if (value === "FINANCE_ADMIN") return 1;
        if (value === "OPERATIONS_ADMIN") return 2;
        if (value === "ANALYTICS_ADMIN") return 3;
        return 4; // SUPPORT_ADMIN or any other
      };
      return roleRank(left.role) - roleRank(right.role);
    });

  const totalPages = Math.max(1, Math.ceil(visibleAdmins.length / PAGE_SIZE));
  const paginatedAdmins = visibleAdmins.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (!canManageAdmins) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Admins"
          subtitle="Manage administrator accounts (Super Admin only)."
        />
        <Card className="bg-white">
          <div className="py-10 text-center text-slate-600">
            You do not have permission to manage admin accounts.
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="py-12 text-center">Loading admins...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Super Admin"
        title="Admins"
        subtitle="Create and manage administrator accounts."
      />

      {error && (
        <Card className="bg-white">
          <div className="py-6 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadAdmins}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      <Card className="bg-white">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Create Admin
        </h2>
        <p className="mb-5 text-sm text-slate-600">
          Enter name, email, and select a role with permissions. A temporary
          password is auto-generated and sent via email. Admin must change it on
          first login.
        </p>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
            <p>
              Use an active inbox. The admin receives temporary credentials at
              this address and must reset password on first login.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateAdmin} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Enter full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-power-orange focus:ring-2 focus:ring-power-orange/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="name@company.com"
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-power-orange focus:ring-2 focus:ring-power-orange/30"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Temporary credentials will be sent to this email.
              </p>
            </div>
          </div>

          <PermissionSelector
            roleTemplates={roleTemplates}
            selectedRole={form.role}
            selectedPermissions={form.permissions}
            onRoleChange={(role) => setForm((prev) => ({ ...prev, role }))}
            onPermissionsChange={(permissions) =>
              setForm((prev) => ({ ...prev, permissions }))
            }
            disabled={submitting}
          />

          <div>
            <button
              type="submit"
              disabled={submitting || !form.role}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create Admin"}
            </button>
          </div>
        </form>

        {lastInvitationEmail && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Invitation email sent to{" "}
            <span className="font-semibold">{lastInvitationEmail}</span>.
          </div>
        )}
      </Card>

      <Card className="bg-white">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Admin Accounts
        </h2>
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search admins"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "role" | "name" | "email")
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="role">Role priority</option>
            <option value="name">Name (A-Z)</option>
            <option value="email">Email (A-Z)</option>
          </select>
        </div>
        {visibleAdmins.length > 0 && (
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="admins.csv"
              rows={visibleAdmins}
              columns={[
                { header: "Name", value: (a) => a.name },
                { header: "Email", value: (a) => a.email },
                { header: "Role", value: (a) => a.role },
                { header: "Status", value: (a) => (a.isActive ? "Active" : "Inactive") },
                { header: "Last Login", value: (a) => a.lastLogin || "" },
                {
                  header: "Permissions",
                  value: (a) => a.permissions.join("; "),
                },
              ]}
            />
          </div>
        )}
        {visibleAdmins.length === 0 ? (
          <p className="text-slate-600">No admin accounts found.</p>
        ) : (
          <div className="space-y-3">
            {paginatedAdmins.map((admin) => (
              <div
                key={admin.id}
                className={`rounded-lg border p-4 ${
                  admin.isActive
                    ? "border-slate-200"
                    : "border-red-200 bg-red-50/40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {admin.name}
                      </p>
                      {!admin.isActive && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Inactive
                        </span>
                      )}
                      {admin.id === currentAdminId && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{admin.email}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Last login: {formatLastLogin(admin.lastLogin)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-semibold text-power-orange">
                      {admin.role}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(admin)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => setStatusTarget(admin)}
                        disabled={admin.id === currentAdminId}
                        title={
                          admin.id === currentAdminId
                            ? "You cannot deactivate your own account"
                            : undefined
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          admin.isActive
                            ? "border-red-300 text-red-700 hover:bg-red-50"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {admin.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>

                {admin.permissions?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {admin.permissions.slice(0, 8).map((permission) => (
                      <span
                        key={`${admin.id}-${permission}`}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          permission.includes(":manage") ||
                          permission.includes(":delete") ||
                          permission.includes(":verify") ||
                          permission.includes(":approve") ||
                          permission.includes(":resolve")
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {formatPermissionLabel(permission)}
                      </span>
                    ))}
                    {admin.permissions.length > 8 && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600">
                        +{admin.permissions.length - 8} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    No explicit permissions assigned.
                  </p>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-slate-600 sm:text-left">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, visibleAdmins.length)} of{" "}
                  {visibleAdmins.length} admins
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, currentPage - 2),
                      Math.min(totalPages, currentPage + 1),
                    )
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
                          currentPage === page
                            ? "bg-power-orange text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Edit {editingAdmin.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{editingAdmin.email}</p>

            <div className="mt-4 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-power-orange focus:ring-2 focus:ring-power-orange/30"
                />
              </div>

              <PermissionSelector
                roleTemplates={roleTemplates}
                selectedRole={editForm.role}
                selectedPermissions={editForm.permissions}
                onRoleChange={(role) =>
                  setEditForm((prev) => ({ ...prev, role }))
                }
                onPermissionsChange={(permissions) =>
                  setEditForm((prev) => ({ ...prev, permissions }))
                }
                disabled={editSaving}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={statusTarget !== null}
        title={
          statusTarget?.isActive
            ? `Deactivate ${statusTarget?.name}?`
            : `Activate ${statusTarget?.name}?`
        }
        description={
          statusTarget?.isActive
            ? "This admin will immediately lose access to the panel. You can reactivate them later."
            : "This admin will regain access to the panel with their existing role and permissions."
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        cancelLabel="Cancel"
        variant={statusTarget?.isActive ? "danger" : "default"}
        loading={statusBusy}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
