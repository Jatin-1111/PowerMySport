"use client";

import { Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

interface DashboardShellProps {
  dashboardLabel: string;
  userName?: string;
  navItems: DashboardNavItem[];
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
}

const isItemActive = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

const NavItems = ({
  items,
  pathname,
  onNavigate,
}: {
  items: DashboardNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) => {
  return (
    <nav className="mt-2 space-y-1 px-4">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(pathname, item.href);

        if (item.external) {
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Icon size={18} />
              <span className="text-sm font-semibold">{item.label}</span>
            </a>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
              active
                ? "bg-slate-100 text-slate-900"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon size={18} />
            <span className="text-sm font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export const DashboardShell = ({
  dashboardLabel,
  userName,
  navItems,
  onLogout,
  children,
}: DashboardShellProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const displayName = useMemo(() => {
    if (!userName?.trim()) {
      return "User";
    }

    return userName.trim();
  }, [userName]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {dashboardLabel}
            </p>
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
            aria-label="Open dashboard menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close dashboard menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] border-r border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {dashboardLabel}
                </p>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <NavItems
              items={navItems}
              pathname={pathname}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />

            <div className="border-t border-slate-200 p-4">
              <button
                onClick={async () => {
                  await onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen lg:pt-0">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white shadow-sm lg:flex lg:flex-col">
          <div className="p-6">
            <div className="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                {dashboardLabel}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">PowerMySport</h1>
              <p className="mt-1 text-sm text-slate-200">{displayName}</p>
            </div>
          </div>

          <NavItems items={navItems} pathname={pathname} />

          <div className="mt-auto border-t border-slate-200 p-6">
            <button
              onClick={onLogout}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
