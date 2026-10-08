"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * A titled section that stays closed until it is wanted.
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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Names this section for the planner tour to point at. */
  tour?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const toggle = () => {
    const next = !open;
    setOwnOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section data-tour={tour} className="rounded-lg border border-slate-200 bg-white">
      <h2 className="font-title text-lg font-extrabold text-slate-900">
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg px-5 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:px-6"
        >
          <span>
            {title}
            <span className="mt-0.5 block text-sm font-normal text-slate-600">{description}</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </h2>
      {open && <div className="border-t border-slate-100 p-5 sm:p-6">{children}</div>}
    </section>
  );
}
