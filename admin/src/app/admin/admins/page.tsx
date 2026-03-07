"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import PermissionSelector from "@/modules/admin/components/PermissionSelector";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { toast } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleTemplate } from "@/types";

const PERMISSION_LABELS: Record<string, string> = {
  // Users
  "users:view": "View Users",
  "users:manage": "Manage Users",
  "users:delete": "Delete Users",
  // Venues
  "venues:view": "View Venues",
  "venues:manage": "Manage Venues",
  "venues:delete": "Delete Venues",
  "venues:approve": "Approve Venues",
  // Bookings
  "bookings:view": "View Bookings",
  "bookings:manage": "Manage Bookings",
  "bookings:cancel": "Cancel Bookings",
  "bookings:refund": "Process Refunds",
  // Coaches
  "coaches:view": "View Coaches",
  "coaches:manage": "Manage Coaches",
  "coaches:verify": "Verify Coaches",
  "coaches:delete": "Delete Coaches",
  // Inquiries
  "inquiries:view": "View Inquiries",
  "inquiries:manage": "Manage Inquiries",
  "inquiries:delete": "Delete Inquiries",
  // Disputes
  "disputes:view": "View Disputes",
  "disputes:manage": "Manage Disputes",
  "disputes:resolve": "Resolve Disputes",
  // Analytics
  "analytics:view": "View Analytics",
  "analytics:export": "Export Reports",
  // Admins
  "admins:view": "View Admins",
  "admins:manage": "Manage Admins",
  "admins:delete": "Delete Admins",
  // Settings
  "settings:view": "View Settings",
  "settings:manage": "Manage Settings",
  // Reviews
  "reviews:view": "View Reviews",
  "reviews:manage": "Manage Reviews",
  "reviews:delete": "Delete Reviews",
};

const formatPermissionLabel = (permission: string): string => {
  if (PERMISSION_LABELS[permission]) {
    return PERMISSION_LABELS[permission];
  }

  return permission
    .split("_")
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

  const canManageAdmins = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("admin");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { role?: string };
      return parsed.role === "SYSTEM_ADMIN";
    } catch {
      return false;
    }
  }, []);

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
        {visibleAdmins.length === 0 ? (
          <p className="text-slate-600">No admin accounts found.</p>
        ) : (
          <div className="space-y-3">
            {paginatedAdmins.map((admin) => (
              <div
                key={admin.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{admin.name}</p>
                    <p className="text-sm text-slate-600">{admin.email}</p>
                  </div>
                  <span className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-semibold text-power-orange">
                    {admin.role}
                  </span>
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
    </div>
  );
}
