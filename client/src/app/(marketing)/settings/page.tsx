"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { UserRole } from "@/types";
import { Settings, Shield, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const roleSettingsLinks: Record<
  UserRole,
  Array<{ href: string; label: string; description: string }>
> = {
  PLAYER: [
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      description: "Update personal details and manage dependents.",
    },
    {
      href: "/dashboard/my-bookings",
      label: "Bookings",
      description: "View and manage your bookings.",
    },
  ],
  VENUE_LISTER: [
    {
      href: "/venue-lister/profile",
      label: "Profile",
      description: "Update personal details and profile photo.",
    },
    {
      href: "/onboarding",
      label: "Onboarding",
      description: "Complete venue onboarding and verification steps.",
    },
    {
      href: "/venue-lister/inventory",
      label: "Inventory",
      description: "Manage venues, slots, and availability.",
    },
  ],
  COACH: [
    {
      href: "/coach/profile",
      label: "Coach Profile",
      description: "Update your coaching profile and service details.",
    },
    {
      href: "/coach/verification",
      label: "Verification",
      description: "Track and complete coach verification requirements.",
    },
  ],
};

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [router, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-power-orange/30 bg-power-orange/10 px-3 py-1 text-sm text-power-orange">
          <Settings size={14} />
          Account Settings
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-slate-600">
          Manage your account settings and role-specific preferences.
        </p>
      </div>

      <Card className="mb-6 bg-white">
        <div className="flex items-start gap-3 p-6">
          <UserCircle className="mt-0.5 text-slate-500" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Account</h2>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as <span className="font-medium">{user.name}</span> (
              {user.email})
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <Shield size={12} />
              Role: {user.role}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {roleSettingsLinks[user.role].map((item) => (
          <Card key={item.href} className="bg-white">
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {item.label}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
              <Link href={item.href}>
                <Button size="sm">Open</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
