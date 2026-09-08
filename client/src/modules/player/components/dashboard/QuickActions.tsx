"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import { Calendar, Compass, MapPin, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * The shortcuts worth keeping.
 *
 * Booking survives here — parents do book — but as two of six rather than three
 * of five, and behind the things this dashboard is actually about. The old grid
 * led with "Booking" and "Find Coach", which is how the page ended up reading as
 * a booking console.
 */

interface QuickAction {
  href: string;
  icon: LucideIcon;
  label: string;
  color: string;
}

const SHARED: QuickAction[] = [
  {
    href: "/assessment/discover",
    icon: Compass,
    label: "Find a sport",
    color: "bg-amber-100 text-amber-700",
  },
  {
    href: "/booking?tab=coaches",
    icon: Users,
    label: "Find a coach",
    color: "bg-purple-100 text-purple-600",
  },
  {
    href: "/booking",
    icon: MapPin,
    label: "Book a venue",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    href: "/dashboard/my-bookings",
    icon: Calendar,
    label: "My bookings",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    href: "/dashboard/wallet",
    icon: Wallet,
    label: "My wallet",
    color: "bg-sky-100 text-sky-600",
  },
];

export function QuickActions() {
  const { isParent } = useDashboardAudience();

  const actions: QuickAction[] = isParent
    ? [
        {
          href: "/dashboard/my-profile",
          icon: Users,
          label: "Manage family",
          color: "bg-orange-100 text-power-orange",
        },
        ...SHARED,
      ]
    : SHARED;

  return (
    <DashboardSection
      icon={Zap}
      title="Quick actions"
      description="Jump straight to the things you do most."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href}>
            <motion.div
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/40 px-4 py-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </motion.div>
          </Link>
        ))}
      </div>
    </DashboardSection>
  );
}
