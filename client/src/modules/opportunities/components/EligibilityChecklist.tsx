"use client";

import { CircleCheck, CircleHelp, CircleX, Minus } from "lucide-react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import type { Opportunity } from "../services/opportunities";
import {
  VERDICT_LABELS,
  checkOpportunity,
  hasProfile,
  type CheckState,
  type EligibilityCheck,
  type Verdict,
} from "../utils/match";
import { ProfileFields } from "./ProfileFields";

// ─── "Is my child eligible?" ─────────────────────────────────────────────
//
// Every rule the entry states, one row each, with the child checked against
// the ones that can be checked. A rule written in the scheme's own words
// (marks, income, level) is listed as published and marked "check this
// yourself": a tick there would be a guess, and a parent could act on it.

const STATE_VIEW: Record<
  CheckState,
  { Icon: typeof CircleCheck; tone: string; tag: string; srLabel: string }
> = {
  pass: { Icon: CircleCheck, tone: "text-emerald-700", tag: "Matches", srLabel: "Matches" },
  fail: { Icon: CircleX, tone: "text-red-700", tag: "Does not match", srLabel: "Does not match" },
  manual: {
    Icon: CircleHelp,
    tone: "text-amber-700",
    tag: "Check this yourself",
    srLabel: "Check this yourself",
  },
  unknown: {
    Icon: Minus,
    tone: "text-slate-500",
    tag: "Add this above to check",
    srLabel: "Not checked yet",
  },
};

const VERDICT_BANNER: Record<Verdict, string> = {
  fits: "border-emerald-200 bg-emerald-50 text-emerald-900",
  check: "border-amber-200 bg-amber-50 text-amber-950",
  no: "border-slate-200 bg-slate-100 text-slate-800",
};

const VERDICT_DETAIL: Record<Verdict, string> = {
  fits: "Everything we can check matches.",
  check: "Nothing we checked rules your child out, but some rules need you to confirm them.",
  no: "At least one rule does not match. The details are below.",
};

function Row({ check }: { check: EligibilityCheck }) {
  const view = STATE_VIEW[check.state];
  return (
    <li className="flex gap-3">
      <view.Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${view.tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">
          {check.label}
          <span className="sr-only">: {view.srLabel}</span>
        </p>
        <p className="text-base text-slate-700">{check.detail}</p>
        <p className={`mt-0.5 text-xs font-semibold ${view.tone}`} aria-hidden>
          {view.tag}
        </p>
      </div>
    </li>
  );
}

export function EligibilityChecklist({
  opportunity,
}: {
  opportunity: Pick<Opportunity, "sports" | "allSports" | "geography" | "eligibility">;
}) {
  const { profile } = useOpportunityProfile();
  const { checks, verdict } = checkOpportunity(opportunity, profile);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">
          Check your child against these rules
        </p>
        <ProfileFields sports={opportunity.allSports ? [] : opportunity.sports} />
        <p className="mt-2 text-xs text-slate-600">Kept on this device only.</p>
      </div>

      {verdict && hasProfile(profile) && (
        <p role="status" className={`rounded-lg border p-3 text-sm ${VERDICT_BANNER[verdict]}`}>
          <span className="font-bold">{VERDICT_LABELS[verdict]}.</span> {VERDICT_DETAIL[verdict]}
        </p>
      )}

      <ul className="space-y-4">
        {checks.map((check) => (
          <Row key={check.key} check={check} />
        ))}
      </ul>
    </div>
  );
}
