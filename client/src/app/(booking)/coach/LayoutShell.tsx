"use client";

import { toast } from "@/lib/toast";
import { useRoleGuard } from "@/modules/auth/hooks/useRoleGuard";
import { authApi } from "@/modules/auth/services/auth";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
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
  ArrowLeft,
  Bell,
  BarChart2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Star,
  Ticket,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Safety net: if the gate ever disagrees with a redirect target again, stop
// bouncing after this many attempts and show a dead-end instead of looping.
const MAX_GATE_REDIRECTS = 3;

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const unreadNotifications = useUnreadNotificationCount();

  // Who may be here at all. The verification gate below is a separate,
  // narrower question — what a coach who IS allowed here may yet do.
  const guard = useRoleGuard();

  const [isGateLoading, setIsGateLoading] = useState(true);
  const [isVerificationLocked, setIsVerificationLocked] = useState(false);
  const [isGateStuck, setIsGateStuck] = useState(false);
  const lastGateToastKeyRef = useRef<string | null>(null);
  const gateRedirectCountRef = useRef(0);
  // undefined = still loading, null = no method, object = has method
  const [coachPayoutMethod, setCoachPayoutMethod] = useState<IPayoutMethod | null | undefined>(
    undefined
  );

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
    [router]
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
          redirectToVerification(`incomplete:${pathname}`, "Coach verification incomplete");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(true);
        if (pathname !== "/coach/verification") {
          redirectToVerification(`fetch-failed:${pathname}`, "Unable to load coach profile");
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

  // Grouped by what the coach is doing: running the week, checking how it is
  // going, and looking after the account. One icon per destination.
  const navItems: DashboardNavItem[] = [
    { href: "/coach", label: "Overview", icon: LayoutDashboard },
    { href: "/coach/verification", label: "Verification", icon: ShieldCheck },
    // The coach's inbox: booking requests to confirm or decline, and every
    // session after that.
    { href: "/coach/my-bookings", label: "Bookings", icon: ClipboardCheck, section: "Your week" },
    { href: "/coach/schedule", label: "Schedule", icon: CalendarDays, section: "Your week" },
    {
      // Recurring classes, distinct from /coach/schedule (one-off availability):
      // a programme carries its own weekly pattern, roster and credit ledger.
      href: "/coach/programmes",
      label: "Programmes",
      icon: CalendarRange,
      section: "Your week",
    },
    { href: "/coach/clients", label: "Clients", icon: Users, section: "Your week" },
    // The subscription packages a coach sells to clients, with who has bought them.
    { href: "/coach/billing", label: "Client packages", icon: Ticket, section: "Your week" },
    { href: "/coach/earnings", label: "Earnings", icon: IndianRupee, section: "Performance" },
    { href: "/coach/reviews", label: "Reviews", icon: Star, section: "Performance" },
    { href: "/coach/analytics", label: "Analytics", icon: BarChart2, section: "Performance" },
    { href: "/coach/profile", label: "Profile", icon: User, section: "Account" },
    { href: "/coach/payouts", label: "Payouts", icon: Landmark, section: "Account" },
    {
      href: "/coach/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      section: "Account",
    },
    { href: "/coach/settings", label: "Settings", icon: Settings, section: "Account" },
    // The way out to the public site. It stays available even while the
    // verification gate hides everything else.
    { href: "/", label: "Back to the site", icon: ArrowLeft },
  ];

  const visibleNavItems = isVerificationLocked
    ? navItems.filter((item) => item.href === "/" || item.href === "/coach/verification")
    : navItems.filter((item) => item.href !== "/coach/verification");

  if (guard !== "allowed") {
    return <RouteGateScreen />;
  }

  if (isGateLoading && user?.role === "Coach" && pathname !== "/coach/verification") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  // Gate kept redirecting without ever settling. Stop navigating and show a
  // dead-end rather than bouncing the coach between pages.
  if (isGateStuck && pathname !== "/coach/verification") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="font-editorial mt-3 text-lg font-normal text-slate-900">
            We couldn&apos;t confirm your coach profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your verification details look incomplete. Open the verification page to finish setting
            up, or contact support if this keeps happening.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/coach/verification"
              className="bg-power-orange-solid rounded-lg px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
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
      dashboardLabel="Coach console"
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
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
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
          ctaLabel="Set up payouts"
        />
      )}
      {children}
    </DashboardShell>
  );
}
