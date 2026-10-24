import type { ApprovalAssessment } from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

/**
 * What the approval rules make of a reading (server opportunityApprovalPolicy.ts).
 * Always shows which rule held an item and why, so an editor is never left guessing
 * why something was not approved on its own, and can see on a passing item exactly
 * what the AI would have been relying on.
 */
export function ApprovalVerdictCard({ verdict }: { verdict: ApprovalAssessment }) {
  const failed = verdict.rules.filter((rule) => !rule.ok);
  const what = verdict.unchanged
    ? "The source confirms the entry as it is."
    : verdict.kind === "update"
      ? `Changes ${verdict.rows} ${verdict.rows === 1 ? "field" : "fields"} on a live entry.`
      : "A new entry.";

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-start gap-2">
        {verdict.pass ? (
          <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {verdict.pass
              ? "Passes every approval rule"
              : `Held for a person: ${failed.length} ${failed.length === 1 ? "rule is" : "rules are"} not met`}
          </p>
          <p className="text-sm text-slate-600">
            {what}{" "}
            {verdict.pass
              ? "With automatic approval on, this would be approved without anyone looking at it."
              : "It stays in the queue for an editor."}
          </p>
        </div>
      </div>

      {!verdict.pass && (
        <ul className="space-y-1.5 text-sm text-slate-800">
          {failed.map((rule) => (
            <li key={rule.id} className="flex items-start gap-1.5">
              <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>
                {rule.label}
                {rule.detail && <span className="block text-slate-600">{rule.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">All the rules</summary>
        <ul className="mt-2 space-y-1.5">
          {verdict.rules.map((rule) => (
            <li key={rule.id} className="flex items-start gap-1.5">
              {rule.ok ? (
                <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
