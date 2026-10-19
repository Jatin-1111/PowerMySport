"use client";

import { BudgetBar } from "@/modules/planner/components/BudgetBar";
import { BudgetEditor } from "@/modules/planner/components/BudgetEditor";
import { HomeCityPrompt } from "@/modules/planner/components/HomeCityPrompt";
import type { CostResponse } from "@/modules/planner/services/planner";
import type { SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";
import { formatClockTime, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { nextUp, type NextUpItem } from "@/modules/planner/utils/nextUp";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";
import { BLOCK, QUICK } from "@/modules/planner/utils/motion";

/**
 * The season at a glance: what to do next, where the plan stands, and what it may
 * cost. Three tiles, each answering one question a parent comes to the page with.
 *
 * Every figure here is counted from the plan or printed by AITA. Nothing is a score,
 * a streak or a number made to look like progress.
 */

const LABEL = "text-sm font-medium";

/**
 * The next-step card changes tone with what it says. A step to take is the page's one dark
 * block; a problem (entries have closed) is amber, because it is a warning and not a goal;
 * and with nothing planned yet it is a plain card, since there is nothing to act on yet.
 */
type Tone = "dark" | "warn" | "light";
const TONE: Record<
  Tone,
  {
    card: string;
    label: string;
    sub: string;
    note: string;
    faint: string;
    link: string;
    rule: string;
    ghost: string;
    solid: string;
  }
> = {
  dark: {
    card: "border-slate-900 bg-slate-900 text-white",
    label: "text-slate-300",
    sub: "text-slate-200",
    note: "text-slate-300",
    faint: "text-slate-400",
    link: "decoration-slate-500 hover:decoration-white",
    rule: "border-slate-700",
    ghost: "border-slate-500 text-white hover:border-white hover:bg-slate-800",
    solid: "bg-white text-slate-900 hover:bg-slate-100",
  },
  warn: {
    card: "border-amber-300 bg-amber-50 text-amber-950",
    label: "text-amber-900",
    sub: "text-amber-950",
    note: "text-amber-900",
    faint: "text-amber-800",
    link: "decoration-amber-700/50 hover:decoration-amber-900",
    rule: "border-amber-300",
    ghost: "border-amber-700/40 text-amber-950 hover:border-amber-800 hover:bg-amber-100",
    solid: "bg-amber-900 text-white hover:bg-amber-950",
  },
  light: {
    card: "border-hairline bg-white text-ink",
    label: "text-ink-muted",
    sub: "text-ink-body",
    note: "text-ink-body",
    faint: "text-ink-muted",
    link: "decoration-ink/30 hover:decoration-ink",
    rule: "border-hairline",
    ghost: "border-ink/25 text-ink hover:border-ink hover:bg-paper-deep",
    solid: "bg-ink text-white hover:bg-ink-hover",
  },
};

function whenText(item: NextUpItem): string {
  if (item.underWay) return "Under way";
  if (item.daysAway === 0) return "Today";
  if (item.daysAway === 1) return "Tomorrow";
  return `In ${item.daysAway} days`;
}

/** The headline for one thing to do or watch, in the words a parent would use. */
function headline(item: NextUpItem): string {
  const day = formatLongDate(item.date);
  const time = item.time ? `, ${formatClockTime(item.time)}` : "";
  if (item.kind === "enter-by") return `Entries close ${day}${time}`;
  if (item.kind === "withdraw-by") return `Last day to withdraw ${day}${time}`;
  if (item.entryClosed) return "Entries have closed for this event";
  return item.underWay ? "Under way now" : `Starts ${day}`;
}

function NextUpTile({
  items,
  childName,
  openCount,
  onOpen,
  onSuggest,
  suggesting,
  onBrowse,
  onMarkEntered,
  onRemove,
  busy,
  tileRef,
}: {
  items: NextUpItem[];
  childName: string;
  /** Events open to the child, for the empty state. */
  openCount: number;
  onOpen: (slug: string) => void;
  /** For an event whose entries have closed: the parent did enter in time. */
  onMarkEntered: (slug: string) => void;
  /** For an event whose entries have closed: they did not, so it comes off the plan. */
  onRemove: (slug: string) => void;
  busy: boolean;
  /** So the page can tell when the card has scrolled out of sight. */
  tileRef: RefObject<HTMLElement | null>;
  /** The empty state's main action: make a suggested season. */
  onSuggest: () => void;
  suggesting: boolean;
  /** The empty state's other action: look through everything open. */
  onBrowse: () => void;
}) {
  const [first, ...rest] = items;
  const t = TONE[!first ? "light" : first.entryClosed ? "warn" : "dark"];
  return (
    <motion.section
      variants={BLOCK}
      ref={tileRef}
      aria-labelledby="next-up"
      data-tour="next"
      className={`order-1 rounded-lg border p-5 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:order-none ${t.card}`}
    >
      <h2 id="next-up" className={`${LABEL} ${t.label}`}>
        {first ? "Do this next" : "Next step"}
      </h2>

      {first ? (
        <div className="mt-2">
          <p className="font-title text-2xl font-semibold leading-snug tracking-[-0.02em]">
            {headline(first)}
          </p>
          <p className={`mt-1 text-base ${t.sub}`}>
            <button
              type="button"
              onClick={() => onOpen(first.slug)}
              className={`font-semibold underline underline-offset-2 ${t.link}`}
            >
              {first.name}
            </button>
            , {whenText(first).toLowerCase()}
          </p>
          {first.entryClosed && (
            <div className="mt-3">
              <p className={`text-sm ${t.note}`}>Did you enter in time?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onMarkEntered(first.slug)}
                  className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold disabled:opacity-70 ${t.solid}`}
                >
                  Yes, mark it entered
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(first.slug)}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-70 ${t.ghost}`}
                >
                  No, take it off the plan
                </button>
              </div>
            </div>
          )}
          {first.kind === "withdraw-by" && (
            <p className={`mt-1 text-sm ${t.note}`}>
              After that, withdrawing counts as a late withdrawal.
            </p>
          )}
          {first.pageUrl && (
            <a
              href={first.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${first.name} on AITA`}
              className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold ${t.ghost}`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {first.kind === "enter-by" ? "Enter on AITA" : "Open on AITA"}
            </a>
          )}

          {rest.length > 0 && (
            <ul className={`mt-4 space-y-1.5 border-t pt-3 text-sm ${t.rule} ${t.sub}`}>
              {rest.map((item) => (
                <li key={`${item.kind}-${item.slug}`} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {headline(item)}
                    <span className={t.faint}> · </span>
                    <button
                      type="button"
                      onClick={() => onOpen(item.slug)}
                      className={`underline underline-offset-2 ${t.link}`}
                    >
                      {item.name}
                    </button>
                  </span>
                  <span className={`shrink-0 ${t.faint}`}>{whenText(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-title text-2xl font-semibold leading-snug tracking-[-0.02em]">
            Pick tournaments for {childName}
          </p>
          <p className={`mt-1 text-base leading-relaxed ${t.sub}`}>
            {openCount > 0
              ? `${openCount} tournament${openCount === 1 ? " is" : "s are"} open to ${childName}. Ask for a suggested season, or look through them all.`
              : "Nothing is open to enter right now. AITA publishes about ten weeks ahead, so this fills in."}
          </p>
          {openCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={suggesting}
                onClick={onSuggest}
                className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold disabled:opacity-70 ${t.solid}`}
              >
                {suggesting ? "Working on it..." : "Suggest my season"}
              </button>
              <button
                type="button"
                onClick={onBrowse}
                className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${t.ghost}`}
              >
                Browse all {openCount}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

function BudgetTile({
  costs,
  costsLoading,
  costsFailed,
  saveHomeCity,
  budget,
}: {
  costs: CostResponse | null;
  costsLoading: boolean;
  costsFailed: boolean;
  saveHomeCity: { saving: boolean; save: (city: string) => void };
  budget: { value: number | null; saving: boolean; save: (budget: number | null) => void };
}) {
  return (
    <motion.section
      variants={BLOCK}
      aria-labelledby="budget-tile"
      className="border-hairline order-3 rounded-lg border bg-white p-5 lg:order-none"
    >
      <h2 id="budget-tile" className={`${LABEL} text-ink-muted`}>
        What it may cost
      </h2>
      <div className="mt-2">
        {costs ? (
          <BudgetBar season={costs.season} />
        ) : (
          <p className="text-ink-body text-sm leading-relaxed">
            {costsLoading
              ? "Estimating what the season may cost..."
              : costsFailed
                ? "Cost estimates are not available just now. Everything else still works."
                : ""}
          </p>
        )}
      </div>
      <div className="border-hairline mt-3 border-t pt-3">
        <BudgetEditor budget={budget.value} saving={budget.saving} onSave={budget.save} />
      </div>
      {costs && (
        <div className="border-hairline mt-3 border-t pt-3 text-sm">
          <HomeCityPrompt
            bare
            origin={costs.origin}
            saving={saveHomeCity.saving}
            onSave={saveHomeCity.save}
          />
        </div>
      )}
    </motion.section>
  );
}

export function SeasonSummary({
  entries,
  calendar,
  childName,
  openCount,
  costs,
  costsLoading,
  costsFailed,
  saveHomeCity,
  onOpenEvent,
  onSuggest,
  suggesting,
  onBrowse,
  onMarkEntered,
  onRemove,
  planBusy,
  budget,
}: {
  entries: SeasonPlanEntry[];
  calendar: Map<string, PlannerEdition>;
  childName: string;
  openCount: number;
  costs: CostResponse | null;
  costsLoading: boolean;
  costsFailed: boolean;
  saveHomeCity: { saving: boolean; save: (city: string) => void };
  onOpenEvent: (slug: string) => void;
  onSuggest: () => void;
  suggesting: boolean;
  onBrowse: () => void;
  onMarkEntered: (slug: string) => void;
  onRemove: (slug: string) => void;
  planBusy: boolean;
  budget: { value: number | null; saving: boolean; save: (budget: number | null) => void };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const items = nextUp({ entries, calendar, today });

  // On a phone the next step is the first card, then scrolls away behind the plan and the
  // lists. A one-line bar keeps it in reach; it shows only while the card is out of sight.
  const hasNext = items.length > 0;
  const tileRef = useRef<HTMLElement>(null);
  const [tileInView, setTileInView] = useState(true);
  useEffect(() => {
    const tile = tileRef.current;
    if (!tile || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setTileInView(Boolean(entry?.isIntersecting))
    );
    observer.observe(tile);
    return () => observer.disconnect();
  }, [hasNext]);
  const first = items[0];

  // What a season may cost means nothing until there is a season. An empty plan gets
  // one box with one job instead of a box about money beside it.
  const planned = entries.length > 0;

  return (
    <div
      aria-label="What to do next"
      className={`contents lg:grid lg:gap-6 ${planned ? "lg:grid-cols-2" : ""}`}
    >
      <NextUpTile
        items={items}
        childName={childName}
        openCount={openCount}
        onOpen={onOpenEvent}
        onSuggest={onSuggest}
        suggesting={suggesting}
        onBrowse={onBrowse}
        onMarkEntered={onMarkEntered}
        onRemove={onRemove}
        busy={planBusy}
        tileRef={tileRef}
      />
      <AnimatePresence>
        {first && !tileInView && (
          <motion.div
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0 }}
            transition={QUICK}
            role="region"
            aria-label="Next step"
            className="border-hairline fixed inset-x-0 bottom-0 z-40 border-t bg-white py-3 pl-4 pr-24 lg:hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-ink min-w-0 truncate text-sm font-semibold">{headline(first)}</p>
              <button
                type="button"
                onClick={() =>
                  tileRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" })
                }
                className="bg-ink hover:bg-ink-hover inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-white"
              >
                Show
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {planned && (
        <BudgetTile
          costs={costs}
          costsLoading={costsLoading}
          costsFailed={costsFailed}
          saveHomeCity={saveHomeCity}
          budget={budget}
        />
      )}
    </div>
  );
}
