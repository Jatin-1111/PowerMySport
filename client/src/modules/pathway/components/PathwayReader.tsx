"use client";

// ─── Pathway reader ──────────────────────────────────────────────────────────
//
// One sport's pathway, one stage at a time: a numbered rail down the side, the
// stage in the panel beside it, and Previous/Next at the foot.
//
// ── Why the five buckets are sections, not tabs ──
//
// They were tabs. The bar this page is held to is the boss's: a parent must be
// able to SCROLL DOWN AND READ IT — "don't make the parent do effort in reading
// it". Tabs failed that in a way that is easy to miss: four fifths of every
// stage was behind a click, and reading a six-stage pathway cost thirty of them.
// Worse, nothing on screen told you the other four buckets existed, so the
// honest outcome was parents reading Overview and leaving.
//
// So the buckets now stack, and the tab row became a sticky jump bar that
// highlights whichever section you have scrolled to. Nothing is hidden, the
// affordance for skipping ahead is still there, and the row still shows all five
// so the shape of a stage is visible before you read a word of it.

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  GitBranch,
  MapPin,
  MessageCircleQuestion,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  PathwayAction,
  PathwayGuide,
  PathwayStage,
} from "@/modules/pathway/services/pathway";
import { findStageForAge } from "../utils/ageRange";
import { parseTypedAge, rememberChildAge, useChildAge } from "../utils/childAge";
import { headingDomId, sectionDomId } from "../utils/sectionIds";
import type { SectionId } from "../utils/sectionIds";

// ─── Motion ──────────────────────────────────────────────────────────────────
//
// Every animation here is a response to something the reader did — changing
// stage, opening a question, jumping to a section. None of them gate content:
// the first paint is deliberately un-animated (see `useHasMounted`) so the
// server-rendered pathway is visible at `opacity: 1` even if JavaScript never
// arrives, and so a parent who lands mid-page is not made to wait for a fade.
//
// `MotionConfig reducedMotion="user"` wraps the whole reader, so an OS-level
// "reduce motion" setting drops the movement and keeps only the cross-fades.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The panel swap when a different stage is chosen. */
const stageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE_OUT },
};

/** The stage's five sections, dealt out one after another rather than at once. */
const sectionStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const sectionReveal = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/**
 * False during the first render (including on the server), true from the first
 * effect onwards.
 *
 * A ref rather than state on purpose: flipping state would re-render the whole
 * reader immediately after mount for no visual change. Nothing needs to render
 * *because* it flipped — it is only ever read on a later render, when a stage
 * change is already causing one.
 */
function useHasMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return mounted;
}

/**
 * One colour per stage, so the rail reads as a sequence of distinct places
 * rather than six identical rows. Cycled, because a sport is free to have more
 * stages than tennis does.
 */
const STAGE_COLORS = [
  "#16a34a",
  "#ea580c",
  "#d97706",
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#db2777",
  "#0891b2",
  "#65a30d",
];

const colorFor = (index: number) =>
  STAGE_COLORS[index % STAGE_COLORS.length] as string;

const SECTIONS: Array<{
  id: SectionId;
  n: string;
  label: string;
  heading: string;
  blurb: string;
  icon: typeof Eye;
}> = [
  {
    id: "overview",
    n: "01",
    label: "Overview",
    heading: "Where you are",
    blurb: "What this stage means and what matters in it.",
    icon: ClipboardCheck,
  },
  {
    id: "questions",
    n: "02",
    label: "Your questions",
    heading: "What parents usually ask here",
    blurb: "The answers parents ask for most at this stage.",
    icon: MessageCircleQuestion,
  },
  {
    id: "signals",
    n: "03",
    label: "What to look for",
    heading: "What to look for",
    blurb: "In your child, the coach and the environment.",
    icon: Eye,
  },
  {
    id: "decisions",
    n: "04",
    label: "Decisions",
    heading: "Decisions",
    blurb: "Choices this stage may put in front of you.",
    icon: GitBranch,
  },
  {
    id: "next",
    n: "05",
    label: "Next step",
    heading: "What should I actually do now?",
    blurb: "",
    icon: ArrowRight,
  },
];

/** Which sections this stage actually has content for. */
function sectionsFor(stage: PathwayStage) {
  return SECTIONS.filter((section) => {
    switch (section.id) {
      case "overview":
        return Boolean(stage.overview);
      case "questions":
        return stage.questions.length > 0;
      case "signals":
        return stage.signals.length > 0;
      case "decisions":
        return stage.decisions.length > 0;
      case "next":
        return stage.nextSteps.length > 0;
    }
  });
}

/** Renders as a link when it has an href, and as plain text when it doesn't. */
function ActionChip({ action }: { action: PathwayAction }) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-bold transition";
  return action.href ? (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="inline-flex"
    >
      <Link
        href={action.href}
        className={`${base} border-slate-200 bg-white text-slate-700 hover:border-power-orange hover:text-power-orange`}
      >
        {action.label}
      </Link>
    </motion.div>
  ) : (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-400`}>
      {action.label}
    </span>
  );
}

// ─── The rail ────────────────────────────────────────────────────────────────

function StageListItem({
  stage,
  index,
  active,
  isCurrent,
  railId,
  onSelect,
}: {
  stage: PathwayStage;
  index: number;
  active: boolean;
  isCurrent: boolean;
  /**
   * Which rail this item belongs to. The mobile disclosure and the desktop
   * column render the same list twice, and a `layoutId` shared across both
   * would make the highlight fly between two copies of the same stage.
   */
  railId: string;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-current={active ? "step" : undefined}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`relative flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-power-orange ${
        active ? "" : "hover:bg-slate-50"
      }`}
    >
      {/* The highlight is one element that slides between rows rather than a
          class that blinks off one and on another — it carries the eye from the
          stage you left to the stage you picked. */}
      {active && (
        <motion.span
          aria-hidden
          layoutId={`pathway-rail-active-${railId}`}
          transition={{ type: "spring", stiffness: 460, damping: 38 }}
          className="absolute inset-0 rounded-xl bg-slate-100"
        />
      )}
      <span
        className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
        style={{ background: colorFor(index) }}
      >
        {index + 1}
      </span>
      <span className="relative min-w-0 flex-1">
        <span
          className={`block truncate text-[13.5px] font-bold transition-colors ${
            active ? "text-slate-900" : "text-slate-700"
          }`}
        >
          {stage.name}
        </span>
        <span className="block truncate text-[12px] text-slate-400">
          {stage.ageRange}
        </span>
        <AnimatePresence initial={false}>
          {isCurrent && (
            <motion.span
              // Typing an age is what makes this appear, so it earns a small
              // arrival of its own — otherwise the badge just materialises
              // somewhere down a list the reader is not looking at.
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="mt-1 inline-flex origin-left items-center gap-1 rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-black uppercase tracking-wide text-amber-950"
            >
              <MapPin className="h-2.5 w-2.5" /> You are here
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="relative mt-1 shrink-0"
          >
            <ChevronRight aria-hidden className="h-4 w-4 text-slate-500" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Section scaffolding ─────────────────────────────────────────────────────

function SectionHeading({
  id,
  n,
  heading,
  blurb,
}: {
  id: SectionId;
  n: string;
  heading: string;
  blurb: string;
}) {
  return (
    <div className="mb-4">
      {/* The bucket number is decoration beside a heading that already says the
          same thing — read aloud it would announce "zero one" before every
          section title. */}
      <p
        aria-hidden
        className="text-[11px] font-black tracking-[0.18em] text-power-orange"
      >
        {n}
      </p>
      <h3
        id={headingDomId(id)}
        className="mt-1 text-[17px] font-extrabold tracking-tight text-slate-900"
      >
        {heading}
      </h3>
      {blurb && (
        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">
          {blurb}
        </p>
      )}
    </div>
  );
}

function QuestionsList({ stage }: { stage: PathwayStage }) {
  // Answers are shown outright rather than behind a disclosure: a parent
  // scanning this section wants the answers, and making them click eight times
  // to read eight short paragraphs buys nothing but hidden content.
  return (
    <ul className="space-y-2.5">
      {stage.questions.map((item) => (
        <li
          key={item.question}
          className="rounded-xl border border-slate-200 bg-white p-3.5"
        >
          <span className="block text-[14.5px] font-semibold leading-snug text-slate-900">
            {item.question}
          </span>
          {item.answer?.trim() && (
            <span className="mt-1 block max-w-[70ch] text-[13.5px] leading-relaxed text-slate-500">
              {item.answer}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── The reader ──────────────────────────────────────────────────────────────

export function PathwayReader({
  guide,
  initialStageKey,
}: {
  guide: PathwayGuide;
  /** From `?stage=` on the server, so a shared link opens the right stage. */
  initialStageKey?: string | undefined;
}) {
  const stages = guide.stages;

  const [index, setIndex] = useState(() => {
    const at = stages.findIndex((s) => s.key === initialStageKey);
    return at >= 0 ? at : 0;
  });
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  // Remembered across visits, and across sports — a family has one child, and
  // asking their age again on every pathway is the kind of small tax that makes
  // a tool feel like paperwork. The `/roadmap` picker writes the same value, so
  // a parent who answered there is never asked here.
  const childAge = useChildAge();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>(
    {},
  );
  const stageHeaderRef = useRef<HTMLElement | null>(null);
  const mobileRailRef = useRef<HTMLDetailsElement | null>(null);
  // Set by `go`, consumed by the effect below. A ref rather than state because
  // it must not cause a render of its own, and it must be false on first paint:
  // stealing focus on page load would drop a screen reader past the page's own
  // heading and navigation.
  const shouldFocusStage = useRef(false);

  const total = stages.length;
  // Clamp rather than trust: the index is React state, and a shorter guide
  // arriving (a stage deleted in the CMS) would otherwise read past the end of
  // the array and blank the page.
  const safeIndex = Math.min(index, total - 1);
  const stage = stages[safeIndex] as PathwayStage;
  const sections = useMemo(() => sectionsFor(stage), [stage]);

  // The stage panel animates when the reader *changes* stage, never on arrival.
  const hasMounted = useHasMounted();
  const animateStage = hasMounted.current;

  const currentStageIndex = useMemo(
    () => (childAge === null ? -1 : findStageForAge(stages, childAge)),
    [stages, childAge],
  );

  const go = useCallback(
    (next: number, options?: { scroll?: boolean }) => {
      if (next < 0 || next >= total) return;
      setIndex(next);
      setActiveSection("overview");
      shouldFocusStage.current = true;
      // The mobile rail is a disclosure over the content it navigates. Leaving
      // it open after a choice buries the stage the reader just asked for.
      if (mobileRailRef.current) mobileRailRef.current.open = false;

      // `history.replaceState`, not the Next router: this page is a server
      // component that reads searchParams, so router.replace would refetch the
      // whole guide to change a value only the client cares about.
      const url = new URL(window.location.href);
      url.searchParams.set("stage", stages[next]?.key ?? "");
      window.history.replaceState(null, "", url);

      if (options?.scroll !== false) {
        panelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    },
    [stages, total],
  );

  const setAge = (raw: string) => {
    const age = parseTypedAge(raw);
    rememberChildAge(age);
    if (age === null) return;
    const match = findStageForAge(stages, age);
    if (match >= 0) go(match, { scroll: false });
  };

  // ── Announce the new stage ──
  //
  // Choosing a stage replaces the entire panel. Sighted readers see that; a
  // screen reader user got nothing at all, and their reading position stayed on
  // the rail button they had just pressed. Moving focus to the panel header
  // both announces the stage and puts the next Tab where the new content is.
  //
  // Focus rather than an `aria-live` region: a live region would announce the
  // change but leave the reading position behind, and having both would say the
  // stage name twice.
  useEffect(() => {
    if (!shouldFocusStage.current) return;
    shouldFocusStage.current = false;
    stageHeaderRef.current?.focus({ preventScroll: true });
  }, [safeIndex]);

  // ── Scroll-spy for the jump bar ──
  // rootMargin pulls the detection line to just under the sticky header, so the
  // chip highlights the section a reader is actually looking at rather than the
  // one hidden behind the header.
  useEffect(() => {
    const elements = sections
      .map((section) => sectionRefs.current[section.id])
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible?.target instanceof HTMLElement) {
          const id = visible.target.dataset.section as SectionId | undefined;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, safeIndex]);

  const jumpTo = (id: SectionId) => {
    const target = sectionRefs.current[id];
    if (!target) return;
    setActiveSection(id);

    // Honour the OS setting. A smooth scroll across five sections is exactly the
    // vestibular trigger `prefers-reduced-motion` exists to prevent.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });

    // Move focus to the section, or a keyboard and screen-reader user scrolls
    // the page while their reading position stays back on the jump bar — the
    // classic broken skip-link. `tabIndex={-1}` on the section makes it a valid
    // target without putting it in the tab order.
    target.focus({ preventScroll: true });
  };

  const registerSection = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const renderStageList = (railId: string) => (
    <div className="space-y-1">
      {stages.map((item, i) => (
        <StageListItem
          key={item.key}
          stage={item}
          index={i}
          active={i === safeIndex}
          isCurrent={i === currentStageIndex}
          railId={railId}
          onSelect={() => go(i)}
        />
      ))}
    </div>
  );

  const ageField = (
    <div className="px-3 pb-2 pt-1">
      <label className="block text-[11px] font-bold text-slate-500">
        How old is your child?
        <input
          type="number"
          min={1}
          max={99}
          inputMode="numeric"
          value={childAge ?? ""}
          onChange={(e) => setAge(e.target.value)}
          placeholder="e.g. 9"
          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-300 focus:border-power-orange focus:outline-none"
        />
      </label>
      <AnimatePresence initial={false}>
        {childAge !== null && currentStageIndex < 0 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden text-[11px] text-slate-400"
          >
            <span className="mt-1 block">
              No stage covers age {childAge} yet.
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    // `reducedMotion="user"` rather than a hook at every call site: it strips
    // transforms from everything below while keeping opacity and colour, so one
    // line honours the OS setting for animations added here later too.
    <MotionConfig reducedMotion="user">
      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-5">
        {/* ── The rail ──
             A dropdown below lg, where 290px of stage titles would eat the
             screen the stage itself needs. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <details
            ref={mobileRailRef}
            className="group rounded-2xl border border-slate-200 bg-white p-2 lg:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-[13px] font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ background: colorFor(safeIndex) }}
              >
                {safeIndex + 1}
              </span>
              Stage {safeIndex + 1} of {total} · {stage.name}
              <ChevronRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 border-t border-slate-100 pt-2">
              {ageField}
              {renderStageList("mobile")}
            </div>
          </details>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-2 lg:block">
            <p className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              {total} stages
            </p>
            {ageField}
            <div className="mt-1 border-t border-slate-100 pt-2">
              {renderStageList("desktop")}
            </div>
          </div>
        </aside>

        {/* ── The stage ──
             self-start, or the grid stretches the panel to the rail's height and
             a short stage renders a bordered white box with hundreds of empty
             pixels under the content. */}
        <div
          ref={panelRef}
          className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:self-start"
        >
          <header
            ref={stageHeaderRef}
            // A labelled group, so landing here announces "Stage 3 of 6, Compete &
            // Assess" rather than dropping the reader into unnamed content.
            // `tabIndex={-1}` makes it a focus target without adding a stop to the
            // tab order, and no focus ring: it is a destination, not a control.
            tabIndex={-1}
            role="group"
            aria-labelledby="pathway-stage-position pathway-stage-name"
            className="border-b border-slate-100 px-4 py-4 focus:outline-none sm:px-6 sm:py-5"
          >
            {/* Keyed on the stage so changing stage re-mounts and fades the
              header's contents in. The <header> itself is deliberately NOT
              keyed: it carries `stageHeaderRef`, and remounting it would pull
              the focus target out from under the announce-the-stage effect. */}
            <motion.div
              key={stage.key}
              initial={animateStage ? stageEnter.initial : false}
              animate={stageEnter.animate}
              transition={stageEnter.transition}
              className="flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    id="pathway-stage-position"
                    className="inline-block rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-widest text-white"
                    style={{ background: colorFor(safeIndex) }}
                  >
                    Stage {safeIndex + 1} of {total}
                  </span>
                  {safeIndex === currentStageIndex && (
                    <motion.span
                      initial={
                        animateStage ? { opacity: 0, scale: 0.85 } : false
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 24,
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950"
                    >
                      <MapPin className="h-3 w-3" /> Your child is here
                    </motion.span>
                  )}
                </div>
                {/* h2, not h3. The page's h1 is the pathway headline, so the
                  stage is the next level down and the bucket headings inside it
                  are h3 — the old h1 → h3 → h4 order skipped a level, which is
                  what breaks heading-based navigation. */}
                <h2
                  id="pathway-stage-name"
                  className="mt-2 text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-slate-900 sm:text-[26px]"
                >
                  {stage.name}
                </h2>
                {/* The core question is the subtitle — it is the one thing this
                  stage exists to answer, so it sits under the name rather than
                  being buried in the Overview section. */}
                <p className="mt-1 text-[14.5px] leading-snug text-slate-500">
                  {stage.coreQuestion}
                </p>
              </div>

              {stage.ageRange && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                  <Users className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      Typical age
                    </p>
                    <p className="text-[15px] font-extrabold text-emerald-900">
                      {stage.ageRange}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Progress through the whole pathway, in the header where it is
              always visible — it used to sit inside the Overview tab, which is
              the one place a reader already knows where they are. */}
            {/* Each segment fills in its own colour a beat after the one before
              it, so jumping from stage two to stage five reads as ground
              covered rather than three bars blinking on at once. */}
            <div className="mt-4 flex gap-1" aria-hidden>
              {stages.map((item, i) => (
                <motion.span
                  key={item.key}
                  className="h-1.5 flex-1 rounded-full"
                  initial={false}
                  animate={{
                    backgroundColor: i <= safeIndex ? colorFor(i) : "#e2e8f0",
                  }}
                  transition={{
                    duration: 0.3,
                    ease: EASE_OUT,
                    delay: i <= safeIndex ? Math.min(i, 6) * 0.04 : 0,
                  }}
                />
              ))}
            </div>
          </header>

          {/* ── Jump bar ──
               Sticky, so the shape of a stage stays visible while reading it and
               skipping to "what do I do now" is always one click away. */}
          <nav
            aria-label={`Sections of ${stage.name}`}
            className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-2 py-2 backdrop-blur sm:px-4"
          >
            <ul className="flex gap-1 overflow-x-auto">
              {sections.map(({ id, n, label, icon: Icon }) => (
                <li key={id} className="shrink-0">
                  {/* An anchor, not a button. This is navigation to a place on the
                    page: it belongs in the links list a screen reader can pull
                    up, it works before hydration, and it can be opened in a new
                    tab or copied like any other link. `onClick` only adds the
                    focus handling and reduced-motion scroll on top of the
                    native jump — `preventDefault` is deliberately not called
                    when the target is missing, so the browser still handles it. */}
                  <a
                    href={`#${sectionDomId(id)}`}
                    onClick={(event) => {
                      if (!sectionRefs.current[id]) return;
                      event.preventDefault();
                      jumpTo(id);
                    }}
                    // "location" is the value for the current place within a page;
                    // "true" is the generic fallback and says less.
                    aria-current={activeSection === id ? "location" : undefined}
                    className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-power-orange ${
                      activeSection === id
                        ? "text-white"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {/* One pill that travels along the bar as you scroll, rather
                      than a dark background jumping between chips. It is the
                      only thing on the page that shows reading progress through
                      a stage, so the movement is the information. */}
                    {activeSection === id && (
                      <motion.span
                        aria-hidden
                        layoutId="pathway-jump-active"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 38,
                        }}
                        className="absolute inset-0 rounded-lg bg-slate-900"
                      />
                    )}
                    <Icon aria-hidden className="relative h-3.5 w-3.5" />
                    {/* Narrow screens show "01", which is meaningless read aloud.
                      The full label is always in the accessible name; only its
                      visual presentation changes. */}
                    <span className="relative hidden sm:inline">{label}</span>
                    <span aria-hidden className="relative sm:hidden">
                      {n}
                    </span>
                    <span className="sr-only sm:hidden">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Keyed on the stage, so a new stage's five buckets deal themselves in
            one after another instead of the panel's whole contents swapping in
            a single frame. `initial={false}` on first paint: the server-rendered
            stage must be at full opacity in the HTML. */}
          <motion.div
            key={stage.key}
            variants={sectionStagger}
            initial={animateStage ? "hidden" : false}
            animate="show"
            className="divide-y divide-slate-100"
          >
            {sections.map((section) => (
              <motion.section
                key={section.id}
                variants={sectionReveal}
                id={sectionDomId(section.id)}
                ref={registerSection(section.id)}
                data-section={section.id}
                // Named by its own heading, so a screen reader announces "What to
                // look for, region" instead of six anonymous regions.
                aria-labelledby={headingDomId(section.id)}
                // Focusable as a jump target but out of the tab order, and no
                // focus ring — the section is not an interactive control, it is
                // just where the reader has been moved to.
                tabIndex={-1}
                className="scroll-mt-16 px-4 py-6 focus:outline-none sm:px-6"
              >
                <SectionHeading
                  id={section.id}
                  n={section.n}
                  heading={section.heading}
                  blurb={
                    section.id === "next"
                      ? (stage.nextStepLead ??
                        "Pick the line that describes where you are today.")
                      : section.blurb
                  }
                />

                {section.id === "overview" && (
                  <p className="max-w-[68ch] text-[15.5px] leading-relaxed text-slate-700">
                    {stage.overview}
                  </p>
                )}

                {section.id === "questions" && <QuestionsList stage={stage} />}

                {section.id === "signals" && (
                  <ol className="space-y-2.5">
                    {stage.signals.map((signal, i) => (
                      <li
                        key={signal.title}
                        className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-500">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <span className="block text-[14.5px] font-semibold leading-snug text-slate-900">
                            {signal.title}
                          </span>
                          {signal.detail && (
                            <span className="mt-1 block text-[13.5px] leading-relaxed text-slate-500">
                              {signal.detail}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {section.id === "decisions" && (
                  <>
                    <ul className="space-y-2.5">
                      {stage.decisions.map((decision) => (
                        <li
                          key={decision.title}
                          className="rounded-xl border border-slate-200 bg-white p-3.5"
                        >
                          <span className="block text-[14.5px] font-semibold leading-snug text-slate-900">
                            {decision.title}
                          </span>
                          {decision.detail && (
                            <span className="mt-1 block text-[13.5px] leading-relaxed text-slate-500">
                              {decision.detail}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {stage.helpLinks.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Get help with this
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {stage.helpLinks.map((link) => (
                            <ActionChip key={link.label} action={link} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {section.id === "next" && (
                  <>
                    <ol className="space-y-2.5">
                      {stage.nextSteps.map((step) => (
                        <li
                          key={`${step.when}-${step.action}`}
                          className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3.5 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4"
                        >
                          <span className="inline-flex w-fit items-center rounded-lg bg-orange-100 px-2.5 py-1 text-[12.5px] font-black text-power-orange">
                            {step.when}
                          </span>
                          <span className="text-[14.5px] leading-relaxed text-slate-700">
                            {step.action}
                          </span>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {stage.primaryAction?.href && (
                        <Link
                          href={stage.primaryAction.href}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
                        >
                          {stage.primaryAction.label}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                      <Link
                        href="/booking?tab=experts"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400"
                      >
                        Speak with an expert
                      </Link>
                    </div>
                  </>
                )}
              </motion.section>
            ))}
          </motion.div>

          {/* ── Previous / Next ── */}
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
            <motion.button
              type="button"
              onClick={() => go(safeIndex - 1)}
              disabled={safeIndex === 0}
              // The arrow leans the way it will take you. Guarded on `disabled`,
              // or the dead button at either end still nudges under the cursor
              // and promises a move it will not make.
              whileHover={safeIndex === 0 ? undefined : { x: -2 }}
              whileTap={safeIndex === 0 ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-power-orange disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="hidden truncate sm:inline">
                {stages[safeIndex - 1]?.name ?? "Previous"}
              </span>
              <span className="sm:hidden">Previous</span>
            </motion.button>
            <span className="shrink-0 text-[12px] font-semibold text-slate-400">
              {safeIndex + 1} / {total}
            </span>
            <motion.button
              type="button"
              onClick={() => go(safeIndex + 1)}
              disabled={safeIndex === total - 1}
              whileHover={safeIndex === total - 1 ? undefined : { x: 2 }}
              whileTap={safeIndex === total - 1 ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-power-orange disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <span className="hidden truncate sm:inline">
                {stages[safeIndex + 1]?.name ?? "Next"}
              </span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </motion.button>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}
