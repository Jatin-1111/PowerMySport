"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import PermissionSelector from "@/modules/admin/components/PermissionSelector";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { Pagination } from "@/modules/shared/ui/Pagination";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { Mail, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PermissionModule, RoleTemplate } from "@/types";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

const formatLastLogin = (value?: string) => {
  if (!value) return "Never logged in";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Never logged in";
  }
};

const formatPermissionLabel = (permission: string, labels: Record<string, string>): string => {
  if (labels[permission]) {
    return labels[permission];
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
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvitationEmail, setLastInvitationEmail] = useState<string | null>(null);
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
  const [showCreate, setShowCreate] = useState(false);
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
    () => null
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
      const [templates, catalog] = await Promise.all([
        adminApi.getRoleTemplates(),
        adminApi.getPermissionCatalog(),
      ]);
      if (templates.success && templates.data) {
        setRoleTemplates(templates.data);
      }
      if (catalog.success && catalog.data) {
        setPermissionCatalog(catalog.data);
      }
    } catch (err) {
      console.error("Failed to load role templates:", err);
    }
  }, []);

  const permissionLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const permModule of permissionCatalog) {
      for (const p of permModule.permissions) labels[p.key] = p.label;
    }
    return labels;
  }, [permissionCatalog]);

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

      toast.success("Admin created successfully. Temporary password sent to email.");
      setLastInvitationEmail(form.email.trim().toLowerCase());
      setForm({
        name: "",
        email: "",
        role: "",
        permissions: [],
      });
      await loadAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create admin.");
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
      await adminApi.updateAdminPermissions(editingAdmin.id, editForm.permissions);

      toast.success("Admin updated successfully.");
      closeEdit();
      await loadAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;

    setStatusBusy(true);
    try {
      const response = await adminApi.updateAdminStatus(statusTarget.id, !statusTarget.isActive);
      if (!response.success) {
        toast.error(response.message || "Failed to update admin status.");
        return;
      }

      toast.success(`Admin ${statusTarget.isActive ? "deactivated" : "activated"} successfully.`);
      setStatusTarget(null);
      await loadAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin status.");
    } finally {
      setStatusBusy(false);
    }
  };

  const visibleAdmins = [...admins]
    .filter((admin) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return admin.name.toLowerCase().includes(query) || admin.email.toLowerCase().includes(query);
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
    currentPage * PAGE_SIZE
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
          badge="System"
          title="Admins"
          subtitle="Create and manage administrator accounts."
        />
        <EmptyState
          title="You can't manage admin accounts"
          description="Only a super admin can create or change them."
        />
      </div>
    );
  }

  if (loading) {
    return <SkeletonBlock rows={6} label="Loading admins" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="System"
        title="Admins"
        subtitle="Who can sign in to this panel, and what each person can do."
        action={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            aria-expanded={showCreate}
            className={showCreate ? btn("outline") : btn("accent")}
          >
            {showCreate ? "Close" : "Add admin"}
          </button>
        }
      />

      {error && <ErrorNotice message={error} onRetry={loadAdmins} />}

      {showCreate && (
        <Panel
          title="Add an admin"
          description="They get a temporary password by email and must change it the first time they sign in."
        >
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
              <p>Use an inbox they actively check. The credentials go to this address.</p>
            </div>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="admin-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="admin-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Priya Raman"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="admin-email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="admin-email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="name@powermysport.com"
                  type="email"
                  className={fieldClass}
                />
              </div>
            </div>

            <PermissionSelector
              roleTemplates={roleTemplates}
              permissionCatalog={permissionCatalog}
              selectedRole={form.role}
              selectedPermissions={form.permissions}
              onRoleChange={(role) => setForm((prev) => ({ ...prev, role }))}
              onPermissionsChange={(permissions) => setForm((prev) => ({ ...prev, permissions }))}
              disabled={submitting}
            />

            <div>
              <button type="submit" disabled={submitting || !form.role} className={btn("primary")}>
                {submitting ? "Creating…" : "Create admin"}
              </button>
            </div>
          </form>

          {lastInvitationEmail && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Invitation email sent to <span className="font-semibold">{lastInvitationEmail}</span>.
            </div>
          )}
        </Panel>
      )}

      <Panel title="Admin accounts">
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search admins"
            aria-label="Search admins"
            className={fieldClass}
          />
          <select
            value={sortBy}
            aria-label="Sort admins"
            onChange={(event) => setSortBy(event.target.value as "role" | "name" | "email")}
            className={fieldClass}
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
                {
                  header: "Status",
                  value: (a) => (a.isActive ? "Active" : "Inactive"),
                },
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
          <EmptyState
            title="No admin accounts match"
            description="Clear the search to see everyone."
          />
        ) : (
          <div className="space-y-3">
            {paginatedAdmins.map((admin) => (
              <div
                key={admin.id}
                className={`rounded-lg border p-4 ${
                  admin.isActive ? "border-slate-200" : "border-red-200 bg-red-50/40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{admin.name}</p>
                      {!admin.isActive && <StatusBadge status="Inactive" tone="red" size="sm" />}
                      {admin.id === currentAdminId && (
                        <StatusBadge status="You" tone="slate" dot={false} size="sm" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{admin.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last login: {formatLastLogin(admin.lastLogin)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={admin.role} tone="orange" dot={false} size="sm" />
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(admin)} className={btn("outline", "sm")}>
                        <Pencil size={12} aria-hidden />
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
                        className={btn(admin.isActive ? "dangerOutline" : "outline", "sm")}
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
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                          permission.includes(":manage") ||
                          permission.includes(":delete") ||
                          permission.includes(":verify") ||
                          permission.includes(":approve") ||
                          permission.includes(":resolve")
                            ? "border border-sky-200 bg-sky-50 text-sky-700"
                            : "border border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatPermissionLabel(permission, permissionLabels)}
                      </span>
                    ))}
                    {admin.permissions.length > 8 && (
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        +{admin.permissions.length - 8} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No explicit permissions assigned.</p>
                )}
              </div>
            ))}

            <Pagination
              className="mt-4"
              page={currentPage}
              totalPages={totalPages}
              total={visibleAdmins.length}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Panel>

      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editingAdmin.name}`}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
          >
            <h3 className="text-lg font-semibold text-slate-900">Edit {editingAdmin.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{editingAdmin.email}</p>

            <div className="mt-4 space-y-5">
              <div>
                <label htmlFor="edit-admin-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="edit-admin-name"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </div>

              <PermissionSelector
                roleTemplates={roleTemplates}
                permissionCatalog={permissionCatalog}
                selectedRole={editForm.role}
                selectedPermissions={editForm.permissions}
                onRoleChange={(role) => setEditForm((prev) => ({ ...prev, role }))}
                onPermissionsChange={(permissions) =>
                  setEditForm((prev) => ({ ...prev, permissions }))
                }
                disabled={editSaving}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSaving}
                className={btn("outline")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className={btn("primary")}
              >
                {editSaving ? "Saving…" : "Save changes"}
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
