"use client";

import type { DependentSummary } from "@/modules/player/hooks/useDependents";
import { nextStepLabel } from "@/modules/player/config/dependentNextStep";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { Avatar, AvatarFallback } from "@/modules/shared/ui/Avatar";
import { Button } from "@/modules/shared/ui/Button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/**
 * One child, and the single most useful thing to do for them next.
 *
 * The card deliberately shows *one* gap rather than a checklist. `useDependents`
 * sorts the missing fields by weight, so "one thing" is the highest-value one,
 * and `nextStepHref` points it at the exact step of the edit modal that fills it
 * — the parent lands on the field, not on a page about the field.
 */
export function DependentSummaryCard({ summary }: { summary: DependentSummary }) {
  const { id, name, age, sport, completionPercent, topGap } = summary;
  const isComplete = completionPercent >= 100;

  return (
    <div className="bg-paper-deep flex flex-col gap-4 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <ProfileCompletionRing
          percent={completionPercent}
          size={52}
          strokeWidth={3}
          title={`${name}'s profile is ${completionPercent}% complete`}
        >
          <Avatar className="h-11 w-11">
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </ProfileCompletionRing>

        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/dependents/${id}`}
            className="text-ink font-medium underline-offset-4 hover:underline"
          >
            {name}
          </Link>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {[age !== null ? `${age} yrs` : null, sport].filter(Boolean).join(" · ") ||
              "No sport chosen yet"}
          </p>
        </div>

        <span className="text-ink-muted text-sm tabular-nums">{completionPercent}%</span>
      </div>

      {isComplete || !topGap ? (
        <p className="text-ink-body flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />
          Profile complete
        </p>
      ) : (
        <Link href={topGap.href} className="block">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            icon={<ArrowRight size={14} />}
          >
            {nextStepLabel(topGap.field)}
          </Button>
        </Link>
      )}
    </div>
  );
}
