"use client";

import { cn } from "@/utils/cn";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { EXAMPLE_CHILD, MY_CHILD_ROWS, type MyChildKey } from "../../data/myChildExample";
import { Note } from "./MyChildCombined";
import { ControlAndLink, ExampleLabel, Initial } from "./MyChildSections";
import { DIM, EASE, LEAD, useWide } from "./myChildMotionShared";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * The other two scroll-driven "My Child" options, under the same motion rules as
 * MyChildMotion.tsx (transform and opacity, small travel, readable without script,
 * off under reduced motion, nothing follows the cursor).
 *
 *  J  A card that stays put while the five parts are read. The highlight slides from
 *     row to row, a strip of five bars fills as the reader moves on, each part's text
 *     rises into focus and its rule draws across as it arrives.
 *  K  A board whose notes land one after another with a small tilt, drift at their own
 *     pace as the page moves, and whose open-actions note draws its orange rule.
 */

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
  const reduced = Boolean(useReducedMotion());
  // Counts as "being read" while it crosses a band in the middle of the screen.
  const reading = useInView(ref, { margin: "-42% 0px -42% 0px" });
  useEffect(() => {
    if (reading) onActive(index);
  }, [reading, index, onActive]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "end 8%"] });
  const focus = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [DIM, 1, 1, DIM]);
  const rise = useTransform(scrollYProgress, [0, 0.3], [18, 0]);
  const rule = useTransform(scrollYProgress, [0.05, 0.35], [0, 1]);

  return (
    <li ref={ref} className="relative py-8 lg:flex lg:min-h-[48vh] lg:flex-col lg:justify-center">
      <span aria-hidden className="border-hairline absolute inset-x-0 top-0 border-t" />
      {!reduced && (
        <motion.span
          aria-hidden
          style={{ scaleX: rule }}
          className="bg-ink absolute left-0 top-0 h-px w-full origin-left"
        />
      )}
      <motion.div style={reduced ? undefined : { opacity: focus, y: rise }}>
        <p className="text-ink-muted mb-2 text-sm font-medium tabular-nums">
          {index + 1} of {MY_CHILD_ROWS.length}
        </p>
        <h3 className="font-editorial text-ink mb-4 text-4xl font-light">{label}</h3>
        <ul className="text-ink-body max-w-[44ch] space-y-2 text-lg leading-snug">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </motion.div>
    </li>
  );
}

export function MyChildScrollStory() {
  const [active, setActive] = useState(0);
  const current = MY_CHILD_ROWS[active];
  const activeKey: MyChildKey | undefined = current?.key;

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
                          "border-hairline relative grid gap-1 border-b px-5 py-4 transition-opacity duration-300 last:border-b-0 motion-reduce:transition-none sm:grid-cols-[7rem_1fr] sm:gap-4",
                          isActive ? "opacity-100" : "opacity-[0.62]"
                        )}
                      >
                        {isActive && (
                          // One highlight that slides to whichever row is being read.
                          <motion.span
                            aria-hidden
                            layoutId="my-child-story-highlight"
                            transition={{ type: "spring", stiffness: 380, damping: 38 }}
                            className="bg-paper-deep/60 border-l-power-orange-solid absolute inset-0 border-l-2"
                          />
                        )}
                        <dt className="text-ink-muted relative text-sm font-medium">{row.label}</dt>
                        <dd className="text-ink relative text-pretty tabular-nums leading-snug">
                          {row.summary}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              {/* Five bars that fill as the reader moves through the parts. */}
              <div aria-hidden className="mt-5">
                <div className="grid grid-cols-5 gap-1.5">
                  {MY_CHILD_ROWS.map((row, index) => (
                    <span
                      key={row.key}
                      className="bg-ink/15 relative h-[3px] overflow-hidden rounded-[1px]"
                    >
                      <motion.span
                        initial={false}
                        animate={{ scaleX: index <= active ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        className="bg-ink absolute inset-0 origin-left"
                      />
                    </span>
                  ))}
                </div>
                <p className="text-ink-muted mt-3 text-sm tabular-nums">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={active}
                      initial={{ y: 6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -6, opacity: 0 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="inline-block"
                    >
                      {active + 1} of {MY_CHILD_ROWS.length}, {current?.label}
                    </motion.span>
                  </AnimatePresence>
                </p>
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

// ─── K: notes land one after another, then drift ────────────────────────────

interface BoardNoteData {
  label: string;
  /** Final angle on large screens, in degrees. */
  deg: number;
  accent?: boolean;
  body: React.ReactNode;
}

const BOARD_NOTES: BoardNoteData[] = [
  {
    label: "Profile",
    deg: -0.9,
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
    deg: 0.7,
    body: (
      <p className="font-editorial text-ink text-balance text-3xl font-light leading-[1.15]">
        Play a first district tournament this season.
      </p>
    ),
  },
  {
    label: "Open actions",
    deg: 1.1,
    accent: true,
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
    deg: -0.6,
    body: (
      <>
        <p className="text-ink leading-snug">Ranking linked.</p>
        <p className="text-ink-body mt-1 text-sm">Two events played so far.</p>
      </>
    ),
  },
  {
    label: "Decisions",
    deg: -0.9,
    body: (
      <ul className="text-ink space-y-2.5 leading-snug">
        {MY_CHILD_ROWS[3]?.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ),
  },
];

function BoardNote({
  note,
  index,
  progress,
  wide,
  reduced,
}: {
  note: BoardNoteData;
  index: number;
  progress: MotionValue<number>;
  wide: boolean;
  reduced: boolean;
}) {
  // Each note drifts a different distance, so the board shifts as it is scrolled past.
  const reach = 8 + (index % 3) * 7;
  const drift = useTransform(progress, [0, 1], [reach, -reach]);
  const delay = (index % 3) * 0.08;

  return (
    // The outer layer carries the scroll drift and the inner one the landing, so the
    // two never fight over the same transform.
    <motion.div style={wide && !reduced ? { y: drift } : undefined} className="break-inside-avoid">
      <motion.div
        className="relative"
        // Readable wherever it is on first paint: it starts a little low, never hidden.
        initial={reduced ? false : { y: 30, rotate: 0 }}
        whileInView={{ y: 0, rotate: wide ? note.deg : 0 }}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 0.55, ease: EASE, delay }}
      >
        <Note label={note.label}>{note.body}</Note>
        {note.accent && !reduced && (
          <motion.span
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "0px 0px -8% 0px" }}
            transition={{ duration: 0.6, ease: EASE, delay: delay + 0.5 }}
            className="bg-power-orange-solid absolute inset-x-3 top-0 h-0.5 origin-left"
          />
        )}
        {note.accent && reduced && (
          <span aria-hidden className="bg-power-orange-solid absolute inset-x-3 top-0 h-0.5" />
        )}
      </motion.div>
    </motion.div>
  );
}

export function MyChildBoardRise() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = Boolean(useReducedMotion());
  const wide = useWide();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

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

            <div ref={ref} className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {BOARD_NOTES.map((note, index) => (
                <BoardNote
                  key={note.label}
                  note={note}
                  index={index}
                  progress={scrollYProgress}
                  wide={wide}
                  reduced={reduced}
                />
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
