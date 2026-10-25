"use client";

import { adminApi } from "@/modules/admin/services/admin";
import { PendingCounts, statsApi } from "@/modules/analytics/services/stats";
import { CommandPalette } from "@/modules/shared/ui/CommandPalette";
import {
  GraduationCap,
  BarChart2,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Gavel,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Landmark,
  Map,
  Menu,
  MessageCircle,
  MessageSquareWarning,
  Package,
  Plus,
  ReceiptText,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tag,
  UserCheck,
  UserCircle2,
  Users,
  Webhook,
  Stethoscope,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type StoredAdmin = {
  name?: string;
  email?: string;
  role?: string;
  mustChangePassword?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const isAdminRouteActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

const NAV_BADGE_KEYS: Record<string, keyof PendingCounts> = {
  "/admin/academy-onboarding": "academyOnboarding",
  "/admin/coach-verification": "coachVerification",
  "/admin/venue-approval": "venueApprovals",
  "/admin/community-reports": "communityReports",
  "/admin/disputes": "disputes",
  "/admin/support-tickets": "supportTickets",
  "/admin/concierge-requests": "conciergeRequests",
  "/admin/webhook-recovery": "webhookErrors",
  "/admin/data-sources": "dataSourcesPending",
};

const getNavBadgeCount = (href: string, pendingCounts: PendingCounts | null): number => {
  if (!pendingCounts) return 0;
  const key = NAV_BADGE_KEYS[href];
  return key ? pendingCounts[key] : 0;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";
  const isChangePasswordPage = pathname === "/admin/change-password";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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
    () => null
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
  const isSuperAdmin =
    storedAdmin?.role === "SYSTEM_ADMIN" ||
    storedAdmin?.role === "SUPER_ADMIN" ||
    storedAdmin?.role === "Admin";
  const mustChangePassword = storedAdmin?.mustChangePassword === true;

  const navGroups = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        title: "Overview",
        items: [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
          {
            href: "/admin/notifications",
            label: "Notifications",
            icon: Bell,
          },
          {
            href: "/admin/whatsapp-pilot",
            label: "WhatsApp Pilot",
            icon: MessageCircle,
          },
          { href: "/admin/profile", label: "Profile", icon: UserCircle2 },
        ],
      },
      {
        title: "People",
        items: [
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/coaches", label: "Coaches", icon: Users },
          {
            href: "/admin/coaches/add",
            label: "Create Coach",
            icon: Plus,
          },
          {
            href: "/admin/coach-verification",
            label: "Coach Verification",
            icon: UserCheck,
          },
          { href: "/admin/academies", label: "Academies", icon: BookOpen },
          {
            href: "/admin/academies/add",
            label: "Create Academy",
            icon: Plus,
          },
          {
            href: "/admin/academy-onboarding",
            label: "Academy Onboarding",
            icon: CheckCircle,
          },
          { href: "/admin/experts", label: "Experts", icon: ShieldCheck },
        ],
      },
      {
        title: "Commerce",
        items: [
          { href: "/admin/bookings", label: "Bookings", icon: Calendar },
          { href: "/admin/payouts", label: "Payouts", icon: Landmark },
          { href: "/admin/venues", label: "Venues", icon: Building2 },
          {
            href: "/admin/venues/add",
            label: "Create Venue",
            icon: Plus,
          },
          {
            href: "/admin/venue-approval",
            label: "Venue Approvals",
            icon: CheckCircle,
          },
          { href: "/admin/products", label: "Products", icon: Package },
          { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
          { href: "/admin/refunds", label: "Refunds", icon: ReceiptText },
          { href: "/admin/disputes", label: "Disputes", icon: Gavel },
          { href: "/admin/reviews", label: "Reviews", icon: Star },
          { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag },
        ],
      },
      {
        title: "Content",
        items: [
          {
            href: "/admin/pathways",
            label: "Pathways",
            icon: Map,
          },
          {
            href: "/admin/opportunities",
            label: "Admissions & Scholarships",
            icon: GraduationCap,
          },
          {
            href: "/admin/screenings",
            label: "Screenings",
            icon: Stethoscope,
          },
          {
            href: "/admin/data-sources",
            label: "Data Sources",
            icon: Database,
          },
        ],
      },
      {
        title: "Trust & Support",
        items: [
          {
            href: "/admin/user-safety",
            label: "User Safety",
            icon: ShieldAlert,
          },
          {
            href: "/admin/community-reports",
            label: "Community Reports",
            icon: MessageSquareWarning,
          },
          {
            href: "/admin/support-tickets",
            label: "Support Tickets",
            icon: LifeBuoy,
          },
          {
            href: "/admin/concierge-requests",
            label: "Concierge Requests",
            icon: BookOpen,
          },
          {
            href: "/admin/webhook-recovery",
            label: "Webhook Recovery",
            icon: Webhook,
          },
        ],
      },
    ];

    if (isSuperAdmin) {
      groups.push({
        title: "System",
        items: [
          { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
          { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
        ],
      });
    }

    return groups;
  }, [isSuperAdmin]);

  const commandPaletteItems = useMemo(
    () =>
      navGroups.flatMap((group) =>
        group.items.map((item) => ({
          href: item.href,
          label: item.label,
          group: group.title,
          icon: item.icon,
        }))
      ),
    [navGroups]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  useEffect(() => {
    queueMicrotask(() => setIsMobileNavOpen(false));
  }, [pathname]);

  useEffect(() => {
    let isCancelled = false;

    const loadPendingCounts = async () => {
      try {
        const response = await statsApi.getPendingCounts();

        if (!isCancelled && response.success && response.data) {
          setPendingCounts(response.data);
        }
      } catch {
        if (!isCancelled) {
          setPendingCounts(null);
        }
      }
    };

    if (!isLoginPage && !isChangePasswordPage) {
      void loadPendingCounts();
    }

    return () => {
      isCancelled = true;
    };
  }, [isLoginPage, isChangePasswordPage]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileNavOpen]);

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

  // ── Desktop sidebar collapse ──
  // Persisted, because it is a workspace preference: an admin who works on a
  // laptop collapses it once and should not have to do it again on every page.
  // Read after mount rather than during render — the server has no localStorage,
  // and initialising from it would hydrate a rail against an expanded shell.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(localStorage.getItem("admin_sidebar_collapsed") === "1");
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const [isMobile, setIsMobile] = useState(false);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="admin-shell bg-background">
      <a
        href="#main-content"
        className="focus:bg-deep-slate sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="min-h-dvh lg:flex">
        {!isLoginPage && !isChangePasswordPage && (
          <>
            <div className="bg-deep-slate sticky top-0 z-30 border-b border-slate-800 px-4 py-3 text-white lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-400">Admin</p>
                  <p className="text-sm font-semibold text-white">PowerMySport</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Log out
                  </button>
                  <button
                    type="button"
                    aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={isMobileNavOpen}
                    onClick={() => setIsMobileNavOpen((prev) => !prev)}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition-colors hover:bg-white/10"
                  >
                    {isMobileNavOpen ? <X size={18} /> : <Menu size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {isMounted && isMobileNavOpen && (
              <button
                type="button"
                aria-label="Close mobile navigation"
                onClick={() => setIsMobileNavOpen(false)}
                className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
              />
            )}

            {isMounted && isMobileNavOpen && (
              <aside className="fixed right-0 top-0 z-40 h-dvh w-[88vw] max-w-sm border-l border-slate-200 bg-white shadow-xl lg:hidden">
                <div className="flex h-full flex-col">
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          Navigation
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{adminName}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setIsMobileNavOpen(false)}
                        className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <nav
                    aria-label="Admin sections"
                    className="flex-1 space-y-5 overflow-y-auto px-4 py-4"
                  >
                    {navGroups.map((group) => (
                      <div key={`mobile-group-${group.title}`}>
                        <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-slate-500">
                          {group.title}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = isAdminRouteActive(pathname, item.href);

                            return (
                              <Link
                                key={`mobile-${item.href}`}
                                href={item.href}
                                onClick={() => setIsMobileNavOpen(false)}
                                aria-current={isActive ? "page" : undefined}
                                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                  isActive
                                    ? "bg-orange-50 text-orange-900"
                                    : "text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {isActive && (
                                  <span
                                    aria-hidden
                                    className="bg-power-orange-solid absolute inset-y-2 left-0 w-0.5 rounded-full"
                                  />
                                )}
                                <Icon size={17} />
                                <span className="text-sm font-medium">{item.label}</span>
                                {getNavBadgeCount(item.href, pendingCounts) > 0 && (
                                  <span className="bg-power-orange-solid ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                                    {getNavBadgeCount(item.href, pendingCounts)}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>

                  <div className="border-t border-slate-200 p-4">
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              </aside>
            )}

            {isMounted && !isMobile && (
              <aside
                className={`bg-deep-slate fixed left-0 top-0 hidden h-dvh flex-col overflow-y-auto overflow-x-hidden border-r border-slate-800 text-slate-300 transition-[width] duration-200 [scrollbar-color:#334155_transparent] [scrollbar-width:thin] lg:flex ${
                  isSidebarCollapsed ? "w-20" : "w-72"
                }`}
              >
                {/* ── Brand ──
                       Collapsed, the wordmark shrinks to the square mark so the
                       rail still reads as PowerMySport rather than a bare strip of
                       icons. */}
                <div className={isSidebarCollapsed ? "px-3 pb-3 pt-5" : "px-5 pb-4 pt-6"}>
                  <div
                    className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : ""}`}
                  >
                    <span
                      className="bg-power-orange-solid flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                      title={isSidebarCollapsed ? `PowerMySport · ${adminName}` : undefined}
                    >
                      PMS
                    </span>
                    {!isSidebarCollapsed && (
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-white">
                          PowerMySport
                        </p>
                        <p className="truncate text-xs text-slate-400">{adminName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Collapse toggle ── */}
                <div className={isSidebarCollapsed ? "px-3 pb-2" : "px-5 pb-2"}>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-expanded={!isSidebarCollapsed}
                    title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
                      isSidebarCollapsed ? "justify-center" : ""
                    }`}
                  >
                    {isSidebarCollapsed ? (
                      <ChevronsRight size={16} />
                    ) : (
                      <>
                        <ChevronsLeft size={16} />
                        <span className="flex-1 text-left">Collapse</span>
                      </>
                    )}
                  </button>
                </div>

                {/* ── Search ──
                       Kept in the rail as an icon: with the labels gone it is the
                       fastest way to reach a page by name, so hiding it would make
                       collapsing cost more than it saves. */}
                <div className={isSidebarCollapsed ? "px-3 pb-2" : "px-5 pb-2"}>
                  <button
                    type="button"
                    onClick={() => setIsCommandPaletteOpen(true)}
                    title="Search pages (⌘K)"
                    aria-label="Search pages"
                    className={`flex min-h-10 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
                      isSidebarCollapsed ? "justify-center" : ""
                    }`}
                  >
                    <Search size={15} />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left">Search pages</span>
                        <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                          ⌘K
                        </kbd>
                      </>
                    )}
                  </button>
                </div>

                <nav
                  aria-label="Admin sections"
                  className={`mt-3 space-y-5 pb-6 ${isSidebarCollapsed ? "px-2" : "px-3"}`}
                >
                  {navGroups.map((group) => (
                    <div key={group.title}>
                      {/* Collapsed, the group heading becomes a rule. The grouping
                          is still worth showing, but 11px of truncated text in an
                          80px rail is not readable. */}
                      {isSidebarCollapsed ? (
                        <div aria-hidden className="mx-3 mb-2 border-t border-white/10" />
                      ) : (
                        <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-slate-400">
                          {group.title}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = isAdminRouteActive(pathname, item.href);
                          const badgeCount = getNavBadgeCount(item.href, pendingCounts);

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              // The label becomes the tooltip when it is not on
                              // screen. A rail of unlabelled icons is otherwise a
                              // memory test, and several of these icons repeat —
                              // Users, Plus and CheckCircle each appear twice.
                              title={
                                isSidebarCollapsed
                                  ? badgeCount > 0
                                    ? `${item.label} (${badgeCount})`
                                    : item.label
                                  : undefined
                              }
                              aria-label={isSidebarCollapsed ? item.label : undefined}
                              aria-current={isActive ? "page" : undefined}
                              className={`relative flex min-h-10 items-center rounded-lg transition-colors ${
                                isSidebarCollapsed
                                  ? "justify-center px-0 py-2.5"
                                  : "gap-3 px-3 py-2"
                              } ${
                                isActive
                                  ? "bg-white/10 text-white"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              {isActive && (
                                <span
                                  aria-hidden
                                  className="bg-power-orange absolute inset-y-2 left-0 w-0.5 rounded-full"
                                />
                              )}
                              <Icon size={18} />
                              {isSidebarCollapsed ? (
                                // A count would not fit, so it degrades to a dot
                                // that says "something is waiting here".
                                badgeCount > 0 && (
                                  <span
                                    aria-hidden
                                    className="bg-power-orange absolute right-2 top-2 h-2 w-2 rounded-full"
                                  />
                                )
                              ) : (
                                <>
                                  <span className="text-sm font-medium">{item.label}</span>
                                  {badgeCount > 0 && (
                                    <span className="bg-power-orange-solid ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                                      {badgeCount}
                                    </span>
                                  )}
                                </>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                <div
                  className={`mt-auto border-t border-white/10 ${
                    isSidebarCollapsed ? "p-3" : "p-4"
                  }`}
                >
                  <button
                    onClick={handleLogout}
                    title={isSidebarCollapsed ? "Log out" : undefined}
                    aria-label="Log out"
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
                  >
                    <LogOut size={16} />
                    {!isSidebarCollapsed && "Log out"}
                  </button>
                </div>
              </aside>
            )}
          </>
        )}

        <main
          id="main-content"
          className={`min-w-0 flex-1 transition-[margin] duration-200 ${
            isLoginPage || isChangePasswordPage ? "" : isSidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
          }`}
        >
          {isLoginPage || isChangePasswordPage ? (
            // Auth screens own their full-height layout; the padded content
            // container below would push them past 100dvh and make them scroll.
            children
          ) : (
            <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          )}
        </main>
      </div>

      {!isLoginPage && !isChangePasswordPage && (
        <CommandPalette
          open={isCommandPaletteOpen}
          items={commandPaletteItems}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={(href) => router.push(href)}
        />
      )}
    </div>
  );
}
