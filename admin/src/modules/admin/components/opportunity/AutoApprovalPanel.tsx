"use client";

import {
  opportunitySourceApi,
  type AutoApprovalStatus,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

const GROUP_TITLE: Record<string, string> = {
  source: "The source",
  evidence: "The evidence",
  record: "The entry",
  change: "A change to a live entry",
};

/**
 * What the AI approver is allowed to do, and whether it is doing it. Shown on the
 * Admissions and scholarships page so nobody has to read code or a config file to
 * know whether items can reach parents without a person, how many have today, and
 * exactly which rules an item must satisfy first.
 */
export function AutoApprovalPanel() {
  const [status, setStatus] = useState<AutoApprovalStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    opportunitySourceApi
      .autoApprovalStatus()
      .then((res) => {
        if (!cancelled) setStatus(res.data ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const groups = ["source", "evidence", "record", "change"].map((group) => ({
    group,
    rules: status.rules.filter((rule) => rule.group === group),
  }));
  const t = status.thresholds;

  return (
    <Card variant="elevated">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Bot aria-hidden className="h-4 w-4 text-slate-500" />
          <span className="font-bold text-slate-900">AI approver</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
              status.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {status.enabled ? "On" : "Off"}
          </span>
          <span className="text-slate-600">
            {status.enabled
              ? `${status.actedToday} of ${status.dailyCap} approvals used today`
              : "Items that pass every rule wait for an editor, as before"}
          </span>
        </summary>

        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p>
            {status.enabled
              ? "Items that satisfy every rule below are approved, and new entries published, without anyone looking. Anything that fails a rule stays in the queue. Every approval is listed in the Monday email and can be reverted from its review page."
              : "Switched off. Every reading is still judged against the rules and the verdict is shown on its review page, so you can see what it would have approved before it is switched on."}
          </p>
          {groups.map(({ group, rules }) => (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {GROUP_TITLE[group]}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {rules.map((rule) => (
                  <li key={rule.id}>{rule.label}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-slate-600">
            Limits for a live entry: at most {t.maxRowsPerUpdate} fields at once; an amount or fee
            may not move more than {t.maxAmountFactor} times; an age bound no more than{" "}
            {t.maxAgeShiftYears} years; a window date no more than {t.maxDateShiftDays} days.
          </p>
        </div>
      </details>
    </Card>
  );
}
