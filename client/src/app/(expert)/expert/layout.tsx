"use client";

import { authApi } from "@/modules/auth/services/auth";
import { expertApi } from "@/modules/expert/services/expert";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
    DashboardShell,
    type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import {
    BadgeIndianRupee,
    LayoutDashboard,
    Settings,
    ShieldCheck,
    UserCog,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect } from "react";

export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

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
    expertApi.getMyProfile().then((res) => {
      if (res.success && res.data) {
        if (res.data.verificationStatus !== "APPROVED") {
          router.replace("/expert/onboarding");
        }
      }
    }).catch(() => {});
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

  const isOnboarding = pathname === "/expert/onboarding";

  const navItems: DashboardNavItem[] = isOnboarding
    ? []
    : [
        { href: "/expert/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/expert/profile", label: "Profile & Availability", icon: UserCog },
        { href: "/expert/pathways", label: "Verify Pathways", icon: ShieldCheck },
        { href: "/expert/payouts", label: "Payouts", icon: BadgeIndianRupee },
        // Future route that can be uncommented as it is built:
        // { href: "/expert/sessions", label: "My Sessions", icon: CalendarCheck },
        { href: "/expert/settings", label: "Settings", icon: Settings },
      ];

  return (
    <DashboardShell
      dashboardLabel="Expert Dashboard"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
