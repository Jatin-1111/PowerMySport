"use client";

import { PANEL, PANEL_FADE } from "@/modules/planner/utils/motion";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * A titled section that stays closed until it is wanted.
 *
 * It is a ruled row, not a card: a hairline above, the title and a chevron, and the
 * content open on the page beneath. With the calendar and both event lists open at
 * once, three stacked boxes read as three more things to look at; three ruled rows
 * read as one page with sections.
 *
 * Open state can belong to the parent (`open` with `onOpenChange`), for the one
 * place where a button elsewhere on the page needs to open it. Without those it
 * looks after itself.
 */
export function Collapsible({
  title,
  description,
  children,
  tour,
  open: controlledOpen,
  onOpenChange,
  heavy = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Names this section for the planner tour to point at. */
  tour?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** A long body: fade it in rather than animating its height, which re-lays-out every frame. */
  heavy?: boolean;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const toggle = () => {
    const next = !open;
    setOwnOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section data-tour={tour} className="border-hairline border-t">
      <h2 className="font-editorial text-ink text-xl font-normal">
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="focus-visible:ring-ink hover:bg-paper-deep/60 group -mx-3 flex min-h-16 w-[calc(100%+1.5rem)] items-center justify-between gap-4 rounded-lg px-3 py-4 text-left transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2"
        >
          <span>
            {title}
            <span className="text-ink-body mt-0.5 block font-sans text-sm font-normal">
              {description}
            </span>
          </span>
          <ChevronDown
            className={`text-ink-muted h-5 w-5 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            {...(heavy ? PANEL_FADE : PANEL)}
            className={heavy ? undefined : "-mx-2 overflow-hidden px-2"}
          >
            <div className="pb-8 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
