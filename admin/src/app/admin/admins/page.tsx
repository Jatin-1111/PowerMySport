"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { toast } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const PERMISSION_LABELS: Record<string, string> = {
  all_permissions: "All Permissions",
  manage_admins: "Manage Admins",
  manage_inquiries: "Manage Inquiries",
  manage_coach_verification: "Manage Coach Verification",
  manage_refunds_disputes: "Manage Refunds & Disputes",
  manage_settings: "Manage Settings",
  view_users: "View Users",
  view_venues: "View Venues",
  view_bookings: "View Bookings",
  view_analytics: "View Analytics",
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvitationEmail, setLastInvitationEmail] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "ADMIN" as "ADMIN" | "SUPER_ADMIN",
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
      return parsed.role === "SUPER_ADMIN";
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

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminApi.createAdmin(form);
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
        role: "ADMIN",
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
      const roleRank = (value: "ADMIN" | "SUPER_ADMIN") =>
        value === "SUPER_ADMIN" ? 0 : 1;
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
          Enter name, email, and role. A temporary password is auto-generated
          and sent via email. Admin must change it on first login.
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

        <form
          onSubmit={handleCreateAdmin}
          className="grid gap-4 md:grid-cols-2"
        >
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  role: event.target.value as "ADMIN" | "SUPER_ADMIN",
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-power-orange focus:ring-2 focus:ring-power-orange/30"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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
                    {admin.permissions.map((permission) => (
                      <span
                        key={`${admin.id}-${permission}`}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          permission === "all_permissions"
                            ? "bg-power-orange/10 text-power-orange border border-power-orange/20"
                            : permission.startsWith("manage_")
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {formatPermissionLabel(permission)}
                      </span>
                    ))}
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
