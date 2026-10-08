"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

// ─── The header's dropdown menus ────────────────────────────────────────────
//
// One panel and one row, shared by Explore and Services, so the two menus move
// and look the same instead of drifting apart as they had.
//
// The motion is meant to be felt rather than watched. The panel drops in from
// the button with a short spring, its accent line draws across, and the rows
// follow one after another, which also tells the eye the order to read them
// in. A row answers the pointer with its icon lifting and an arrow sliding in.
// Nothing loops, and nothing follows the cursor.
//
// With "reduce motion" set, every movement is dropped and what remains is a
// quick fade, so the menu still arrives without anything travelling.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Whether the viewer asked for less motion, shared by every part of one menu. */
const ReducedMotionContext = createContext(false);

function itemVariants(reduce: boolean): Variants {
  return reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.12 } } }
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
      };
}

export function NavDropdownPanel({
  open,
  onMouseLeave,
  wide = false,
  children,
}: {
  open: boolean;
  onMouseLeave: () => void;
  /** Lays groups out side by side; the caller wraps each group in a column. */
  wide?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;

  const panel: Variants = reduce
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.08 } },
      }
    : {
        hidden: { opacity: 0, y: -10, scale: 0.96 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            opacity: { duration: 0.14 },
            default: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 },
            // Rows start a beat after the panel and arrive one at a time.
            delayChildren: 0.05,
            staggerChildren: 0.04,
          },
        },
        // Leaving is quicker than arriving: a menu that lingers feels sluggish.
        exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12, ease: "easeIn" } },
      };

  const accent: Variants = reduce
    ? { hidden: {}, show: {} }
    : { hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.4, ease: EASE_OUT } } };

  return (
    <AnimatePresence>
      {open && (
        <ReducedMotionContext.Provider value={reduce}>
          <motion.div
            variants={panel}
            initial="hidden"
            animate="show"
            exit="exit"
            onMouseLeave={onMouseLeave}
            style={{ transformOrigin: wide ? "top left" : "top center" }}
            className={cn(
              "absolute mt-3 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl",
              // The wide menu hangs from the button's left edge: centred, it
              // would run off the left of the screen next to the logo.
              wide
                ? "w-[min(46rem,calc(100vw-2rem))] md:-left-44 lg:left-0"
                : "left-1/2 w-80 -translate-x-1/2"
            )}
          >
            <motion.div
              variants={accent}
              className="from-power-orange/60 via-power-orange to-power-orange/60 h-0.5 w-full bg-gradient-to-r"
            />
            <div className={wide ? undefined : "py-1.5"}>{children}</div>
          </motion.div>
        </ReducedMotionContext.Provider>
      )}
    </AnimatePresence>
  );
}

/** A small heading that starts a group of rows. */
export function NavDropdownHeading({
  children,
  first = false,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  const variants = itemVariants(useContext(ReducedMotionContext));
  return (
    <motion.p
      variants={variants}
      className={cn(
        "px-4 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500",
        first ? "pt-2" : "mt-1 border-t border-slate-100 pt-3"
      )}
    >
      {children}
    </motion.p>
  );
}

/** A thin rule between groups, for a menu with no headings. */
export function NavDropdownDivider() {
  const variants = itemVariants(useContext(ReducedMotionContext));
  return <motion.div variants={variants} className="mx-3 my-1 border-t border-slate-100" />;
}

export function NavDropdownItem({
  href,
  icon: Icon,
  label,
  description,
  active = false,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  active?: boolean;
  onNavigate: () => void;
}) {
  const variants = itemVariants(useContext(ReducedMotionContext));
  return (
    <motion.div variants={variants}>
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-orange-50",
          active && "bg-orange-50"
        )}
      >
        {/* shrink-0 keeps every tile the same size; without it the longest
            description squeezed its tile and pushed its text out of line. */}
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition duration-200 motion-reduce:transition-none",
            active
              ? "bg-power-orange-solid text-white"
              : "group-hover:bg-power-orange/10 group-hover:text-power-orange bg-slate-100 text-slate-500"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold leading-tight transition-colors",
              active
                ? "text-power-orange-solid"
                : "group-hover:text-power-orange-solid text-slate-800"
            )}
          >
            {label}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
        </div>
        <ArrowRight
          aria-hidden
          className="text-power-orange h-4 w-4 shrink-0 -translate-x-1.5 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
        />
      </Link>
    </motion.div>
  );
}

/**
 * A strip along the bottom of a menu for the one thing to do when no row fits:
 * ask a person. It opens in a new tab, so it takes an external href.
 */
export function NavDropdownFooter({
  href,
  prompt,
  label,
}: {
  href: string;
  prompt: string;
  label: string;
}) {
  const variants = itemVariants(useContext(ReducedMotionContext));
  return (
    <motion.div
      variants={variants}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-4 py-3"
    >
      <p className="text-sm text-slate-600">{prompt}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
      >
        <WhatsAppIcon className="h-4 w-4 shrink-0" />
        {label}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </a>
    </motion.div>
  );
}
