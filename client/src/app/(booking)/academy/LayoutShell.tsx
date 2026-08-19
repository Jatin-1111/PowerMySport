"use client";

import { useRoleGuard } from "@/modules/auth/hooks/useRoleGuard";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
    DashboardShell,
    type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { RouteGateScreen } from "@/modules/shared/components/RouteGateScreen";
import {
    BarChart2,
    Building2,
    LayoutDashboard,
    Settings,
    Star,
    TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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
    {
      href: "/academy/onboarding",
      label: "Onboarding",
      icon: LayoutDashboard,
    },
    {
      href: "/academy",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/booking?tab=academies",
      label: "Public Profile",
      icon: Building2,
    },
    // Venues, Coaches, Plans and Bookings were listed here but none of those
    // routes exist — four 404s in the console partners are onboarded into. They
    // are removed rather than stubbed; `tests/navLinks.test.ts` now fails the
    // build if a nav href stops resolving to a real page.
    {
      href: "/academy/earnings",
      label: "Earnings",
      icon: TrendingUp,
    },
    {
      href: "/academy/reviews",
      label: "Reviews",
      icon: Star,
    },
    {
      href: "/academy/analytics",
      label: "Analytics",
      icon: BarChart2,
    },
    {
      href: "/academy/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  return (
    <DashboardShell
      dashboardLabel="Academy Owner Dashboard"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
