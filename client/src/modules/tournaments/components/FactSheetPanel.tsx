import { ExternalLink, FileText, Info } from "lucide-react";

import { DOCUMENT_META } from "@/modules/pathway/services/tournamentEditionPage";
import type { EditionDocument } from "@/modules/pathway/services/pathway";

/**
 * The fact-sheet panel: the document itself when one was captured, and otherwise
 * a plain "not published yet" note, but only while the event is still ahead and
 * only when the event's own page was not already read for its details.
 */
export function FactSheetPanel({
  factSheet,
  detailUrl,
  finished,
  sheetRead,
  federationAcronym,
}: {
  factSheet: EditionDocument | undefined;
  detailUrl: string | undefined;
  finished: boolean;
  /** The record was read from the event's own page, so a fact sheet exists. */
  sheetRead: boolean;
  federationAcronym: string | undefined;
}) {
  return (
    <>
      {factSheet ? (
        <section className="rounded-lg border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="font-editorial text-ink text-xl font-normal">
            {finished ? "Entry details (archived)" : "Entry details"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {finished
              ? "The fact sheet as it was published for this event. Entries have closed."
              : DOCUMENT_META.factSheet.hint}
          </p>
          <a
            href={factSheet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-power-orange-solid mt-4 inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            <FileText className="h-4 w-4" />
            Open the fact sheet
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
          {detailUrl && (
            // Federation document links are often time-limited signed URLs, so
            // the tournament's own page is the link that still works later.
            <p className="mt-3 text-xs text-slate-500">
              Link not working?{" "}
              <a
                href={detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-power-orange-solid font-semibold text-slate-500 underline"
              >
                Open this tournament on the federation site
              </a>{" "}
              for the current copy.
            </p>
          )}
        </section>
      ) : finished || sheetRead ? null : (
        // Only meaningful while the event is still ahead — "entry details go
        // up a few weeks before it starts" is nonsense on an event that ran
        // last month, and the finished panel above already explains the page.
        <section className="rounded-lg border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <h2 className="font-editorial text-ink text-lg font-normal">
                No fact sheet published yet
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {federationAcronym ?? "The federation"} hasn&apos;t posted entry details for this
                event yet. They usually go up a few weeks before it starts.
              </p>
              {detailUrl && (
                <a
                  href={detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-power-orange-solid mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
                >
                  Check the federation&apos;s page
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
