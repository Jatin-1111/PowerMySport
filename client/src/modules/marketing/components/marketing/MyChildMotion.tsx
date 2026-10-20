"use client";

import { cn } from "@/utils/cn";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValueEvent,
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
  type TimelineEntry,
} from "../../data/myChildExample";
import { Panel } from "./MyChildCombined";
import { ControlAndLink, ExampleLabel, Initial } from "./MyChildSections";
import { DIM, EASE, LEAD, useWide } from "./myChildMotionShared";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * "My Child" options that move as the page scrolls, kept to the site's motion rules:
 * transform and opacity only, a few pixels of travel, content in the page and readable
 * before any script runs, and `prefers-reduced-motion` turns the movement off
 * (`MotionConfig reducedMotion="user"` plus an explicit check where a value is driven
 * directly by scroll). Nothing follows the cursor and nothing waits on an animation.
 *
 *  H  A timeline whose rail fills as it is read, with a marker leading the fill, a live
 *     "3 of 7" readout, and a ring on the open action when it is reached.
 *  I  Three product panels that land with a small tilt, then drift at their own speeds,
 *     with the shadow arriving once the middle panel has settled.
 *
 * (J and K are in MyChildStory.tsx.)
 */

// ─── H: the rail fills as the timeline is read ──────────────────────────────

function TimelineItem({
  entry,
  index,
  total,
  progress,
  still,
  reached,
}: {
  entry: TimelineEntry;
  index: number;
  total: number;
  progress: MotionValue<number>;
  still: boolean;
  /** True once the reader has got to the end of the list. */
  reached: boolean;
}) {
  const start = index / total;
  const from = Math.max(0, start - 0.06);
  const to = start + 0.04;
  const lit = useTransform(progress, [from, to], [DIM, 1]);
  const slide = useTransform(progress, [from, to], [10, 0]);
  const grow = useTransform(progress, [from, to], [0.55, 1]);

  return (
    <motion.li
      style={still ? undefined : { opacity: lit }}
      className="relative pb-7 pl-7 last:pb-0"
    >
      <motion.span
        aria-hidden
        style={still ? undefined : { scale: grow }}
        className={cn(
          "absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px]",
          entry.open ? "bg-power-orange-solid" : "bg-ink"
        )}
      />
      {entry.open && reached && !still && (
        // One ring, once, when the reader arrives at the open action.
        <motion.span
          aria-hidden
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE }}
          className="border-power-orange-solid absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-[2px] border"
        />
      )}
      <motion.div style={still ? undefined : { x: slide }}>
        <p className="text-ink-muted text-sm font-medium tabular-nums">{entry.when}</p>
        <p className={cn("text-ink mt-0.5 leading-snug", entry.open && "font-semibold")}>
          {entry.what}
        </p>
        {entry.note && <p className="text-ink-body mt-0.5 text-sm">{entry.note}</p>}
      </motion.div>
    </motion.li>
  );
}

export function MyChildFillTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = Boolean(useReducedMotion());
  const total = MY_CHILD_TIMELINE.length;
  const [railEnd, setRailEnd] = useState(0);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });

  // The fill and its leading marker stop at the last marker, not at the foot of the list.
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const measure = () => {
      const last = list.lastElementChild as HTMLElement | null;
      if (last) setRailEnd(last.offsetTop + 11);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(Math.min(total - 1, Math.max(0, Math.floor(value * total))));
  });

  const headY = useTransform(scrollYProgress, [0, 1], [0, railEnd]);
  const headOpacity = useTransform(scrollYProgress, [0, 0.03, 0.97, 1], [0, 1, 1, 0]);
  const fillScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

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
                <p className="text-ink-muted text-sm tabular-nums" aria-hidden>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={active}
                      initial={{ y: 6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -6, opacity: 0 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="inline-block"
                    >
                      {active + 1} of {total}
                    </motion.span>
                  </AnimatePresence>
                </p>
                <ExampleLabel />
              </div>

              <ol ref={ref} className="border-hairline relative ml-[5px] border-l">
                {!reduced && (
                  <>
                    {/* The fill grows down the rail as the list is scrolled through… */}
                    <motion.span
                      aria-hidden
                      style={{ scaleY: fillScale, height: railEnd }}
                      className="bg-ink absolute -left-px top-0 w-px origin-top"
                    />
                    {/* …and a small orange marker leads it. */}
                    <motion.span
                      aria-hidden
                      style={{ y: headY, opacity: headOpacity }}
                      className="bg-power-orange-solid absolute -left-[5px] top-[2px] h-[9px] w-[9px] rounded-[2px]"
                    />
                  </>
                )}
                {MY_CHILD_TIMELINE.map((entry, index) => (
                  <TimelineItem
                    key={`${entry.when}-${entry.what}`}
                    entry={entry}
                    index={index}
                    total={total}
                    progress={scrollYProgress}
                    still={reduced}
                    reached={active === total - 1}
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

// ─── I: three panels land with a small tilt, then drift ─────────────────────

export function MyChildDriftPanels() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const wide = useWide();
  const move = wide && !reduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // Landing: over the first part of the scroll the panels settle from a small tilt.
  const landing = useTransform(scrollYProgress, [0.04, 0.4], [0, 1]);
  const tiltLeft = useTransform(landing, [0, 1], [-1.8, 0]);
  const tiltRight = useTransform(landing, [0, 1], [1.8, 0]);
  const centreScale = useTransform(landing, [0, 1], [0.965, 1]);
  const shadow = useTransform(landing, [0.4, 1], [0, 1]);

  // Drifting: all the way through, each panel at its own pace.
  const driftLeft = useTransform(scrollYProgress, [0, 1], [26, -26]);
  const driftCentre = useTransform(scrollYProgress, [0, 1], [12, -12]);
  const driftRight = useTransform(scrollYProgress, [0, 1], [52, -52]);
  const headingY = useTransform(scrollYProgress, [0, 1], [8, -22]);

  const profile = MY_CHILD_ROWS.find((row) => row.key === "profile");
  const open = MY_CHILD_ROWS.find((row) => row.key === "open");

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper">
        <div className="bg-paper-deep px-4 pb-44 pt-16 sm:px-6 sm:pb-56 sm:pt-24 lg:px-8 lg:pb-64 lg:pt-28">
          <motion.div
            style={move ? { y: headingY } : undefined}
            className="mx-auto max-w-3xl text-center"
          >
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>
              A picture of your child that builds over time
            </h2>
            <p className={`${SECTION_LEAD} mx-auto`}>{LEAD}</p>
          </motion.div>
        </div>

        <div className="relative -mt-32 px-4 pb-16 sm:-mt-44 sm:px-6 sm:pb-24 lg:-mt-52 lg:px-8 lg:pb-28">
          <div
            ref={ref}
            className="mx-auto grid max-w-6xl items-start gap-5 lg:grid-cols-[1fr_1.35fr_1fr]"
          >
            <motion.div
              style={move ? { y: driftLeft, rotate: tiltLeft } : undefined}
              className="lg:mt-16"
            >
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

            <motion.div
              style={move ? { y: driftCentre, scale: centreScale } : undefined}
              className="relative"
            >
              {/* The shadow is its own layer so it can arrive after the panel has settled. */}
              <motion.div
                aria-hidden
                style={move ? { opacity: shadow } : undefined}
                className="absolute inset-0 rounded-2xl shadow-[0_32px_64px_-32px_rgba(57,34,30,0.35)]"
              />
              <Panel title={`${EXAMPLE_CHILD.name}'s journey`} className="relative">
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

            <motion.div
              style={move ? { y: driftRight, rotate: tiltRight } : undefined}
              className="lg:mt-32"
            >
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
