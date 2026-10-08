import {
  Bell,
  Calendar,
  ClipboardCheck,
  CreditCard,
  MessageCircle,
  Settings,
  Star,
  Users,
} from "lucide-react";
import type React from "react";

// How each notification category is drawn on the notifications page: icon and
// colours. A category with no entry falls back to a plain Bell on slate, so a
// new server-side category renders as something rather than breaking, but it
// should still get its own entry here (PLAN was added after check-in nudges
// were found wearing the "Booking" badge).

export const getNotificationIcon = (category: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    SOCIAL: Users,
    BOOKING: Calendar,
    PAYMENT: CreditCard,
    REVIEW: Star,
    ADMIN: Settings,
    COMMUNITY: MessageCircle,
    PLAN: ClipboardCheck,
  };
  return iconMap[category] || Bell;
};

const categoryConfig: Record<
  string,
  {
    iconWrap: string;
    iconColor: string;
    badge: string;
    dot: string;
    accent: string;
    unreadBg: string;
  }
> = {
  SOCIAL: {
    iconWrap: "bg-sky-100",
    iconColor: "text-sky-600",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    dot: "bg-sky-500",
    accent: "border-l-sky-400",
    unreadBg: "bg-sky-50/40",
  },
  BOOKING: {
    iconWrap: "bg-indigo-100",
    iconColor: "text-indigo-600",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-violet-200",
    dot: "bg-violet-500",
    accent: "border-l-violet-400",
    unreadBg: "bg-indigo-50/30",
  },
  PAYMENT: {
    iconWrap: "bg-emerald-100",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-turf-green",
    accent: "border-l-emerald-400",
    unreadBg: "bg-emerald-50/30",
  },
  REVIEW: {
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-400",
    accent: "border-l-amber-400",
    unreadBg: "bg-amber-50/30",
  },
  ADMIN: {
    iconWrap: "bg-slate-100",
    iconColor: "text-slate-600",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    accent: "border-l-slate-400",
    unreadBg: "bg-slate-50/40",
  },
  COMMUNITY: {
    iconWrap: "bg-orange-100",
    iconColor: "text-orange-600",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "bg-power-orange",
    accent: "border-l-orange-400",
    unreadBg: "bg-orange-50/30",
  },
  PLAN: {
    iconWrap: "bg-teal-100",
    iconColor: "text-teal-600",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    dot: "bg-teal-500",
    accent: "border-l-teal-400",
    unreadBg: "bg-teal-50/30",
  },
};

export const getConfig = (category: string) =>
  categoryConfig[category] ?? {
    iconWrap: "bg-slate-100",
    iconColor: "text-slate-600",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    accent: "border-l-slate-300",
    unreadBg: "bg-slate-50/30",
  };
