import {
  Bell,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  CreditCard,
  MessageCircle,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { createElement, type ComponentType } from "react";

// How each notification category is drawn on the notifications page: an icon and
// a sentence-case label. Categories are told apart by that icon and label, not by
// colour, so the list stays one ink-on-paper surface. A category with no entry
// falls back to a plain Bell, so a new server-side category renders as something
// rather than breaking, but it should still get its own entry here (PLAN was added
// after check-in nudges were found wearing the "Booking" badge).

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  SOCIAL: Users,
  BOOKING: Calendar,
  PAYMENT: CreditCard,
  REVIEW: Star,
  ADMIN: Settings,
  COMMUNITY: MessageCircle,
  PLAN: ClipboardCheck,
  OPPORTUNITY: GraduationCap,
};

export const renderNotificationIcon = (category: string, className: string) =>
  createElement(iconMap[category] ?? Bell, { className, "aria-hidden": true } as {
    className: string;
  });

const categoryLabels: Record<string, string> = {
  SOCIAL: "Friends",
  BOOKING: "Booking",
  PAYMENT: "Payment",
  REVIEW: "Review",
  ADMIN: "Admin",
  COMMUNITY: "Community",
  PLAN: "Check-in",
  OPPORTUNITY: "Opportunity",
};

export const getCategoryLabel = (category: string) =>
  categoryLabels[category] ?? category.charAt(0) + category.slice(1).toLowerCase();
