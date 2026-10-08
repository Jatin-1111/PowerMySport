"use client";

import { formatClockTime, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { formatInr } from "@/modules/planner/utils/money";
import { deadlineState } from "@/modules/planner/utils/timeline";
import {
  AITA_WITHDRAWAL_RULES,
  RULES_SOURCE,
  type PlannerEdition,
} from "@powermysport/shared-types";
import { AlertTriangle } from "lucide-react";

/**
 * What AITA's own pages say about an event: when entries open, the last day to
 * withdraw, when the draw is fixed, the fee, and what a late withdrawal or a no-show
 * costs.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 * Every line is something AITA printed, and a line AITA did not print is left out
 * and not filled in. Where the figures are AITA's published rules applied to the
 * event's level because its own page could not be read, it says so, so a parent is
 * not told a rule is the event's own word. The entry itself is made on AITA's site,
 * which is why the page link sits beside this.
 */

type Official = NonNullable<PlannerEdition["official"]>;

/** Whether the fine AITA's rules print for this level can be stated, and what it is. */
function noShowFine(edition: PlannerEdition): number | null {
  if (edition.ladder === "Talent Series")
    return AITA_WITHDRAWAL_RULES.noShowFine.talentAndChampionship7Day;
  if (edition.ladder === "Championship Series") {
    if (edition.grade === 7) return AITA_WITHDRAWAL_RULES.noShowFine.talentAndChampionship7Day;
    if (edition.grade === 3) return AITA_WITHDRAWAL_RULES.noShowFine.championship3Day;
  }
  // Super Series, National Series and Nationals: the rules print no fine, so none is stated.
  return null;
}

function feeText(official: Official): string | null {
  if (typeof official.feeSingles !== "number") return null;
  const singles = `${formatInr(official.feeSingles)} singles`;
  return typeof official.feeDoubles === "number"
    ? `${singles}, ${formatInr(official.feeDoubles)} doubles per pair`
    : singles;
}

function withDay(date: string, time: string | undefined): string {
  return time ? `${formatLongDate(date)}, ${formatClockTime(time)}` : formatLongDate(date);
}

export function OfficialDetails({
  edition,
  entered,
}: {
  edition: PlannerEdition;
  /** The parent has entered this event, so the withdrawal deadline is theirs to act on. */
  entered: boolean;
}) {
  const official = edition.official;
  if (!official) return null;

  const fee = feeText(official);
  const rows: Array<[string, string]> = [];
  if (official.entryOpens) rows.push(["Entries open", formatLongDate(official.entryOpens)]);
  if (official.withdrawalDeadline) {
    rows.push(["Withdraw by", withDay(official.withdrawalDeadline, official.times?.withdrawal)]);
  }
  if (official.freezeDeadline) {
    rows.push(["Draw is fixed", withDay(official.freezeDeadline, official.times?.freeze)]);
  }
  if (official.mainDrawStart)
    rows.push(["Main draw starts", formatLongDate(official.mainDrawStart)]);
  if (fee) rows.push(["Entry fee", fee]);
  if (typeof official.dailyAllowance === "number") {
    rows.push(["Daily allowance", `${formatInr(official.dailyAllowance)} (main round)`]);
  }
  if (official.surface) rows.push(["Surface", official.surface]);

  const withdrawal = official.withdrawalDeadline
    ? deadlineState(official.withdrawalDeadline)
    : null;
  const fine = noShowFine(edition);

  return (
    <div className="space-y-3">
      {entered && withdrawal && withdrawal.kind !== "unpublished" && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {withdrawal.kind === "passed"
            ? "The withdrawal deadline has passed. Withdrawing now counts as a late withdrawal."
            : `To withdraw without it counting as a late withdrawal, do it by ${formatLongDate(
                withdrawal.date
              )}.`}
        </p>
      )}

      {rows.length > 0 && (
        <dl className="space-y-1 text-slate-700">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        {official.source === "factSheet"
          ? `Read from AITA's page for this event${
              official.checkedAt ? ` on ${formatLongDate(official.checkedAt)}` : ""
            }. Dates and fees can change, so check it before you enter.`
          : "From AITA's 2026 rules for this level and these dates. This event's own page could not be read, so check it before you enter."}
      </p>

      <details className="text-xs leading-relaxed text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-600 hover:underline">
          If you withdraw late or do not turn up
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Withdrawing after the withdrawal deadline withdraws the player from every event at the
            tournament.
          </li>
          <li>
            Late withdrawals are limited to {AITA_WITHDRAWAL_RULES.lateWithdrawalsPerYear} a
            calendar year, whatever the reason.
          </li>
          {fine !== null && (
            <li>
              A player who has signed in and does not turn up for a match is fined {formatInr(fine)}
              .
            </li>
          )}
          {!AITA_WITHDRAWAL_RULES.noShowFeeRefunded && (
            <li>The entry fee is not refunded to a player who does not turn up.</li>
          )}
        </ul>
        <p className="mt-2 text-slate-500">
          From{" "}
          <a
            href={RULES_SOURCE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-700"
          >
            {RULES_SOURCE.label}
          </a>
          . Check them for the full wording.
        </p>
      </details>
    </div>
  );
}
