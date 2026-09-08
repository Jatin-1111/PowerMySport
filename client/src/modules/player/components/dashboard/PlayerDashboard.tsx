"use client";

import {
  DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from "@/modules/player/config/dashboardSections";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import { ActionCenter } from "@/modules/player/components/dashboard/ActionCenter";
import { CommunityCard } from "@/modules/player/components/dashboard/CommunityCard";
import { DashboardHeader } from "@/modules/player/components/dashboard/DashboardHeader";
import { FamilyRoster } from "@/modules/player/components/dashboard/FamilyRoster";
import { FriendsWidget } from "@/modules/player/components/dashboard/FriendsWidget";
import { QuickActions } from "@/modules/player/components/dashboard/QuickActions";
import { SelfProfileCard } from "@/modules/player/components/dashboard/SelfProfileCard";
import { SportJourneyCard } from "@/modules/player/components/dashboard/SportJourneyCard";
import type { ComponentType } from "react";

/**
 * Composes the dashboard from the section list for the current audience.
 *
 * The ordering lives in `dashboardSections.ts` rather than in this JSX, which is
 * what keeps role handling out of the sections themselves. A section an audience
 * shouldn't see is absent from its list, so it never mounts and never fires its
 * queries — which matters more than tidiness here, because several of these
 * endpoints are role-gated and the axios interceptor turns a 401 into a
 * full-page redirect to /login.
 *
 * Every section fetches its own data and renders its own skeleton, so the page
 * no longer waits on its slowest call before showing anything.
 */
const REGISTRY: Record<DashboardSectionId, ComponentType> = {
  actions: ActionCenter,
  family: FamilyRoster,
  self: SelfProfileCard,
  journey: SportJourneyCard,
  friends: FriendsWidget,
  community: CommunityCard,
  quickActions: QuickActions,
};

export function PlayerDashboard() {
  const { audience } = useDashboardAudience();

  return (
    <div className="space-y-6">
      <DashboardHeader />
      {DASHBOARD_SECTIONS[audience].map((id) => {
        const Section = REGISTRY[id];
        return <Section key={id} />;
      })}
    </div>
  );
}
