"use client";

import { authApi } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 shadow-xl flex flex-col relative">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-power-orange">PowerMySport</h1>
          <p className="text-slate-300 text-sm mt-2">{user?.name}</p>
        </div>

        <nav className="mt-8 flex-1">
          <Link
            href="/dashboard/search"
            className="flex items-center gap-3 px-6 py-3 text-slate-300 hover:bg-slate-800 hover:border-l-4 hover:border-power-orange transition-all"
          >
            <span>🔍</span>
            <span>Search Venues</span>
          </Link>
          <Link
            href="/dashboard/my-bookings"
            className="flex items-center gap-3 px-6 py-3 text-slate-300 hover:bg-slate-800 hover:border-l-4 hover:border-power-orange transition-all"
          >
            <span>📅</span>
            <span>My Bookings</span>
          </Link>
          <Link
            href="/dashboard/my-profile"
            className="flex items-center gap-3 px-6 py-3 text-slate-300 hover:bg-slate-800 hover:border-l-4 hover:border-power-orange transition-all"
          >
            <span>👤</span>
            <span>Profile</span>
          </Link>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
