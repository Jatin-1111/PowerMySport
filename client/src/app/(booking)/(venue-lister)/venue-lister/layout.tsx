"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { useRouter } from "next/navigation";
import {
  BadgeIndianRupee,
  BookOpen,
  Calendar,
  Grid3x3,
  LayoutDashboard,
  Settings,
  User,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { payoutApi } from "@/modules/shared/services/payout";
import { PayoutBanner } from "@/modules/shared/components/payout/PayoutBanner";
import { IPayoutMethod } from "@/types";

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  // undefined = loading, null = no method, object = has method
  const [venuePayoutMethod, setVenuePayoutMethod] = useState<
    IPayoutMethod | null | undefined
  >(undefined);

  // Block coaches from accessing venue-lister routes
  // Coaches who want to list venues must create separate venue-lister credentials
  useEffect(() => {
    if (user && user.role !== "VENUE_LISTER") {
      router.replace("/");
    }
  }, [user, router]);

  // Silently check payout method for banner
  const loadPayoutStatus = useCallback(async () => {
    if (user?.role !== "VENUE_LISTER") return;
    try {
      const res = await payoutApi.getVenuePayoutMethod();
      setVenuePayoutMethod(res.data?.payoutMethod ?? null);
    } catch {
      setVenuePayoutMethod(null);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadPayoutStatus();
  }, [loadPayoutStatus]);

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
      href: "/venue-lister/payouts",
      label: "Payouts",
      icon: BadgeIndianRupee,
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
      {/* Payout banner – hidden on the payouts page itself */}
      {pathname !== "/venue-lister/payouts" && (
        <PayoutBanner
          payoutMethod={venuePayoutMethod}
          payoutHref="/venue-lister/payouts"
          ctaLabel="Set Up Payout Method"
        />
      )}
      {children}
    </DashboardShell>
  );
}
