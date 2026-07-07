"use client";

import { authApi } from "@/modules/auth/services/auth";
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
import { useRouter } from "next/navigation";
import React from "react";

export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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
    { href: "/expert/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/expert/profile", label: "Profile & Availability", icon: UserCog },
    { href: "/expert/pathways", label: "Verify Pathways", icon: ShieldCheck },
    { href: "/expert/payouts", label: "Payouts", icon: BadgeIndianRupee },
    // Future route that can be uncommented as it is built:
    // { href: "/expert/sessions", label: "My Sessions", icon: CalendarCheck },
    { href: "/settings", label: "Settings", icon: Settings },
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
