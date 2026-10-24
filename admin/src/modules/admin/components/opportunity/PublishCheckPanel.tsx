"use client";

// ─── The pre-publish check, as the editor shows it ──────────────────────────
//
// What the server (opportunityPublishCheck.ts) makes of the saved entry. Advice.
// A "problem" is something that cannot be right and should be fixed; the server
// itself refuses to publish past only one, a verification date in the future,
// because links are opened on request and not at publish. A link our server could
// not open is "unchecked", not broken: many official sites turn automated
// visitors away, so the person has to open those themselves.

import { Card } from "@/modules/shared/ui/Card";
import type {
  PublishCheck,
  PublishCheckLink,
  PublishFinding,
} from "@/modules/admin/services/opportunities";
import { CheckCircle2, CircleHelp, ExternalLink, Loader2, X, XCircle } from "lucide-react";

const SEVERITY: Record<PublishFinding["severity"], { label: string; tone: string }> = {
  problem: { label: "Problem", tone: "bg-red-50 text-red-700" },
  warning: { label: "Look at this", tone: "bg-amber-50 text-amber-800" },
  note: { label: "Note", tone: "bg-slate-100 text-slate-600" },
};

const LINK_STATUS: Record<PublishCheckLink["status"], { text: string; tone: string }> = {
  ok: { text: "Opens", tone: "text-emerald-700" },
  gone: { text: "Gone", tone: "text-red-700" },
  moved: { text: "Now a page, not a file", tone: "text-amber-800" },
  unchecked: { text: "Our server could not check it", tone: "text-slate-500" },
};

function LinkIcon({ status }: { status: PublishCheckLink["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "gone") return <XCircle className="h-4 w-4 shrink-0 text-red-600" />;
  return <CircleHelp className="h-4 w-4 shrink-0 text-slate-500" />;
}

export function PublishCheckPanel({
  result,
  running,
  onRun,
  onClose,
}: {
  result: PublishCheck | null;
  running: boolean;
  onRun: () => void;
  onClose: () => void;
}) {
  const findings = result?.findings ?? [];
  const links = result?.links ?? [];
  const blocking = findings.filter((f) => f.severity === "problem").length;

  return (
    <Card variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Check before publishing</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Reads the entry for things that do not add up, and opens each source and the apply link.
            It checks what is saved, so your edits are saved first. It advises. The only thing that
            stops a publish is a verification date in the future.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {running ? "Checking…" : result ? "Check again" : "Run check"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            {findings.length === 0
              ? "Nothing to flag."
              : blocking > 0
                ? `${blocking} problem${blocking === 1 ? "" : "s"} to fix before publishing.`
                : `${findings.length} thing${findings.length === 1 ? "" : "s"} to look at.`}
          </p>

          {findings.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {findings.map((finding, index) => {
                const { label, tone } = SEVERITY[finding.severity];
                return (
                  <li key={index} className="flex items-start gap-3 px-3 py-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}
                    >
                      {label}
                    </span>
                    <p className="text-sm text-slate-700">{finding.message}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {links.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500">Links ({links.length})</h3>
              <ul className="mt-1 divide-y divide-slate-100">
                {links.map((link) => {
                  const { text, tone } = LINK_STATUS[link.status];
                  return (
                    <li key={link.url} className="flex items-center gap-2 py-2">
                      <LinkIcon status={link.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {link.label}
                        </p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-xs text-orange-700 hover:underline"
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${tone}`}>{text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
