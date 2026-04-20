"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  DashboardNavItem,
  DashboardShell,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { BottomNavItem } from "@/components/layout/BottomNav";
import { getCommunityAppUrl } from "@/lib/community/url";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Home,
  LifeBuoy,
  Mail,
  MapPin,
  Settings,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import React from "react";
import { useNotifications } from "@/hooks/useNotifications";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { counts } = useNotifications();
  const communityUrl = getCommunityAppUrl();

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
      section: "Discover",
    },
    {
      href: "/coaches",
      label: "Browse Coaches",
      icon: Users,
      section: "Discover",
    },
    {
      href: "/dashboard/my-bookings",
      label: "My Bookings",
      icon: Calendar,
      section: "Activity",
    },
    {
      href: "/dashboard/reminder-preferences",
      label: "Reminders",
      icon: Bell,
      section: "Activity",
    },
    {
      href: "/dashboard/friends",
      label: "Friends",
      icon: UserPlus,
      badge: counts.friendRequests > 0 ? counts.friendRequests : undefined,
      section: "Community",
    },
    {
      href: "/dashboard/invitations",
      label: "Invitations",
      icon: Mail,
      badge:
        counts.bookingInvitations > 0 ? counts.bookingInvitations : undefined,
      section: "Community",
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      badge: counts.inAppUnread > 0 ? counts.inAppUnread : undefined,
      section: "Community",
    },
    {
      href: "/saved",
      label: "Saved",
      icon: Calendar,
      section: "Community",
    },
    {
      href: "/dashboard/support",
      label: "Support Tickets",
      icon: LifeBuoy,
      section: "Account",
    },
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      icon: User,
      section: "Account",
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      section: "Account",
    },
    {
      href: communityUrl,
      label: "Community",
      icon: Users,
      external: true,
      section: "Account",
    },
  ] satisfies DashboardNavItem[];

  const bottomNavItems: BottomNavItem[] = [
    {
      href: "/dashboard",
      label: "Home",
      icon: Home,
    },
    {
      href: "/venues",
      label: "Venues",
      icon: MapPin,
    },
    {
      href: "/dashboard/friends",
      label: "Friends",
      icon: UserPlus,
      badge: counts.friendRequests > 0 ? counts.friendRequests : undefined,
    },
    {
      href: "/dashboard/invitations",
      label: "Invites",
      icon: Mail,
      badge:
        counts.bookingInvitations > 0 ? counts.bookingInvitations : undefined,
    },
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      icon: User,
    },
    {
      href: "/notifications",
      label: "Alerts",
      icon: Bell,
      badge: counts.inAppUnread > 0 ? counts.inAppUnread : undefined,
    },
  ];

  return (
    <DashboardShell
      dashboardLabel="Player Dashboard"
      userName={user?.name}
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
