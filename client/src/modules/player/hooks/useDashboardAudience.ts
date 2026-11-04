"use client";

import type { DashboardAudience } from "@/modules/player/config/dashboardSections";
import { useAuthStore } from "@/modules/auth/store/authStore";

/**
 * Which dashboard the signed-in user gets.
 *
 * The single place `role === "Parent"` is read on this page. Everything else
 * consumes the resolved audience, so adding a third audience later means adding
 * an entry to `DASHBOARD_SECTIONS` rather than hunting down role checks spread
 * through the widgets.
 *
 * Audience is derived from role, not from dependent count: a parent who has not
 * added a child yet is still a parent, and should see the roster's onboarding
 * state rather than be silently reclassified as a player.
 */
export const useDashboardAudience = (): { audience: DashboardAudience; isParent: boolean } => {
  const role = useAuthStore((state) => state.user?.role);
  const isParent = role === "Parent";

  return { audience: isParent ? "parent" : "player", isParent };
};
