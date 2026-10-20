import { cn } from "@/utils/cn";
import React from "react";
import {
  EXAMPLE_CHILD,
  MY_CHILD_ROWS,
  MY_CHILD_TIMELINE,
  type MyChildRow,
} from "../../data/myChildExample";
import { ControlAndLink, ExampleLabel, Initial } from "./MyChildSections";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * Second round of "My Child" options, each one a mix of notes in awesome-design-md:
 *
 *  E  Claude's dark panel with a raised list inside it, on a warm band, with Linear's
 *     hairlines between entries.
 *  F  Pinterest's masonry of tiles with Figma's slightly off-axis notes, so the
 *     picture reads as a board a parent has pinned things to.
 *  G  Stripe's multi-panel composite and Notion's mock-up that breaks out of its
 *     band: three small panels from the product, overlapping the band edge.
 *
 * The child is invented and labelled. Copy stays to what is kept today.
 */

const LEAD =
  "Their profile, goals, progress, decisions and what is still open, kept together in one place.";

function rowOf(key: MyChildRow["key"]): MyChildRow {
  const row = MY_CHILD_ROWS.find((item) => item.key === key);
  if (!row) throw new Error(`Unknown My Child row: ${key}`);
  return row;
}

/** E: a dark panel, a raised list of entries inside it, one orange mark. */
export function MyChildMemory() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-20">
          <div className="reveal-on-scroll">
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>What PMS remembers about your child</h2>
            <p className={SECTION_LEAD}>{LEAD}</p>
            <ControlAndLink />
          </div>

          <div className="reveal-on-scroll bg-ink rounded-2xl p-3 sm:p-4">
            <div className="flex items-center gap-3 px-3 pb-4 pt-3 sm:px-4">
              <span
                aria-hidden
                className="font-editorial flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-2xl font-light text-white"
              >
                {EXAMPLE_CHILD.initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-editorial text-2xl font-light leading-tight text-white">
                  {EXAMPLE_CHILD.name}
                </p>
                <p className="text-sm text-white/60">{EXAMPLE_CHILD.summary}</p>
              </div>
              <span className="inline-block rounded-sm border border-white/30 px-1.5 py-0.5 text-xs font-medium text-white/70">
                Example
              </span>
            </div>

            <dl className="rounded-xl bg-white/[0.06]">
              {MY_CHILD_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 border-t border-white/10 px-4 py-4 first:border-t-0 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:px-5"
                >
                  <dt className="flex items-center gap-2 text-sm font-medium text-white/60">
                    {row.key === "open" && (
                      <span
                        aria-hidden
                        className="bg-power-orange-solid h-2 w-2 shrink-0 rounded-[2px]"
                      />
                    )}
                    {row.label}
                  </dt>
                  <dd className="text-pretty tabular-nums leading-snug text-white">
                    {row.summary}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Off-axis angles for the notes, large screens only: a collage, not a stack. */
const TILT = [
  "lg:-rotate-[0.9deg]",
  "lg:rotate-[0.7deg]",
  "lg:rotate-[1.1deg]",
  "lg:-rotate-[0.6deg]",
];

function Note({
  label,
  tilt,
  accent,
  className,
  children,
}: {
  label: string;
  tilt?: number;
  accent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-hairline mb-5 break-inside-avoid rounded-xl border bg-white p-5",
        accent && "border-t-power-orange-solid border-t-2",
        typeof tilt === "number" && TILT[tilt % TILT.length],
        className
      )}
    >
      <p className="text-ink-muted mb-3 text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

/** F: the picture as a board of notes. Five notes of different heights in columns. */
export function MyChildBoard() {
  const profile = rowOf("profile");
  const decisions = rowOf("decisions");
  const open = rowOf("open");

  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="My Child" />
          <h2 className={`${SECTION_HEADING} mb-6`}>
            Everything about their journey, pinned in one place
          </h2>
          <p className={SECTION_LEAD}>{LEAD}</p>
        </div>

        <div className="reveal-on-scroll mt-12 lg:mt-16">
          <div className="mb-6 flex items-center gap-3">
            <Initial />
            <div className="flex-1">
              <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
              <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
            </div>
            <ExampleLabel />
          </div>

          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            <Note label="Profile" tilt={0}>
              <ul className="text-ink space-y-1.5 leading-snug">
                {profile.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Note>

            <Note label="Goals" tilt={1}>
              <p className="font-editorial text-ink text-balance text-3xl font-light leading-[1.15]">
                Play a first district tournament this season.
              </p>
            </Note>

            <Note label="Open actions" accent tilt={2}>
              <ul className="text-ink space-y-3 leading-snug">
                {open.lines.slice(0, 2).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Note>

            <Note label="Progress" tilt={3}>
              <p className="text-ink leading-snug">Ranking linked.</p>
              <p className="text-ink-body mt-1 text-sm">Two events played so far.</p>
            </Note>

            <Note label="Decisions" tilt={0}>
              <ul className="text-ink space-y-2.5 leading-snug">
                {decisions.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Note>
          </div>

          <div className="mt-4 max-w-xl">
            <ControlAndLink />
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  right,
  className,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-hairline rounded-2xl border bg-white", className)}>
      <div className="border-hairline flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <p className="text-ink text-sm font-semibold">{title}</p>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * G: a centred heading on a deeper band, and under it three small panels from the
 * product that cross the band's lower edge. The middle panel carries the deep,
 * warm-tinted shadow; the side panels sit at different heights.
 */
export function MyChildComposite() {
  const profile = rowOf("profile");
  const open = rowOf("open");

  return (
    <section className="bg-paper">
      <div className="bg-paper-deep px-4 pb-44 pt-16 sm:px-6 sm:pb-56 sm:pt-24 lg:px-8 lg:pb-64 lg:pt-28">
        <div className="reveal-on-scroll mx-auto max-w-3xl text-center">
          <SectionKicker label="My Child" />
          <h2 className={`${SECTION_HEADING} mb-6`}>
            A picture of your child that builds over time
          </h2>
          <p className={`${SECTION_LEAD} mx-auto`}>{LEAD}</p>
        </div>
      </div>

      <div className="relative -mt-32 px-4 pb-16 sm:-mt-44 sm:px-6 sm:pb-24 lg:-mt-52 lg:px-8 lg:pb-28">
        <div className="reveal-on-scroll mx-auto grid max-w-6xl items-start gap-5 lg:grid-cols-[1fr_1.35fr_1fr]">
          <Panel title="Profile" right={<ExampleLabel />} className="lg:mt-16">
            <div className="mb-4 flex items-center gap-3">
              <Initial />
              <div>
                <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
              </div>
            </div>
            <ul className="text-ink space-y-2.5 leading-snug">
              {profile.lines.map((line) => (
                <li
                  key={line}
                  className="border-hairline border-t pt-2.5 first:border-t-0 first:pt-0"
                >
                  {line}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title={`${EXAMPLE_CHILD.name}'s journey`}
            className="shadow-[0_32px_64px_-32px_rgba(57,34,30,0.35)]"
          >
            <ol className="border-hairline relative ml-[5px] border-l">
              {MY_CHILD_TIMELINE.slice(1).map((entry) => (
                <li key={`${entry.when}-${entry.what}`} className="relative pb-5 pl-6 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px]",
                      entry.open ? "bg-power-orange-solid" : "bg-ink/35"
                    )}
                  />
                  <p className="text-ink-muted text-sm font-medium tabular-nums">{entry.when}</p>
                  <p className={cn("text-ink leading-snug", entry.open && "font-semibold")}>
                    {entry.what}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Open actions" className="lg:mt-32">
            <ul className="text-ink space-y-3 leading-snug">
              {open.lines.map((line, index) => (
                <li
                  key={line}
                  className={cn(
                    "border-hairline border-t pt-3 first:border-t-0 first:pt-0",
                    index === 0 && "border-l-power-orange-solid border-l-2 pl-3 font-semibold"
                  )}
                >
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center text-center">
          <ControlAndLink />
        </div>
      </div>
    </section>
  );
}
