"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { useDependents } from "@/modules/player/hooks/useDependents";
import { cn } from "@/utils/cn";
import { Bell, Mail, UserPlus, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";

/**
 * The things actually waiting on the user, and nothing else.
 *
 * The three tiles this replaces always rendered, and two of them showed "0" for
 * most users most of the time. A row that is usually all zeroes is a row people
 * learn to skip, which costs the one occasion it isn't. So a pill appears only
 * when its count is non-zero, and when nothing is pending the whole strip
 * renders `null` — silence is the success state, not an empty-state card.
 *
 * Counts come from `useNotifications`, which the dashboard nav already reads:
 * same React Query entries, so this adds no requests.
 */

interface ActionPillSpec {
  key: string;
  count: number;
  href: string;
  icon: LucideIcon;
  label: (n: number) => string;
  tone: string;
}

function ActionPill({ spec }: { spec: ActionPillSpec }) {
  const Icon = spec.icon;
  return (
    <Link
      href={spec.href}
      className={cn(
        "premium-shadow flex items-center gap-3 rounded-xl border bg-white/70 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        spec.tone
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{spec.label(spec.count)}</span>
    </Link>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function ActionCenter() {
  const { counts } = useNotifications();
  const { incompleteCount } = useDependents();

  const specs: ActionPillSpec[] = [
    {
      key: "friends",
      count: counts.friendRequests,
      href: "/dashboard/friends",
      icon: UserPlus,
      label: (n) => `${n} friend ${plural(n, "request", "requests")}`,
      tone: "border-indigo-200 text-indigo-700",
    },
    {
      key: "invitations",
      count: counts.bookingInvitations,
      href: "/dashboard/invitations",
      icon: Mail,
      label: (n) => `${n} ${plural(n, "invitation", "invitations")}`,
      tone: "border-orange-200 text-orange-700",
    },
    {
      key: "profiles",
      count: incompleteCount,
      href: "/dashboard/my-profile",
      icon: UserCog,
      label: (n) => `${n} ${plural(n, "profile", "profiles")} to finish`,
      tone: "border-amber-200 text-amber-700",
    },
    {
      key: "unread",
      count: counts.inAppUnread,
      href: "/notifications",
      icon: Bell,
      label: (n) => `${n} unread ${plural(n, "notification", "notifications")}`,
      tone: "border-slate-200 text-slate-700",
    },
  ];

  const pending = specs.filter((spec) => spec.count > 0);
  if (pending.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {pending.map((spec) => (
        <ActionPill key={spec.key} spec={spec} />
      ))}
    </div>
  );
}
