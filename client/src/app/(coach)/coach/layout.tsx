"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Calendar } from "lucide-react";
import React from "react";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/coach/profile", label: "Profile", icon: <User size={20} /> },
    {
      href: "/coach/my-bookings",
      label: "Bookings",
      icon: <Calendar size={20} />,
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 shadow-xl flex flex-col relative">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-power-orange">PowerMySport</h1>
          <p className="text-slate-300 text-sm mt-2">Coach Portal</p>
        </div>

        <nav className="mt-8 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 transition-all ${
                pathname === item.href
                  ? "bg-power-orange text-white border-l-4 border-orange-600"
                  : "text-slate-300 hover:bg-slate-800 hover:border-l-4 hover:border-power-orange"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-700">
          <Link
            href="/"
            className="block w-full text-center px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            ? Back to Home
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
