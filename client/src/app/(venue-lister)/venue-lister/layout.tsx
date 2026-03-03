"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Grid3x3,
  LayoutDashboard,
  Settings,
  User,
} from "lucide-react";
import React, { useEffect } from "react";

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Block coaches from accessing venue-lister routes
  // Coaches who want to list venues must create separate venue-lister credentials
  useEffect(() => {
    if (user && user.role !== "VENUE_LISTER") {
      router.replace("/");
    }
  }, [user, router]);

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
      href: "/venue-lister",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/onboarding",
      label: "Onboarding",
      icon: BookOpen,
    },
    {
      href: "/venue-lister/inventory",
      label: "Inventory",
      icon: Grid3x3,
    },
    {
      href: "/venue-lister/vendor-bookings",
      label: "Bookings",
      icon: Calendar,
    },
    {
      href: "/venue-lister/profile",
      label: "Profile",
      icon: User,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <DashboardShell
      dashboardLabel="Venue Lister Dashboard"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
