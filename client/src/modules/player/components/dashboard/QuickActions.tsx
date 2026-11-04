"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import {
  Compass,
  HelpCircle,
  Map,
  Trophy,
  UserRoundSearch,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * The shortcuts worth keeping, in the order the product is offered.
 *
 * What PowerMySport does today is a roadmap, a community of parents, and help
 * carrying the plan out (an expert, the tournament calendar). The first four
 * shortcuts are those, and the rest are the two things a parent does to get
 * set up. Booking, venue and wallet shortcuts are deliberately absent: they
 * made the page read as a booking console.
 *
 * Admissions and Scholarships are not here yet. Their pages are empty until
 * entries are verified and published, and a shortcut to an empty page is a
 * dead end. Add them once something is live.
 */

interface QuickAction {
  href: string;
  icon: LucideIcon;
  label: string;
  color: string;
  /** Leaves the client app for the separate community app, so it is a plain link. */
  external?: boolean;
}

const pathway: QuickAction = {
  href: "/roadmap",
  icon: Map,
  label: "See the pathway",
  color: "bg-emerald-100 text-emerald-700",
};

const tournaments: QuickAction = {
  href: "/tournaments",
  icon: Trophy,
  label: "Tournaments",
  color: "bg-sky-100 text-sky-700",
};

const expert: QuickAction = {
  href: "/booking?tab=experts",
  icon: UserRoundSearch,
  label: "Connect with an expert",
  color: "bg-purple-100 text-purple-600",
};

const findSport: QuickAction = {
  href: "/assessment/discover",
  icon: Compass,
  label: "Find a sport",
  color: "bg-amber-100 text-amber-700",
};

const manageFamily: QuickAction = {
  href: "/dashboard/my-profile",
  icon: Users,
  label: "Manage family",
  color: "bg-orange-100 text-power-orange",
};

export function QuickActions() {
  const { isParent } = useDashboardAudience();

  // Opens the community's Q&A with the ask form already open; a signed-out
  // visitor is sent through login and back to it.
  const askCommunity: QuickAction = {
    href: getCommunityAppUrl({ path: "questions", searchParams: { ask: "1" } }),
    icon: HelpCircle,
    label: "Ask the community",
    color: "bg-teal-100 text-teal-700",
    external: true,
  };

  // A player has no children to manage and has already chosen a sport, so
  // their list is the four product shortcuts alone.
  const actions: QuickAction[] = isParent
    ? [pathway, tournaments, askCommunity, expert, findSport, manageFamily]
    : [pathway, tournaments, askCommunity, expert];

  return (
    <DashboardSection
      icon={Zap}
      title="Quick actions"
      description="Jump straight to the things you do most."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ href, icon: Icon, label, color, external }) => {
          const card = (
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
          );
          // `next/link` for pages in this app; a plain anchor for the
          // community app, which is a different origin in production.
          return external ? (
            <a key={href} href={href}>
              {card}
            </a>
          ) : (
            <Link key={href} href={href}>
              {card}
            </Link>
          );
        })}
      </div>
    </DashboardSection>
  );
}
