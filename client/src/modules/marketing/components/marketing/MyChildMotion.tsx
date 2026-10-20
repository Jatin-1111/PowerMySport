"use client";

import { cn } from "@/utils/cn";
import {
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import {
  EXAMPLE_CHILD,
  MY_CHILD_ROWS,
  MY_CHILD_TIMELINE,
  type MyChildKey,
  type TimelineEntry,
} from "../../data/myChildExample";
import { Note, Panel } from "./MyChildCombined";
import { ControlAndLink, ExampleLabel, Initial } from "./MyChildSections";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * "My Child" options that move as the page scrolls, kept to the site's motion rules:
 * transform and opacity only, a few pixels of travel, content in the page and readable
 * before any script runs, and `prefers-reduced-motion` turns the movement off
 * (`MotionConfig reducedMotion="user"` plus an explicit check where a value is driven
 * by scroll). Nothing follows the cursor and nothing waits on an animation.
 *
 *  H  A timeline whose rail fills as it is read (Linear's changelog, Apple's scrolly).
 *  I  Three product panels that drift at slightly different speeds (Stripe, Notion).
 *  J  A card that stays put while the five parts are read, and the one being read lights
 *     up (Apple and Stripe scrollytelling).
 *  K  A board whose notes settle into place one after another (Pinterest, Figma).
 */

const EASE = [0.32, 0.72, 0, 1] as const;
const LEAD =
  "Their profile, goals, progress, decisions and what is still open, kept together in one place.";

/** Dimmed text still has to be readable if the script never runs, so it never goes below this. */
const DIM = 0.62;

/** True from the `lg` breakpoint up. False on the server and on the first client render. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

// ─── H: the rail fills as the timeline is read ──────────────────────────────

function TimelineItem({
  entry,
  index,
  total,
  progress,
  still,
}: {
  entry: TimelineEntry;
  index: number;
  total: number;
  progress: MotionValue<number>;
  still: boolean;
}) {
  const start = index / total;
  const lit = useTransform(progress, [Math.max(0, start - 0.06), start + 0.04], [DIM, 1]);
  return (
    <motion.li
      style={still ? undefined : { opacity: lit }}
      className="relative pb-7 pl-7 last:pb-0"
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px]",
          entry.open ? "bg-power-orange-solid" : "bg-ink"
        )}
      />
      <p className="text-ink-muted text-sm font-medium tabular-nums">{entry.when}</p>
      <p className={cn("text-ink mt-0.5 leading-snug", entry.open && "font-semibold")}>
        {entry.what}
      </p>
      {entry.note && <p className="text-ink-body mt-0.5 text-sm">{entry.note}</p>}
    </motion.li>
  );
}

export function MyChildFillTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionKicker label="My Child" />
              <h2 className={`${SECTION_HEADING} mb-6`}>
                A picture of your child that builds over time
              </h2>
              <p className={SECTION_LEAD}>{LEAD}</p>
              <ControlAndLink />
            </div>

            <div>
              <div className="mb-6 flex items-center gap-3">
                <Initial />
                <div className="flex-1">
                  <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}&apos;s journey</p>
                  <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
                </div>
                <ExampleLabel />
              </div>

              <ol ref={ref} className="border-hairline relative ml-[5px] border-l">
                {/* The fill: grows down the rail as the list is scrolled through. */}
                <motion.span
                  aria-hidden
                  style={{ scaleY: reduced ? 1 : scrollYProgress }}
                  className="bg-ink absolute -left-px top-0 h-full w-px origin-top"
                />
                {MY_CHILD_TIMELINE.map((entry, index) => (
                  <TimelineItem
                    key={`${entry.when}-${entry.what}`}
                    entry={entry}
                    index={index}
                    total={MY_CHILD_TIMELINE.length}
                    progress={scrollYProgress}
                    still={Boolean(reduced)}
                  />
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

// ─── I: three panels that drift at different speeds ─────────────────────────

export function MyChildDriftPanels() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useWide();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const left = useTransform(scrollYProgress, [0, 1], [26, -26]);
  const middle = useTransform(scrollYProgress, [0, 1], [12, -12]);
  const right = useTransform(scrollYProgress, [0, 1], [52, -52]);
  const move = wide && !reduced;

  const profile = MY_CHILD_ROWS.find((row) => row.key === "profile");
  const open = MY_CHILD_ROWS.find((row) => row.key === "open");

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper">
        <div className="bg-paper-deep px-4 pb-44 pt-16 sm:px-6 sm:pb-56 sm:pt-24 lg:px-8 lg:pb-64 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>
              A picture of your child that builds over time
            </h2>
            <p className={`${SECTION_LEAD} mx-auto`}>{LEAD}</p>
          </div>
        </div>

        <div
          ref={ref}
          className="relative -mt-32 px-4 pb-16 sm:-mt-44 sm:px-6 sm:pb-24 lg:-mt-52 lg:px-8 lg:pb-28"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-5 lg:grid-cols-[1fr_1.35fr_1fr]">
            <motion.div style={move ? { y: left } : undefined} className="lg:mt-16">
              <Panel title="Profile" right={<ExampleLabel />}>
                <div className="mb-4 flex items-center gap-3">
                  <Initial />
                  <div>
                    <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                    <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
                  </div>
                </div>
                <ul className="text-ink space-y-2.5 leading-snug">
                  {profile?.lines.map((line) => (
                    <li
                      key={line}
                      className="border-hairline border-t pt-2.5 first:border-t-0 first:pt-0"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.div>

            <motion.div style={move ? { y: middle } : undefined}>
              <Panel
                title={`${EXAMPLE_CHILD.name}'s journey`}
                className="shadow-[0_32px_64px_-32px_rgba(57,34,30,0.35)]"
              >
                <ol className="border-hairline relative ml-[5px] border-l">
                  {MY_CHILD_TIMELINE.slice(1).map((entry) => (
                    <li
                      key={`${entry.when}-${entry.what}`}
                      className="relative pb-5 pl-6 last:pb-0"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px]",
                          entry.open ? "bg-power-orange-solid" : "bg-ink/35"
                        )}
                      />
                      <p className="text-ink-muted text-sm font-medium tabular-nums">
                        {entry.when}
                      </p>
                      <p className={cn("text-ink leading-snug", entry.open && "font-semibold")}>
                        {entry.what}
                      </p>
                    </li>
                  ))}
                </ol>
              </Panel>
            </motion.div>

            <motion.div style={move ? { y: right } : undefined} className="lg:mt-32">
              <Panel title="Open actions">
                <ul className="text-ink space-y-3 leading-snug">
                  {open?.lines.map((line, index) => (
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
            </motion.div>
          </div>

          <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center text-center">
            <ControlAndLink />
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

// ─── J: a card that stays while the five parts are read ─────────────────────

function StoryStep({
  index,
  label,
  lines,
  onActive,
}: {
  index: number;
  label: string;
  lines: string[];
  onActive: (index: number) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // Counts as "being read" while it crosses a band in the middle of the screen.
  const reading = useInView(ref, { margin: "-42% 0px -42% 0px" });
  useEffect(() => {
    if (reading) onActive(index);
  }, [reading, index, onActive]);

  return (
    <li
      ref={ref}
      className="border-hairline border-t py-8 lg:flex lg:min-h-[48vh] lg:flex-col lg:justify-center"
    >
      <p className="text-ink-muted mb-2 text-sm font-medium tabular-nums">
        {index + 1} of {MY_CHILD_ROWS.length}
      </p>
      <h3 className="font-editorial text-ink mb-4 text-4xl font-light">{label}</h3>
      <ul className="text-ink-body max-w-[44ch] space-y-2 text-lg leading-snug">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </li>
  );
}

export function MyChildScrollStory() {
  const [active, setActive] = useState(0);
  const activeKey: MyChildKey | undefined = MY_CHILD_ROWS[active]?.key;

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>
              A picture of your child that builds over time
            </h2>
            <p className={SECTION_LEAD}>{LEAD}</p>
          </div>

          <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[minmax(0,32rem)_1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="border-hairline rounded-2xl border bg-white">
                <div className="border-hairline flex items-center gap-3 border-b px-5 py-4">
                  <Initial />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                    <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
                  </div>
                  <ExampleLabel />
                </div>
                <dl>
                  {MY_CHILD_ROWS.map((row) => {
                    const isActive = row.key === activeKey;
                    return (
                      <div
                        key={row.key}
                        className={cn(
                          "border-hairline grid gap-1 border-b border-l-2 px-5 py-4 transition-[background-color,opacity,border-color] duration-300 last:border-b-0 motion-reduce:transition-none sm:grid-cols-[7rem_1fr] sm:gap-4",
                          isActive
                            ? "bg-paper-deep/60 border-l-power-orange-solid"
                            : "border-l-transparent opacity-[0.62]"
                        )}
                      >
                        <dt className="text-ink-muted text-sm font-medium">{row.label}</dt>
                        <dd className="text-ink text-pretty tabular-nums leading-snug">
                          {row.summary}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
              <ControlAndLink />
            </div>

            <ol>
              {MY_CHILD_ROWS.map((row, index) => (
                <StoryStep
                  key={row.key}
                  index={index}
                  label={row.label}
                  lines={row.lines}
                  onActive={setActive}
                />
              ))}
            </ol>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

// ─── K: notes settle into place one after another ───────────────────────────

export function MyChildBoardRise() {
  const notes: Array<{
    label: string;
    accent?: boolean;
    tilt: number;
    body: React.ReactNode;
  }> = [
    {
      label: "Profile",
      tilt: 0,
      body: (
        <ul className="text-ink space-y-1.5 leading-snug">
          {MY_CHILD_ROWS[0]?.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "Goals",
      tilt: 1,
      body: (
        <p className="font-editorial text-ink text-balance text-3xl font-light leading-[1.15]">
          Play a first district tournament this season.
        </p>
      ),
    },
    {
      label: "Open actions",
      accent: true,
      tilt: 2,
      body: (
        <ul className="text-ink space-y-3 leading-snug">
          {MY_CHILD_ROWS[4]?.lines.slice(0, 2).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "Progress",
      tilt: 3,
      body: (
        <>
          <p className="text-ink leading-snug">Ranking linked.</p>
          <p className="text-ink-body mt-1 text-sm">Two events played so far.</p>
        </>
      ),
    },
    {
      label: "Decisions",
      tilt: 0,
      body: (
        <ul className="text-ink space-y-2.5 leading-snug">
          {MY_CHILD_ROWS[3]?.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>
              Everything about their journey, pinned in one place
            </h2>
            <p className={SECTION_LEAD}>{LEAD}</p>
          </div>

          <div className="mt-12 lg:mt-16">
            <div className="mb-6 flex items-center gap-3">
              <Initial />
              <div className="flex-1">
                <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
              </div>
              <ExampleLabel />
            </div>

            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {notes.map((note, index) => (
                // Starts a little low and settles. Opacity is never touched, so the
                // note is readable wherever it is when the page first paints.
                <motion.div
                  key={note.label}
                  className="break-inside-avoid"
                  initial={{ y: 28 }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: (index % 3) * 0.07 }}
                >
                  <Note label={note.label} accent={note.accent} tilt={note.tilt}>
                    {note.body}
                  </Note>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 max-w-xl">
              <ControlAndLink />
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
