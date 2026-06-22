"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { toast } from "@/lib/toast";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Building2,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Settings,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useEffect } from "react";

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const isOnboardingRoute = pathname.startsWith("/academy/onboarding");

  useEffect(() => {
    if (user && user.role !== "ACADEMY_OWNER" && !isOnboardingRoute) {
      toast.error(
        "Academy dashboard is limited to academy owners. Use onboarding to activate your academy.",
      );
      router.replace("/");
    }
  }, [isOnboardingRoute, router, user]);

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
      href: "/academies",
      label: "Public Profile",
      icon: Building2,
    },
    {
      href: "/academy/venues",
      label: "Venues",
      icon: Building2,
    },
    {
      href: "/academy/coaches",
      label: "Coaches",
      icon: Users,
    },
    {
      href: "/academy/plans",
      label: "Plans",
      icon: CreditCard,
    },
    {
      href: "/academy/bookings",
      label: "Bookings",
      icon: Calendar,
    },
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
