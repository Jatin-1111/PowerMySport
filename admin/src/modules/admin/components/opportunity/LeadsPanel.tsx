"use client";

// ─── Leads from the monthly web search ──────────────────────────────────────
//
// Things an AI search found that we do not cover yet. A lead is a pointer,
// not a fact: "Read it" sends its page through the same source review as any
// document, where every field is checked against a quote. Dismissed leads
// never come back, however often the search finds them again.

import { toast } from "@/lib/toast";
import {
  opportunityLeadApi,
  type OpportunityLeadRow,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { readApiErrors } from "./apiErrors";
import { SourceSubmitForm } from "./SourceSubmitForm";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function LeadRow({ lead, onDismiss }: { lead: OpportunityLeadRow; onDismiss: () => void }) {
  const [reading, setReading] = useState(false);
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
          <p className="text-xs text-slate-500">
            {lead.track === "admission" ? "Admission" : "Scholarship"}
            {lead.owner ? ` · ${lead.owner}` : ""} · found {day(lead.firstFoundAt)}
            {lead.timesFound > 1 ? `, seen ${lead.timesFound} times` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setReading((v) => !v)}
            className="rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white"
          >
            {reading ? "Close" : "Read it"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700"
          >
            Dismiss
          </button>
        </div>
      </div>
      {lead.why && <p className="text-sm text-slate-700">{lead.why}</p>}
      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-orange-700 hover:underline"
      >
        <span className="truncate">{lead.url}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      {lead.isAggregator && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {lead.domain} lists schemes but is not their source. Find the official page and read that
          instead.
        </p>
      )}
      {reading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <SourceSubmitForm
            defaultTrack={lead.track}
            defaultUrl={lead.isAggregator ? "" : lead.url}
            defaultLabel={lead.name}
            leadId={lead._id}
            onCancel={() => setReading(false)}
          />
        </div>
      )}
    </li>
  );
}

export function LeadsPanel() {
  const [leads, setLeads] = useState<OpportunityLeadRow[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const res = await opportunityLeadApi.list("new");
    setLeads(res.data?.leads ?? []);
    setRunning(res.data?.running ?? false);
  };

  useEffect(() => {
    let cancelled = false;
    opportunityLeadApi
      .list("new")
      .then((res) => {
        if (cancelled) return;
        setLeads(res.data?.leads ?? []);
        setRunning(res.data?.running ?? false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const runNow = async () => {
    try {
      const res = await opportunityLeadApi.run();
      toast.success(res.message ?? "Searching now.");
      setRunning(true);
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not start the search.");
    }
  };

  const dismiss = async (lead: OpportunityLeadRow) => {
    const reason = window.prompt(`Dismiss "${lead.name}"? Optionally, why:`, "");
    if (reason === null) return;
    try {
      await opportunityLeadApi.dismiss(lead._id, reason.trim() || undefined);
      await load();
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not dismiss that.");
    }
  };

  return (
    <Card variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            New leads from web search <span className="text-slate-400">({leads.length})</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Found by AI search on the 1st of each month. Leads only: nothing here is published until
            it is read and reviewed like any other source.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {running ? "Searching…" : "Search now"}
        </button>
      </div>
      {leads.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {leads.map((lead) => (
            <LeadRow key={lead._id} lead={lead} onDismiss={() => void dismiss(lead)} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No new leads.</p>
      )}
    </Card>
  );
}
