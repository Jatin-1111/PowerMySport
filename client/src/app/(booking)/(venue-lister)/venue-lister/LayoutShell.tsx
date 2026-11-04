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
import { PayoutBanner } from "@/modules/shared/components/payout/PayoutBanner";
import { payoutApi } from "@/modules/shared/services/payout";
import { IPayoutMethod } from "@/types";
import {
  Bell,
  BarChart2,
  Building2,
  ClipboardCheck,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Settings,
  Star,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const unreadNotifications = useUnreadNotificationCount();
  // undefined = loading, null = no method, object = has method
  const [venuePayoutMethod, setVenuePayoutMethod] = useState<IPayoutMethod | null | undefined>(
    undefined
  );

  // Who may be here is declared in src/flow/policy.ts, not repeated here.
  const guard = useRoleGuard();

  // Silently check payout method for banner
  const loadPayoutStatus = useCallback(async () => {
    if (user?.role !== "VenueLister") return;
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
    { href: "/venue-lister", label: "Overview", icon: LayoutDashboard },
    { href: "/venue-lister/inventory", label: "Venues", icon: Building2, section: "Your venues" },
    {
      href: "/venue-lister/vendor-bookings",
      label: "Bookings",
      icon: ClipboardCheck,
      section: "Your venues",
    },
    { href: "/venue-lister/reviews", label: "Reviews", icon: Star, section: "Your venues" },
    {
      href: "/venue-lister/earnings",
      label: "Earnings",
      icon: IndianRupee,
      section: "Performance",
    },
    {
      href: "/venue-lister/analytics",
      label: "Analytics",
      icon: BarChart2,
      section: "Performance",
    },
    { href: "/venue-lister/profile", label: "Profile", icon: User, section: "Account" },
    { href: "/venue-lister/payouts", label: "Payouts", icon: Landmark, section: "Account" },
    {
      href: "/venue-lister/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      section: "Account",
    },
    { href: "/venue-lister/settings", label: "Settings", icon: Settings, section: "Account" },
  ];

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  return (
    <DashboardShell
      dashboardLabel="Venue console"
      userName={user?.name}
      navItems={navItems}
      onLogout={handleLogout}
    >
      {/* Payout banner – hidden on the payouts page itself */}
      {pathname !== "/venue-lister/payouts" && (
        <PayoutBanner
          payoutMethod={venuePayoutMethod}
          payoutHref="/venue-lister/payouts"
          ctaLabel="Set up payouts"
        />
      )}
      {children}
    </DashboardShell>
  );
}
