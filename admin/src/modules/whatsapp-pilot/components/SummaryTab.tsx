"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/modules/shared/ui/Card";
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

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate capitalize text-slate-700">{row.label}</span>
                <span className="font-medium tabular-nums text-slate-900">{row.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div
                  className="h-1.5 rounded bg-slate-700"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
    return <p className="py-12 text-center text-slate-500">The summary could not be loaded.</p>;
  if (!summary) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const rated = summary.feedback.helpful + summary.feedback.notHelpful;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Parents" value={summary.parents} hint="Distinct people who asked" />
        <Stat label="Enquiries" value={summary.enquiries} hint="One per question topic" />
        <Stat
          label="Waiting for the team"
          value={summary.needsFollowUp}
          hint="Asked for a person, not yet contacted"
        />
        <Stat
          label="Said it helped"
          value={summary.feedback.helpful}
          hint={rated ? `${rated} gave feedback` : "No feedback yet"}
        />
      </div>

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
