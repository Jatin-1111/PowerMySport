"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/inquiries", label: "Venue Inquiries", icon: "📝" },
    { href: "/admin/users", label: "Users", icon: "👥" },
    { href: "/admin/venues", label: "All Venues", icon: "🏟️" },
    { href: "/admin/bookings", label: "All Bookings", icon: "📅" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="bg-deep-slate text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">PowerMySport Admin</h1>
          <Link
            href="/"
            className="text-sm hover:text-power-orange transition-colors"
          >
            ← Back to Site
          </Link>
        </div>
      </div>

      <div className="container mx-auto flex gap-6 p-6">
        {/* Sidebar */}
        <aside className="w-64 bg-card rounded-lg p-4 border border-border h-fit sticky top-6">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-power-orange text-white font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
