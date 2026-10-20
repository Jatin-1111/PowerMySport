import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";
import {
  EXAMPLE_CHILD,
  MY_CHILD_CONTROL_LINE,
  MY_CHILD_FACTS,
  MY_CHILD_ROWS,
  MY_CHILD_TIMELINE,
} from "../../data/myChildExample";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * Variants of the homepage "My Child" section, from the 20 Oct review: a visual
 * showing how PMS builds an ongoing understanding of a child's sporting journey.
 * The example child is invented and labelled. Layout ideas borrowed from the
 * product-surface mockups in Linear and Stripe (hairlines instead of shadows,
 * rows over cards, tabular figures); colour and type stay the site's own.
 */

// Describes only what is kept today. It does not promise that every question
// starts from this picture: the assistant does not read it yet.
const LEAD =
  "Their profile, goals, progress, decisions and what is still open, kept together in one place.";

/** A square "Example" label. Not a pill, and not styled as a status. */
export function ExampleLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-ink/25 text-ink-muted inline-block rounded-sm border px-1.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      Example
    </span>
  );
}

function SectionCopy({ children }: { children?: React.ReactNode }) {
  return (
    <div className="reveal-on-scroll">
      <SectionKicker label="My Child" />
      <h2 className={`${SECTION_HEADING} mb-6`}>A picture of your child that builds over time</h2>
      <p className={SECTION_LEAD}>{LEAD}</p>
      {children}
    </div>
  );
}

function ControlAndLink() {
  return (
    <div className="mt-8 flex flex-col items-start gap-4">
      <p className="text-ink-muted max-w-[44ch] text-sm leading-relaxed">{MY_CHILD_CONTROL_LINE}</p>
      <Link
        href="/assessment/discover"
        className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-paper group inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        Start with your child
        <ArrowRight
          aria-hidden
          strokeWidth={1.5}
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Link>
    </div>
  );
}

/** Initial in a small square: a person, without a stock photo of a child. */
function Initial() {
  return (
    <span
      aria-hidden
      className="bg-paper-deep text-ink font-editorial flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl font-light"
    >
      {EXAMPLE_CHILD.initial}
    </span>
  );
}

/**
 * A: one example child as a card. Five labelled rows, ruled by hairlines. The
 * card is the picture; the copy beside it stays short.
 */
export function MyChildCard() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-20">
          <SectionCopy>
            <ControlAndLink />
          </SectionCopy>

          <div className="reveal-on-scroll border-hairline w-full rounded-2xl border bg-white">
            <div className="border-hairline flex items-center gap-3 border-b px-5 py-4 sm:px-6">
              <Initial />
              <div className="min-w-0 flex-1">
                <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
              </div>
              <ExampleLabel />
            </div>
            <dl>
              {MY_CHILD_ROWS.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "border-hairline grid gap-1 border-b px-5 py-4 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:px-6",
                    row.key === "open" && "border-l-power-orange-solid border-l-2"
                  )}
                >
                  <dt className="text-ink-muted text-sm font-medium">{row.label}</dt>
                  <dd className="text-ink text-pretty tabular-nums leading-snug">{row.summary}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * B: the same child as a timeline. A hairline rail with small square markers, one
 * entry per event, and the open action at the bottom marked with the one accent.
 * Shows that the picture is built over weeks, not filled in once.
 */
export function MyChildTimeline() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionCopy>
              <ControlAndLink />
            </SectionCopy>
          </div>

          <div className="reveal-on-scroll">
            <div className="mb-6 flex items-center gap-3">
              <Initial />
              <div className="flex-1">
                <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}&apos;s journey</p>
                <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
              </div>
              <ExampleLabel />
            </div>

            <ol className="border-hairline relative ml-[5px] border-l">
              {MY_CHILD_TIMELINE.map((entry) => (
                <li key={`${entry.when}-${entry.what}`} className="relative pb-7 pl-7 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px]",
                      entry.open ? "bg-power-orange-solid" : "bg-ink/35"
                    )}
                  />
                  <p className="text-ink-muted text-sm font-medium tabular-nums">{entry.when}</p>
                  <p className={cn("text-ink mt-0.5 leading-snug", entry.open && "font-semibold")}>
                    {entry.what}
                  </p>
                  {entry.note && <p className="text-ink-body mt-0.5 text-sm">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * D: where each fact came from. A ruled two-column list, fact on the left and the
 * part of PMS that supplied it on the right. It shows the "builds as you go" idea
 * with sources that exist today, and needs no invented numbers.
 */
export function MyChildSources() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="My Child" />
          <h2 className={`${SECTION_HEADING} mb-6`}>Built from what you already do</h2>
          <p className={SECTION_LEAD}>
            The assessment, the season planner, the ranking link and the check-ins each add to the
            same picture of your child.
          </p>
        </div>

        <div className="reveal-on-scroll mt-12 lg:mt-16">
          <div className="border-ink/20 flex items-center justify-between border-b pb-3">
            <p className="text-ink font-semibold">
              {EXAMPLE_CHILD.name}, {EXAMPLE_CHILD.summary}
            </p>
            <ExampleLabel />
          </div>
          <dl>
            <div className="text-ink-muted hidden gap-6 py-3 text-sm font-medium sm:grid sm:grid-cols-[1fr_16rem]">
              <dt>What we know</dt>
              <dd>Where it came from</dd>
            </div>
            {MY_CHILD_FACTS.map((item) => (
              <div
                key={item.fact}
                className="border-hairline grid gap-1 border-t py-4 sm:grid-cols-[1fr_16rem] sm:gap-6"
              >
                <dt className="text-ink text-pretty text-lg leading-snug">{item.fact}</dt>
                <dd className="text-ink-body text-sm sm:pt-1 sm:text-base">{item.from}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 max-w-2xl">
            <ControlAndLink />
          </div>
        </div>
      </div>
    </section>
  );
}
