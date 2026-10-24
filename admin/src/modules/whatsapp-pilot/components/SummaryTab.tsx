"use client";

import { useEffect, useState } from "react";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { toast } from "@/lib/toast";
import { EnquirySummary, whatsappPilotApi } from "@/lib/api/whatsappPilotApi";

const ASSISTANCE_LABEL: Record<string, string> = {
  coach: "A coach or academy",
  tournaments: "Tournaments",
  expert: "An expert",
  team: "The PowerMySport team",
  other: "Something else",
};

const FOLLOW_UP_LABEL: Record<string, string> = {
  none: "No follow-up needed",
  new: "Waiting for the team",
  contacted: "Contacted",
  done: "Done",
};

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate capitalize text-slate-700">{row.label}</span>
                <span className="font-medium tabular-nums text-slate-900">{row.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div
                  className="bg-power-orange-solid h-1.5 rounded"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function SummaryTab() {
  const [summary, setSummary] = useState<EnquirySummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappPilotApi
      .enquirySummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        toast.error("Could not load the summary.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed)
    return <ErrorNotice message="We couldn't load the summary. Reload the page to try again." />;
  if (!summary) return <SkeletonBlock rows={6} label="Loading summary" />;

  const rated = summary.feedback.helpful + summary.feedback.notHelpful;

  return (
    <div className="space-y-6">
      <MetricStrip
        items={[
          { label: "Parents", value: String(summary.parents), detail: "Distinct people who asked" },
          {
            label: "Enquiries",
            value: String(summary.enquiries),
            detail: "One per question topic",
          },
          {
            label: "Waiting for the team",
            value: String(summary.needsFollowUp),
            detail: "Asked for a person, not yet contacted",
          },
          {
            label: "Said it helped",
            value: String(summary.feedback.helpful),
            detail: rated ? `${rated} gave feedback` : "No feedback yet",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown
          title="Sports asked about"
          rows={summary.bySport.map((r) => ({ label: r.sport, count: r.count }))}
        />
        <Breakdown
          title="Help asked for"
          rows={Object.entries(summary.byAssistance).map(([kind, count]) => ({
            label: ASSISTANCE_LABEL[kind] ?? kind,
            count,
          }))}
        />
        <Breakdown
          title="Follow-up"
          rows={Object.entries(summary.byFollowUp).map(([status, count]) => ({
            label: FOLLOW_UP_LABEL[status] ?? status,
            count,
          }))}
        />
      </div>
    </div>
  );
}
