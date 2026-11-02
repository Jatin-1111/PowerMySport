"use client";

import { useRoleGuard } from "@/modules/auth/hooks/useRoleGuard";
import { authApi } from "@/modules/auth/services/auth";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { RouteGateScreen } from "@/modules/shared/components/RouteGateScreen";
import {
  BarChart2,
  Bell,
  ClipboardList,
  Globe,
  IndianRupee,
  LayoutDashboard,
  Settings,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const unreadNotifications = useUnreadNotificationCount();

  // Who may be here — and the /academy/onboarding exemption — is declared in
  // src/flow/policy.ts, not repeated here.
  const guard = useRoleGuard();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      logout();
      router.push("/");
    }
  };

  const navItems: DashboardNavItem[] = [
    { href: "/academy", label: "Overview", icon: LayoutDashboard },
    { href: "/academy/onboarding", label: "Academy setup", icon: ClipboardList },
    // This is the directory where academies are listed, not the owner's own page:
    // the overview links to that once the academy is live.
    { href: "/booking?tab=academies", label: "Academy directory", icon: Globe },
    // Venues, Coaches, Plans and Bookings were listed here but none of those
    // routes exist — four 404s in the console partners are onboarded into. They
    // are removed rather than stubbed; `tests/navLinks.test.ts` now fails the
    // build if a nav href stops resolving to a real page.
    { href: "/academy/earnings", label: "Earnings", icon: IndianRupee, section: "Performance" },
    { href: "/academy/reviews", label: "Reviews", icon: Star, section: "Performance" },
    { href: "/academy/analytics", label: "Analytics", icon: BarChart2, section: "Performance" },
    {
      href: "/academy/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      section: "Account",
    },
    { href: "/academy/settings", label: "Settings", icon: Settings, section: "Account" },
  ];

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  return (
    <DashboardShell
      dashboardLabel="Academy console"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
