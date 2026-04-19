"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { coachApi } from "@/modules/coach/services/coach";
import { isCoachVerificationFlowComplete } from "@/modules/coach/utils/verification";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { toast } from "@/lib/toast";
import { getCommunityAppUrl } from "@/lib/community/url";
import {
  Calendar,
  CreditCard,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isGateLoading, setIsGateLoading] = useState(true);
  const [isVerificationLocked, setIsVerificationLocked] = useState(false);
  const lastGateToastKeyRef = useRef<string | null>(null);
  const communityUrl = getCommunityAppUrl();

  useEffect(() => {
    let isMounted = true;

    const checkCoachVerificationGate = async () => {
      if (user?.role !== "COACH") {
        if (isMounted) {
          setIsVerificationLocked(false);
          setIsGateLoading(false);
        }
        return;
      }

      try {
        const response = await coachApi.getMyProfile();
        const coach = response.success ? response.data : null;
        const isComplete = isCoachVerificationFlowComplete(coach ?? null);

        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(!isComplete);

        if (!isComplete && pathname !== "/coach/verification") {
          const toastKey = `incomplete:${pathname}`;
          if (lastGateToastKeyRef.current !== toastKey) {
            lastGateToastKeyRef.current = toastKey;
            toast.error(
              "Coach verification is incomplete. Redirected to verification page.",
            );
          }
          router.replace("/coach/verification");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(true);
        if (pathname !== "/coach/verification") {
          const toastKey = `fetch-failed:${pathname}`;
          if (lastGateToastKeyRef.current !== toastKey) {
            lastGateToastKeyRef.current = toastKey;
            toast.error(
              "Unable to load coach profile. Redirected to verification page.",
            );
          }
          router.replace("/coach/verification");
        }
      } finally {
        if (isMounted) {
          setIsGateLoading(false);
        }
      }
    };

    void checkCoachVerificationGate();

    return () => {
      isMounted = false;
    };
  }, [pathname, router, user?.role]);

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
    { href: "/coach/profile", label: "Profile", icon: User },
    { href: "/coach/verification", label: "Verification", icon: ShieldCheck },
    { href: "/coach/billing", label: "Billing & Plan", icon: CreditCard },
    {
      href: "/coach/my-bookings",
      label: "My Bookings",
      icon: Calendar,
    },
    { href: "/settings", label: "Settings", icon: Settings },
    {
      href: communityUrl,
      label: "Community",
      icon: Users,
      external: true,
    },
  ];

  const visibleNavItems = isVerificationLocked
    ? navItems.filter(
        (item) => item.href === "/coach/verification" || item.external,
      )
    : navItems;

  if (
    isGateLoading &&
    user?.role === "COACH" &&
    pathname !== "/coach/verification"
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  return (
    <DashboardShell
      dashboardLabel="Coach Dashboard"
      userName={user?.name}
      navItems={visibleNavItems}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
