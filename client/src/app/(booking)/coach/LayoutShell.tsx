"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { toast } from "@/lib/toast";
import { useRoleGuard } from "@/modules/auth/hooks/useRoleGuard";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { coachApi } from "@/modules/coach/services/coach";
import { isCoachVerificationFlowComplete } from "@/modules/coach/utils/verification";
import {
    DashboardShell,
    type DashboardNavItem,
} from "@/modules/shared/components/dashboard/DashboardShell";
import { PayoutBanner } from "@/modules/shared/components/payout/PayoutBanner";
import { RouteGateScreen } from "@/modules/shared/components/RouteGateScreen";
import { payoutApi } from "@/modules/shared/services/payout";
import { IPayoutMethod } from "@/types";
import {
    BadgeIndianRupee,
    BarChart2,
    Calendar,
    CalendarDays,
  CalendarRange,
    CreditCard,
    Home,
    Settings,
    ShieldCheck,
    Star,
    User,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Safety net: if the gate ever disagrees with a redirect target again, stop
// bouncing after this many attempts and show a dead-end instead of looping.
const MAX_GATE_REDIRECTS = 3;

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  // Who may be here at all. The verification gate below is a separate,
  // narrower question — what a coach who IS allowed here may yet do.
  const guard = useRoleGuard();

  const [isGateLoading, setIsGateLoading] = useState(true);
  const [isVerificationLocked, setIsVerificationLocked] = useState(false);
  const [isGateStuck, setIsGateStuck] = useState(false);
  const lastGateToastKeyRef = useRef<string | null>(null);
  const gateRedirectCountRef = useRef(0);
  const communityUrl = getCommunityAppUrl();
  // undefined = still loading, null = no method, object = has method
  const [coachPayoutMethod, setCoachPayoutMethod] = useState<
    IPayoutMethod | null | undefined
  >(undefined);

  const redirectToVerification = useCallback(
    (toastKey: string, message: string) => {
      if (gateRedirectCountRef.current >= MAX_GATE_REDIRECTS) {
        setIsGateStuck(true);
        return;
      }

      gateRedirectCountRef.current += 1;

      if (lastGateToastKeyRef.current !== toastKey) {
        lastGateToastKeyRef.current = toastKey;
        toast.error(message);
      }

      router.replace("/coach/verification");
    },
    [router],
  );

  useEffect(() => {
    let isMounted = true;

    const checkCoachVerificationGate = async () => {
      if (user?.role !== "Coach") {
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

        if (isComplete) {
          // Cleared the gate — forget earlier redirects so a later re-lock
          // starts from a clean slate.
          gateRedirectCountRef.current = 0;
          setIsGateStuck(false);
        } else if (pathname !== "/coach/verification") {
          redirectToVerification(
            `incomplete:${pathname}`,
            "Coach verification incomplete",
          );
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(true);
        if (pathname !== "/coach/verification") {
          redirectToVerification(
            `fetch-failed:${pathname}`,
            "Unable to load coach profile",
          );
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
  }, [pathname, redirectToVerification, user?.role]);

  // Silently check payout method for banner
  const loadPayoutStatus = useCallback(async () => {
    if (user?.role !== "Coach") return;
    try {
      const res = await payoutApi.getCoachPayoutMethod();
      setCoachPayoutMethod(res.data?.payoutMethod ?? null);
    } catch {
      setCoachPayoutMethod(null); // show banner on error too
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
    { href: "/", label: "Home", icon: Home },
    { href: "/coach/profile", label: "Profile", icon: User },
    { href: "/coach/verification", label: "Verification", icon: ShieldCheck },
    { href: "/coach/billing", label: "Billing & Plan", icon: CreditCard },
    {
      href: "/coach/payouts",
      label: "Payouts",
      icon: BadgeIndianRupee,
    },
    {
      // Recurring classes, distinct from /coach/schedule (one-off availability):
      // a programme carries its own weekly pattern, roster and credit ledger.
      href: "/coach/programmes",
      label: "Programmes",
      icon: CalendarRange,
    },
    {
      href: "/coach/schedule",
      label: "Schedule",
      icon: CalendarDays,
    },
    {
      href: "/coach/clients",
      label: "Clients",
      icon: Users,
    },
    {
      href: "/coach/earnings",
      label: "Earnings",
      icon: BadgeIndianRupee,
    },
    {
      href: "/coach/reviews",
      label: "Reviews",
      icon: Star,
    },
    {
      href: "/coach/analytics",
      label: "Analytics",
      icon: BarChart2,
    },
    {
      href: "/coach/my-bookings",
      label: "My Bookings",
      icon: Calendar,
    },
    { href: "/coach/settings", label: "Settings", icon: Settings },
    {
      href: communityUrl,
      label: "Community",
      icon: Users,
      external: true,
    },
  ];

  const visibleNavItems = isVerificationLocked
    ? navItems.filter(
        (item) =>
          item.href === "/" ||
          item.href === "/coach/verification" ||
          item.external,
      )
    : navItems.filter((item) => item.href !== "/coach/verification");

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  if (
    isGateLoading &&
    user?.role === "Coach" &&
    pathname !== "/coach/verification"
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  // Gate kept redirecting without ever settling. Stop navigating and show a
  // dead-end rather than bouncing the coach between pages.
  if (isGateStuck && pathname !== "/coach/verification") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            We couldn&apos;t confirm your coach profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your verification details look incomplete. Open the verification page
            to finish setting up, or contact support if this keeps happening.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/coach/verification"
              className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Go to Verification
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go to Home
            </Link>
          </div>
        </div>
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
      {/* Incomplete profile banner */}
      {isVerificationLocked && pathname === "/coach/verification" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Your coach profile is incomplete. Complete verification to unlock all features.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Go to Home
          </a>
        </div>
      )}

      {/* Payout banner – only on pages other than /coach/payouts */}
      {!isVerificationLocked && pathname !== "/coach/payouts" && (
        <PayoutBanner
          payoutMethod={coachPayoutMethod}
          payoutHref="/coach/payouts"
          ctaLabel="Set Up Payout Method"
        />
      )}
      {children}
    </DashboardShell>
  );
}
