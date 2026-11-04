import type { Transition, Variants } from "framer-motion";

/**
 * How the planner moves. One curve and a few durations, so everything on the page speeds
 * up and settles the same way, and nothing moves that does not need to.
 *
 * The rules, kept deliberately small:
 *   - transform and opacity only, apart from an accordion opening, which has to grow
 *   - a few pixels of travel, never a flourish
 *   - nothing waits on an animation: content is in the page and readable at once
 *   - `prefers-reduced-motion` turns it all off (the board sets `reducedMotion="user"`)
 */

/** A fast start that settles gently, the same on every element. */
export const EASE = [0.32, 0.72, 0, 1] as const;

export const SETTLE: Transition = { duration: 0.45, ease: EASE };
export const QUICK: Transition = { duration: 0.25, ease: EASE };

/** The board's blocks arrive one after another, a breath apart. */
export const BOARD: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

export const BLOCK: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: SETTLE },
};

/**
 * An accordion's body. It grows from nothing. The panel always clips what it holds (the
 * component gives it a little side padding, so a focus ring at the edge still shows), because
 * clipping only while it moves can't be done reliably with a timed switch.
 */
export const PANEL = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto" as const, opacity: 1, transition: QUICK },
  exit: { height: 0, opacity: 0, transition: QUICK },
};

/**
 * For a body too big to re-lay-out every frame (the tournament list is about seventy cards):
 * it fades and rises into place and the page below moves once, instead of the whole panel
 * growing a row at a time. Opacity and transform only, so it costs the browser almost nothing.
 */
export const PANEL_FADE = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: QUICK },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE } },
};
