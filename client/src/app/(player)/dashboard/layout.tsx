"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardNavItem,
  DashboardShell,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { useRouter } from "next/navigation";
import {
  Calendar,
  MapPin,
  Settings,
  User,
  Users,
} from "lucide-react";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const communityUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://community.powermysport.com";

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

  const navItems = [
    {
      href: "/venues",
      label: "Browse Venues",
      icon: MapPin,
    },
    {
      href: "/coaches",
      label: "Browse Coaches",
      icon: Users,
    },
    {
      href: "/dashboard/my-bookings",
      label: "My Bookings",
      icon: Calendar,
    },
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      icon: User,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
    {
      href: communityUrl,
      label: "Community",
      icon: Users,
      external: true,
    },
  ] satisfies DashboardNavItem[];

  return (
    <DashboardShell
      dashboardLabel="Player Dashboard"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
