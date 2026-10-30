"use client";

import { BottomNav, BottomNavSpacer, type BottomNavItem } from "../BottomNav";
import { Badge } from "../../ui/Badge";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { findActiveHref } from "../../utils/activeNavHref";
import { useRailTooltip } from "./RailTooltip";
import { motion, useReducedMotion } from "framer-motion";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
  badge?: number | string;
  section?: string;
}

interface DashboardShellProps {
  dashboardLabel: string;
  userName?: string;
  navItems: DashboardNavItem[];
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
  bottomNavItems?: BottomNavItem[]; // Optional bottom nav items for mobile
}

const SIDEBAR_NAV_ID = "dashboard-sidebar-nav";
const SIDEBAR_WIDTH = { expanded: 288, rail: 64 } as const;
// Where the toggle sits (px from the sidebar's top-left corner) in each state.
const TOGGLE_POSITION = { expanded: { x: 214, y: 30 }, rail: { x: 10, y: 20 } } as const;

// Each switch fades the contents in, so labels and the brand card do not pop while the width moves.
const CONTENT_VARIANTS = { full: { opacity: [0, 1] }, rail: { opacity: [0, 1] } };

type TooltipBinder = ReturnType<typeof useRailTooltip>["bind"];

const NavItems = ({
  items,
  pathname,
  onNavigate,
  collapsed = false,
  bindTooltip,
}: {
  items: DashboardNavItem[];
  pathname: string;
  onNavigate?: () => void;
  /** Draw the icon rail: one icon per destination, labels kept for screen readers. */
  collapsed?: boolean;
  bindTooltip?: TooltipBinder;
}) => {
  const sections = items.reduce<Array<{ title?: string; items: DashboardNavItem[] }>>(
    (acc, item) => {
      const last = acc.at(-1);

      if (last && last.title === item.section) {
        last.items.push(item);
        return acc;
      }

      acc.push({ title: item.section, items: [item] });
      return acc;
    },
    []
  );

  const activeHref = findActiveHref(items, pathname);
  const base =
    "focus-visible:ring-power-orange flex items-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const sizing = collapsed ? "relative mx-auto h-11 w-11 justify-center" : "gap-3 px-3 py-2.5";

  return (
    <nav
      id={bindTooltip ? SIDEBAR_NAV_ID : undefined}
      className={`mt-1 flex-1 overflow-y-auto pb-4 ${
        collapsed
          ? "space-y-1 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "space-y-3 px-4"
      }`}
      aria-label="Main navigation"
    >
      {sections.map((section, sectionIndex) => (
        <div
          key={`${section.title ?? "general"}-${sectionIndex}`}
          // In the rail the group headings go and a thin line marks where one group ends.
          className={collapsed && sectionIndex > 0 ? "border-hairline mt-2 border-t pt-3" : ""}
        >
          {section.title && !collapsed && (
            <p className="text-ink-muted mb-1 px-3 text-xs font-medium">{section.title}</p>
          )}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;
              const badgeText = item.badge ? `, ${item.badge} pending` : "";
              const tooltip = collapsed && bindTooltip ? bindTooltip(item.label) : {};

              const inner = (
                <>
                  <Icon size={17} aria-hidden="true" />
                  <span className={collapsed ? "sr-only" : "text-sm font-medium"}>
                    {item.label}
                  </span>
                  {item.badge &&
                    (collapsed ? (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
                      />
                    ) : (
                      <Badge
                        variant="destructive"
                        className="ml-auto"
                        aria-label={`${item.badge} pending`}
                      >
                        {item.badge}
                      </Badge>
                    ))}
                </>
              );

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`${base} ${sizing} text-slate-700 hover:bg-slate-100`}
                    aria-label={`${item.label}${badgeText}`}
                    {...tooltip}
                  >
                    {inner}
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`${base} ${sizing} ${
                    active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-label={`${item.label}${badgeText}`}
                  aria-current={active ? "page" : undefined}
                  {...tooltip}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};

export const DashboardShell = ({
  dashboardLabel,
  userName,
  navItems,
  onLogout,
  bottomNavItems,
  children,
}: DashboardShellProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const { bind: bindTooltip, hide: hideTooltip, tooltip } = useRailTooltip();
  const reduceMotion = useReducedMotion();
  const sidebarTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

  const isCheckout = pathname.includes("/checkout");
  const shouldShowBottomNav = bottomNavItems && !isCheckout;
  const hasNav = navItems.length > 0;

  const displayName = useMemo(() => {
    if (!userName?.trim()) {
      return "User";
    }

    return userName.trim();
  }, [userName]);

  const railButton =
    "focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  // Icon-only and at the top of the sidebar in both states, so it never moves under the pointer
  // when it is used. The name is carried by aria-label and shown as a tooltip.
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const sidebarToggle = (
    <button
      type="button"
      onClick={() => {
        hideTooltip();
        setCollapsed(!collapsed);
      }}
      aria-expanded={!collapsed}
      aria-controls={SIDEBAR_NAV_ID}
      aria-label={toggleLabel}
      className={`${railButton} text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
      {...bindTooltip(toggleLabel)}
    >
      {collapsed ? (
        <PanelLeftOpen size={18} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={18} aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className="text-ink-muted text-xs">{dashboardLabel}</p>
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          </div>
          {hasNav && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/60 bg-white/90 text-slate-700"
              aria-label="Open dashboard menu"
            >
              <Menu size={18} />
            </button>
          )}
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close dashboard menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[88vw] max-w-sm flex-col border-r border-white/60 bg-white/95 shadow-lg backdrop-blur-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/60 p-4">
              <div>
                <p className="text-ink-muted text-xs">{dashboardLabel}</p>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 text-slate-700"
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

            <div className="mt-auto shrink-0 border-t border-white/60 p-4">
              <button
                onClick={async () => {
                  await onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen lg:pt-0">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.expanded }}
          transition={sidebarTransition}
          className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-white/60 bg-white/80 shadow-sm backdrop-blur-md lg:flex lg:flex-col"
        >
          {/* One element for both states, so keyboard focus stays on it across a switch. It sits
              in the corner of the brand card when expanded and at the top of the rail when not. */}
          <motion.div
            initial={false}
            animate={collapsed ? TOGGLE_POSITION.rail : TOGGLE_POSITION.expanded}
            transition={sidebarTransition}
            className="absolute left-0 top-0 z-10"
          >
            {sidebarToggle}
          </motion.div>

          <motion.div
            initial={false}
            variants={CONTENT_VARIANTS}
            animate={collapsed ? "rail" : "full"}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay: 0.08 }}
            className="flex min-h-0 flex-1 flex-col whitespace-nowrap"
          >
            {collapsed ? (
              <div className="h-19 shrink-0" aria-hidden="true" />
            ) : (
              <div className="shrink-0 p-6">
                <div className="rounded-2xl border border-white/70 bg-white p-5 text-slate-900 shadow-sm">
                  <p className="text-ink-muted text-xs">{dashboardLabel}</p>
                  <h1 className="font-editorial mt-2 text-2xl font-normal text-slate-900">
                    PowerMySport
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">{displayName}</p>
                </div>
              </div>
            )}

            <NavItems
              items={navItems}
              pathname={pathname}
              collapsed={collapsed}
              bindTooltip={bindTooltip}
            />

            <div
              className={`border-hairline mt-auto shrink-0 border-t ${
                collapsed ? "flex justify-center px-2 py-4" : "p-6"
              }`}
            >
              {collapsed ? (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Logout"
                  className={`${railButton} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                  {...bindTooltip("Logout")}
                >
                  <LogOut size={17} aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={onLogout}
                  className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        </motion.aside>

        {/* overflow-x-clip (not -hidden): hidden computes overflow-y to
            `auto`, making <main> a second scroll container nested inside the
            page scroller; clip just clips without creating one. */}
        <main className="flex-1 overflow-x-clip pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
          {shouldShowBottomNav && <BottomNavSpacer />}
        </main>
      </div>

      {tooltip}

      {/* Mobile Bottom Navigation */}
      {shouldShowBottomNav && <BottomNav items={bottomNavItems} />}
    </div>
  );
};
