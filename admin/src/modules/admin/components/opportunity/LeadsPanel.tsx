"use client";

// ─── Leads from the monthly web search ──────────────────────────────────────
//
// Things an AI search found that we do not cover yet. A lead is a pointer,
// not a fact: "Read it" sends its page through the same source review as any
// document, where every field is checked against a quote. Dismissed leads
// never come back, however often the search finds them again.
//
// "Sort leads" asks triage (server/src/admin/services/opportunityLeadTriage.ts)
// to label each lead with how well it fits and why, flag a likely duplicate, and
// find the official page behind a listing site. Strong fits come first. Triage
// may dismiss only what is clearly not a scheme; those sit in their own list,
// each with its reason and a Restore button.

import { toast } from "@/lib/toast";
import {
  opportunityLeadApi,
  type LeadFit,
  type OpportunityLeadRow,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { AlertTriangle, ChevronDown, Copy, ExternalLink, Loader2 } from "lucide-react";
import axios from "axios";
import { useEffect, useState } from "react";

import { readApiErrors } from "./apiErrors";
import { SourceSubmitForm } from "./SourceSubmitForm";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const FIT_RANK: Record<LeadFit, number> = { high: 0, medium: 1, low: 2, none: 3 };
const FIT_LABEL: Record<LeadFit, { text: string; tone: string }> = {
  high: { text: "Strong fit", tone: "bg-emerald-50 text-emerald-800" },
  medium: { text: "Possible fit", tone: "bg-sky-50 text-sky-800" },
  low: { text: "Weak fit", tone: "bg-slate-100 text-slate-600" },
  none: { text: "Not a fit", tone: "bg-slate-100 text-slate-600" },
};

/** Strong fits first; leads triage has not looked at yet keep their order, after the labelled ones. */
const byFit = (a: OpportunityLeadRow, b: OpportunityLeadRow) =>
  (a.triage?.fit ? FIT_RANK[a.triage.fit] : 2.5) - (b.triage?.fit ? FIT_RANK[b.triage.fit] : 2.5);

function FitChip({ fit }: { fit?: LeadFit | undefined }) {
  if (!fit) return null;
  const { text, tone } = FIT_LABEL[fit];
  return <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-bold ${tone}`}>{text}</span>;
}

function LeadRow({
  lead,
  onDismiss,
  onDraft,
}: {
  lead: OpportunityLeadRow;
  onDismiss: (reason?: string) => void;
  onDraft: () => Promise<void>;
}) {
  const [drafting, setDrafting] = useState(false);
  const [reading, setReading] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {lead.name} <FitChip fit={lead.triage?.fit} />
          </p>
          <p className="text-xs text-slate-500">
            {lead.track === "admission" ? "Admission" : "Scholarship"}
            {lead.owner ? ` · ${lead.owner}` : ""} · found {day(lead.firstFoundAt)}
            {lead.timesFound > 1 ? `, seen ${lead.timesFound} times` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setDrafting(true);
              void onDraft().finally(() => setDrafting(false));
            }}
            aria-busy={drafting}
            title="Reads the page and its documents and writes what it says into a new draft entry"
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white"
          >
            {drafting && <Loader2 className="h-3 w-3 animate-spin" />}
            Draft it
          </button>
          <button
            type="button"
            onClick={() => setReading((v) => !v)}
            className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700"
          >
            {reading ? "Close" : "Read it"}
          </button>
          <button
            type="button"
            onClick={() => setDismissing((v) => !v)}
            className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700"
          >
            Dismiss
          </button>
        </div>
      </div>
      {dismissing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onDismiss(reason.trim() || undefined);
            }}
            placeholder="Why? (optional, e.g. not a sports scheme)"
            aria-label={`Reason for dismissing ${lead.name}`}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => onDismiss(reason.trim() || undefined)}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
          >
            Dismiss lead
          </button>
          <button
            type="button"
            onClick={() => setDismissing(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      )}
      {lead.why && <p className="text-sm text-slate-700">{lead.why}</p>}
      {lead.triage?.reason && (
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Triage:</span> {lead.triage.reason}
        </p>
      )}
      {lead.triage?.possibleDuplicateOf && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Possibly already covered as &ldquo;{lead.triage.possibleDuplicateOf.title}&rdquo;.
        </p>
      )}
      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-orange-700 hover:underline"
      >
        <span className="truncate">{lead.url}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      {lead.isAggregator &&
        (lead.triage?.officialUrl ? (
          <p className="text-xs text-slate-600">
            {lead.domain} only lists it. Official page found:{" "}
            <a
              href={lead.triage.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange-700 hover:underline"
            >
              {new URL(lead.triage.officialUrl).hostname.replace(/^www\./, "")}
            </a>
            . Check it is the right one before reading it.
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {lead.domain} lists schemes but is not their source. Find the official page and read
            that instead.
          </p>
        ))}
      {reading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <SourceSubmitForm
            defaultTrack={lead.track}
            defaultUrl={lead.triage?.officialUrl ?? (lead.isAggregator ? "" : lead.url)}
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
  const [triaging, setTriaging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState<OpportunityLeadRow[]>([]);
  const [showAuto, setShowAuto] = useState(false);

  const fetchLists = () =>
    Promise.all([
      opportunityLeadApi.list("new"),
      opportunityLeadApi.list("dismissed", { autoDismissed: true }),
    ]);

  const apply = ([res, auto]: Awaited<ReturnType<typeof fetchLists>>) => {
    setLeads(res.data?.leads ?? []);
    setRunning(res.data?.running ?? false);
    setTriaging(res.data?.triaging ?? false);
    setAutoDismissed(auto.data?.leads ?? []);
  };

  const load = () => fetchLists().then(apply);

  useEffect(() => {
    let cancelled = false;
    fetchLists()
      .then((lists) => {
        if (!cancelled) apply(lists);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While triage runs on the server, look again every few seconds so the labels
  // appear without anyone refreshing.
  useEffect(() => {
    if (!triaging) return;
    const timer = setInterval(() => void load().catch(() => undefined), 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triaging]);

  const triageNow = async () => {
    try {
      const res = await opportunityLeadApi.triage();
      toast.success(res.message ?? "Sorting the leads.");
      setTriaging(true);
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not start sorting.");
    }
  };

  const restore = async (lead: OpportunityLeadRow) => {
    try {
      await opportunityLeadApi.restore(lead._id);
      await load();
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not restore that.");
    }
  };

  const runNow = async () => {
    try {
      const res = await opportunityLeadApi.run();
      toast.success(res.message ?? "Searching now.");
      setRunning(true);
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not start the search.");
    }
  };

  const draft = async (lead: OpportunityLeadRow, force = false): Promise<void> => {
    try {
      const res = await opportunityLeadApi.draft(lead._id, force);
      toast.success(res.message ?? "Reading it. The draft will appear in the list.");
      await load();
    } catch (error) {
      const message = readApiErrors(error)[0] ?? "Could not start that.";
      // A lead that looks like an entry we have is the editor's call: say so, and
      // go on only if they confirm.
      if (axios.isAxiosError(error) && error.response?.status === 409 && !force) {
        if (/already have/.test(message) && window.confirm(`${message}\n\nDraft it anyway?`)) {
          return draft(lead, true);
        }
        if (!/already have/.test(message)) toast.error(message);
        return;
      }
      toast.error(message);
    }
  };

  const dismiss = async (lead: OpportunityLeadRow, reason?: string) => {
    try {
      await opportunityLeadApi.dismiss(lead._id, reason);
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void triageNow()}
            disabled={triaging}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {triaging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {triaging ? "Sorting…" : "Sort leads"}
          </button>
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
      </div>
      {leads.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {[...leads].sort(byFit).map((lead) => (
            <LeadRow
              key={lead._id}
              lead={lead}
              onDismiss={(reason) => void dismiss(lead, reason)}
              onDraft={() => draft(lead)}
            />
          ))}
        </ul>
      ) : (
        loaded && <p className="mt-3 text-sm text-slate-600">No new leads.</p>
      )}

      {autoDismissed.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowAuto((v) => !v)}
            aria-expanded={showAuto}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Dismissed automatically ({autoDismissed.length})
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAuto ? "rotate-180" : ""}`}
            />
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Each has the reason it was dismissed. Restore one and it stays in your list for good.
          </p>
          {showAuto && (
            <ul className="divide-y divide-slate-100">
              {autoDismissed.map((lead) => (
                <li key={lead._id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{lead.name}</p>
                    <p className="text-xs text-slate-500">{lead.dismissReason}</p>
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-orange-700 hover:underline"
                    >
                      <span className="truncate">{lead.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restore(lead)}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
