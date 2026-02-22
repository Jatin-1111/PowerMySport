"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { coachApi } from "@/modules/coach/services/coach";
import { isCoachVerificationFlowComplete } from "@/modules/coach/utils/verification";
import { Calendar, ShieldCheck, Store, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

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
  const [isCoachVerified, setIsCoachVerified] = useState(false);

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
        const status =
          coach?.verificationStatus ||
          (coach?.isVerified ? "VERIFIED" : "UNVERIFIED");

        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(!isComplete);
        setIsCoachVerified(status === "VERIFIED");

        if (!isComplete && pathname !== "/coach/verification") {
          router.replace("/coach/verification");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setIsVerificationLocked(true);
        setIsCoachVerified(false);
        if (pathname !== "/coach/verification") {
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
      logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { href: "/coach/profile", label: "Profile", icon: User },
    { href: "/coach/verification", label: "Verification", icon: ShieldCheck },
    {
      href: "/coach/my-bookings",
      label: "My Bookings",
      icon: Calendar,
    },
  ];

  const visibleNavItems = isVerificationLocked
    ? navItems.filter((item) => item.href === "/coach/verification")
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
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Coach Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                PowerMySport
              </h1>
              <p className="mt-1 text-sm text-slate-200">{user?.name}</p>
            </div>
          </div>

          <nav className="mt-2 space-y-1 px-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Icon size={18} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-200 p-6">
            <button
              onClick={handleLogout}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
