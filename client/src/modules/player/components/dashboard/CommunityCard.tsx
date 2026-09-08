"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { getCommunityAppUrl } from "@/lib/community/url";
import { useCommunityReputation } from "@/modules/community/hooks/useCommunityReputation";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { ArrowUpRight, MessagesSquare } from "lucide-react";

/**
 * The user's standing in the community, and a way through to it.
 *
 * Counters are Parent-only, because the Q&A surface they measure is
 * (`COMMUNITY_ALLOWED_ROLES`). A Player still gets the card and the link — the
 * blog is open to them — just without numbers that could never be anything but
 * zero for their account.
 *
 * A failed counter fetch is deliberately not an error state: the link is the
 * part that matters, and hiding it behind a retry because a statistic didn't
 * load would be a worse page than one that quietly shows fewer numbers.
 */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 px-4 py-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export function CommunityCard() {
  const { isParent } = useDashboardAudience();
  const { data, isLoading } = useCommunityReputation();

  const hasContributed = Boolean(data && data.totalPoints > 0);

  return (
    <DashboardSection
      icon={MessagesSquare}
      title="Community"
      description={
        hasContributed
          ? "Your contributions so far."
          : "Ask questions, read what other parents have shared, and follow the discussions."
      }
      action={
        <a href={getCommunityAppUrl()} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" icon={<ArrowUpRight size={14} />}>
            Open Community
          </Button>
        </a>
      }
    >
      {isParent && isLoading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat value={data.totalPoints} label="Points" />
          <Stat value={data.questionCount} label="Questions" />
          <Stat value={data.answerCount} label="Answers" />
          <Stat value={data.receivedUpvotes} label="Upvotes" />
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Parents swap advice on coaches, kit, training loads and tournaments. Bring a question, or
          answer one you know the answer to.
        </p>
      )}
    </DashboardSection>
  );
}
