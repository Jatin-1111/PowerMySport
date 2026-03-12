"use client";

import { adminApi } from "@/modules/admin/services/admin";
import {
  BarChart2,
  Bell,
  Building2,
  Calendar,
  CheckCircle,
  LifeBuoy,
  LayoutDashboard,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tag,
  UserCircle2,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useSyncExternalStore } from "react";

type StoredAdmin = {
  name?: string;
  email?: string;
  role?: string;
  mustChangePassword?: boolean;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";
  const isChangePasswordPage = pathname === "/admin/change-password";
  const storedAdminRaw = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("storage", handler);
      };
    },
    () => {
      if (typeof window === "undefined") {
        return null;
      }

      return localStorage.getItem("admin");
    },
    () => null,
  );

  const storedAdmin = useMemo<StoredAdmin | null>(() => {
    if (!storedAdminRaw) {
      return null;
    }

    try {
      return JSON.parse(storedAdminRaw) as StoredAdmin;
    } catch {
      return null;
    }
  }, [storedAdminRaw]);

  const adminName = storedAdmin?.name || storedAdmin?.email || "Admin";
  const isSuperAdmin = storedAdmin?.role === "SYSTEM_ADMIN";
  const mustChangePassword = storedAdmin?.mustChangePassword === true;

  useEffect(() => {
    if (!isLoginPage) {
      const token = localStorage.getItem("token");
      const adminData = localStorage.getItem("admin");

      if (!token || !adminData) {
        router.replace("/admin/login");
        return;
      }

      if (mustChangePassword && !isChangePasswordPage) {
        router.replace("/admin/change-password");
        return;
      }

      if (!mustChangePassword && isChangePasswordPage) {
        router.replace("/admin");
      }
    }
  }, [isLoginPage, isChangePasswordPage, mustChangePassword, router]);

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // No-op: local cleanup below is authoritative on client side
    }

    localStorage.removeItem("admin");
    localStorage.removeItem("token");
    router.replace("/admin/login");
  };

  const navItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/venue-approval",
      label: "Venue Approvals",
      icon: CheckCircle,
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: Users,
    },
    {
      href: "/admin/user-safety",
      label: "User Safety",
      icon: ShieldAlert,
    },
    {
      href: "/admin/venues",
      label: "All Venues",
      icon: Building2,
    },
    {
      href: "/admin/coach-verification",
      label: "Coach Verification",
      icon: UserCheck,
    },
    {
      href: "/admin/profile",
      label: "Profile",
      icon: UserCircle2,
    },
    {
      href: "/admin/bookings",
      label: "All Bookings",
      icon: Calendar,
    },
    {
      href: "/admin/reviews",
      label: "Reviews",
      icon: Star,
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: BarChart2,
    },
    {
      href: "/admin/support-tickets",
      label: "Support Tickets",
      icon: LifeBuoy,
    },
    {
      href: "/admin/promo-codes",
      label: "Promo Codes",
      icon: Tag,
    },
    {
      href: "/admin/community-reports",
      label: "Community Reports",
      icon: MessageSquareWarning,
    },
    {
      href: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
    },
    ...(isSuperAdmin
      ? [
          {
            href: "/admin/admins",
            label: "Admins",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Hidden on login page */}
        {!isLoginPage && !isChangePasswordPage && (
          <>
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Admin Dashboard
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    PowerMySport
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Logout
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={`mobile-${item.href}`}
                      href={item.href}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-power-orange text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-sm lg:flex">
              <div className="p-6">
                <div className="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white">
                  <p className="text-xs uppercase tracking-wide text-slate-300">
                    Admin Dashboard
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-white">
                    PowerMySport
                  </h1>
                  <p className="mt-1 text-sm text-slate-200">{adminName}</p>
                </div>
              </div>

              <nav className="mt-2 space-y-1 px-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                        isActive
                          ? "bg-power-orange text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-semibold">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-slate-200 p-6">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Logout
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main
          className={`flex-1 ${!isLoginPage && !isChangePasswordPage ? "lg:ml-72" : ""}`}
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
