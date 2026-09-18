"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import { Compass, UserRoundSearch, Users, Zap, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * The shortcuts worth keeping.
 *
 * Booking is deliberately absent. Venue/booking/wallet shortcuts made the page
 * read as a booking console; what this dashboard is actually about is the family
 * and the guidance around it, so only those three survive.
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
    href: "/booking?tab=experts",
    icon: UserRoundSearch,
    label: "Find an expert",
    color: "bg-purple-100 text-purple-600",
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
