// ─── Sidebar ────────────────────────────────────────────────────────────────
//
// Sticky rail carrying the two things a reader needs at any point in a very long
// article: which state they're seeing, and how to jump to a stage without
// scrolling past three others.
//
// `position: sticky` and plain anchors, so it needs no JavaScript. There is
// deliberately no scrollspy — highlighting the current stage would mean shipping
// an IntersectionObserver to solve a problem a reader doesn't have.

import { MapPin } from "lucide-react";

import { StateSwitcher } from "./StateSwitcher";

export interface SidebarStage {
  /** Target anchor id, without the leading hash. */
  anchor: string;
  label: string;
  /** Age band for a stage, or a short qualifier for the framing sections. */
  hint?: string;
  /** Framing sections (decide / careers) get a marker rather than a number. */
  numbered?: boolean;
}

export function ResourceSidebar({
  sportSlug,
  state,
  stages,
  stageCount,
}: {
  sportSlug: string;
  state: string;
  stages: SidebarStage[];
  /** Numbered stages only, for the heading. */
  stageCount: number;
}) {
  return (
    // Pinned, and it stays pinned however long the article gets. The rail can
    // outgrow a short viewport once a sport has many sections, so it caps its own
    // height and scrolls internally rather than letting the page scroll it away.
    <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      <nav aria-label="On this page" className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <MapPin className="h-3 w-3" />
            Showing detail for
          </p>
          <StateSwitcher sportSlug={sportSlug} state={state} compact />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            On this page · {stageCount} stages
          </p>
          <ol className="space-y-1">
            {stages.map((stage) => {
              // Numbering counts only the pathway stages, so "Is this right for
              // your child?" doesn't become stage one of six.
              const number = stage.numbered
                ? stages.filter((s) => s.numbered).indexOf(stage) + 1
                : null;
              return (
                <li key={stage.anchor}>
                  <a
                    href={`#${stage.anchor}`}
                    className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-orange-50"
                  >
                    <span
                      className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition group-hover:bg-power-orange group-hover:text-white ${
                        number
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white text-slate-300 ring-1 ring-inset ring-slate-200"
                      }`}
                    >
                      {number ?? "·"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold leading-snug text-slate-800">
                        {stage.label}
                      </span>
                      {stage.hint && (
                        <span className="block text-[11px] font-medium text-slate-400">
                          {stage.hint}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </aside>
  );
}
