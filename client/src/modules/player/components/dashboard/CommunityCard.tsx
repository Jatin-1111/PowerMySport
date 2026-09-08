"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { getCommunityAppUrl } from "@/lib/community/url";
import { Button } from "@/modules/shared/ui/Button";
import { ArrowUpRight, MessagesSquare } from "lucide-react";

/**
 * A way through to the community, and nothing more.
 *
 * Deliberately shows no counters yet. The obvious source for them,
 * `GET /api/community/reputation`, is not a read: it calls `ensureProfile` and
 * then upserts the reputation row, so putting it on the dashboard would mean two
 * database writes every time anyone loads this page — and would create a
 * community profile for users who never opted into the community. Numbers go in
 * here once that endpoint has a genuinely read-only path.
 *
 * The community is a separate app, so the destination always goes through
 * `getCommunityAppUrl()` rather than a local route.
 */
export function CommunityCard() {
  return (
    <DashboardSection
      icon={MessagesSquare}
      title="Community"
      description="Ask questions, read what other parents have shared, and follow the discussions."
      action={
        <a href={getCommunityAppUrl()} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" icon={<ArrowUpRight size={14} />}>
            Open Community
          </Button>
        </a>
      }
    >
      <p className="text-sm text-slate-500">
        Parents swap advice on coaches, kit, training loads and tournaments. Bring a question, or
        answer one you know the answer to.
      </p>
    </DashboardSection>
  );
}
