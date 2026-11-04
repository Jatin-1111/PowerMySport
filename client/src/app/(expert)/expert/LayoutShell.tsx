"use client";

import { useRoleGuard } from "@/modules/auth/hooks/useRoleGuard";
import { authApi } from "@/modules/auth/services/auth";
import { expertApi } from "@/modules/expert/services/expert";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { RouteGateScreen } from "@/modules/shared/components/RouteGateScreen";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Landmark,
  LayoutDashboard,
  Settings,
  User,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect } from "react";

export default function ExpertLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const unreadNotifications = useUnreadNotificationCount();

  const guard = useRoleGuard();

  useEffect(() => {
    // Redirect any not-yet-approved expert to onboarding unless they're
    // already there — it renders the right sub-state itself (PENDING shows
    // the "under review" screen, REJECTED reopens step 1 to fix & resubmit).
    // Previously this only caught UNVERIFIED, so a PENDING/REJECTED expert
    // saw the full dashboard UI even though every server-side action for
    // them now correctly rejects with 403 — confusing, and no actual
    // security boundary since the real gate is server-side regardless.
    if (!user || user.role !== "EXPERT") return;
    if (pathname === "/expert/onboarding") return;
    expertApi
      .getMyProfile()
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.verificationStatus !== "APPROVED") {
            router.replace("/expert/onboarding");
          }
        }
      })
      .catch(() => {});
  }, [user, pathname, router]);

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

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  const isOnboarding = pathname === "/expert/onboarding";

  const navItems: DashboardNavItem[] = isOnboarding
    ? []
    : [
        { href: "/expert/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/expert/sessions", label: "Sessions", icon: CalendarDays, section: "Your work" },
        { href: "/expert/profile", label: "Profile", icon: User, section: "Your work" },
        { href: "/expert/payouts", label: "Payouts", icon: Landmark, section: "Account" },
        {
          href: "/expert/notifications",
          label: "Notifications",
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
          section: "Account",
        },
        { href: "/expert/settings", label: "Settings", icon: Settings, section: "Account" },
        { href: "/", label: "Back to the site", icon: ArrowLeft },
      ];

  return (
    <DashboardShell
      dashboardLabel="Expert console"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
