"use client";

import {
  Building2,
  Calendar,
  CheckCircle,
  LayoutDashboard,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState<string>("");

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    // Get admin info from localStorage
    const adminData = localStorage.getItem("admin");
    if (adminData) {
      try {
        const admin = JSON.parse(adminData);
        setAdminName(admin.name || admin.email || "Admin");
      } catch (e) {
        setAdminName("Admin");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin");
    localStorage.removeItem("token");
    router.push("/admin/login");
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
      href: "/admin/bookings",
      label: "All Bookings",
      icon: Calendar,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar - Hidden on login page */}
        {!isLoginPage && (
          <aside className="fixed left-0 top-0 h-screen w-72 border-r border-slate-200 bg-white shadow-sm flex flex-col overflow-y-auto">
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
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Icon size={18} />
                    <span className="text-sm font-semibold">{item.label}</span>
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
        )}

        {/* Main Content */}
        <main className={`flex-1 ${!isLoginPage ? "ml-72" : ""}`}>
          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
