"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/auth";

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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-deep-slate shadow-lg">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-power-orange">PowerMySport</h1>
          <p className="text-ghost-white text-sm mt-2">{user?.name}</p>
        </div>

        <nav className="mt-8">
          <Link
            href="/bookings"
            className="block px-6 py-3 text-ghost-white hover:bg-power-orange/10 hover:border-l-4 hover:border-power-orange transition-all"
          >
            📅 My Bookings
          </Link>
          <Link
            href="/profile"
            className="block px-6 py-3 text-ghost-white hover:bg-power-orange/10 hover:border-l-4 hover:border-power-orange transition-all"
          >
            👤 Profile
          </Link>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={handleLogout}
            className="w-full bg-error-red text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
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
