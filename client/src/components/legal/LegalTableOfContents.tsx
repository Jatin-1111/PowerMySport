"use client";

import { cn } from "@/utils/cn";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface LegalTocItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Clears the site's sticky h-16 nav with room to spare.
const TOP_OFFSET = 96;
// Breathing room to leave between the docked nav and the footer below it.
const BOTTOM_GAP = 32;

/**
 * "On this page" nav for long legal documents: a scroll-spied sidebar
 * genuinely pinned to the viewport on desktop, a jump-to-section dropdown on
 * mobile. Anchors are plain <a href="#id"> so they work without JS; the
 * active-section highlight is a progressive enhancement on top.
 *
 * The desktop nav uses `position: fixed` rather than `sticky` — an ancestor
 * in the marketing layout breaks `sticky`'s containing-block calculation (the
 * element just scrolls away with the page instead of pinning), which doesn't
 * affect `fixed`. It's positioned by replicating the page's own container
 * classes (`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8`) and first grid-column
 * width (280px) at a fixed layer, so it lines up with the reserved gap in
 * the real in-flow grid without any JS measurement. Callers must give the
 * content column `lg:col-start-2` so it lands in the second track — the
 * first (280px) track is intentionally left empty in-flow since the visual
 * sidebar now lives in the fixed layer instead.
 *
 * Because `fixed` has no notion of "where the content starts or ends," it's
 * paired with a scroll listener that mimics `sticky`'s three states by hand:
 * docked at the content's own top edge before scrolling reaches the pin
 * point (otherwise it overlaps the page's hero header), pinned to the
 * viewport in between, and docked above the footer past the end of the
 * content (otherwise it floats on top of the footer).
 */
type NavMode = { position: "fixed" | "absolute"; top: number };

export function LegalTableOfContents({ items }: { items: LegalTocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [mode, setMode] = useState<NavMode>({ position: "fixed", top: TOP_OFFSET });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((heading) => observerRef.current?.observe(heading));
    return () => observerRef.current?.disconnect();
  }, [items]);

  useEffect(() => {
    const updatePosition = () => {
      const card = document.querySelector(".legal-content");
      const navEl = navRef.current;
      if (!card || !navEl) return;
      const cardRect = card.getBoundingClientRect();
      const navHeight = navEl.offsetHeight;

      if (cardRect.top > TOP_OFFSET) {
        // Haven't scrolled far enough yet — sit at the content's own start
        // so we don't overlap the hero header above it.
        setMode({ position: "absolute", top: cardRect.top + window.scrollY });
      } else if (cardRect.bottom < TOP_OFFSET + navHeight + BOTTOM_GAP) {
        // Past the end of the content — dock above the footer.
        setMode({
          position: "absolute",
          top: cardRect.bottom + window.scrollY - navHeight,
        });
      } else {
        // Comfortably inside the content — pin to the viewport.
        setMode({ position: "fixed", top: TOP_OFFSET });
      }
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  const list = (
    <ul className="space-y-0.5">
      {items.map(({ id, label, icon: Icon }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            aria-current={activeId === id ? "location" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-colors",
              activeId === id
                ? "bg-power-orange/10 font-semibold text-power-orange"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span>{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Mobile: jump-to-section dropdown, in normal flow */}
      <div className="mb-6 lg:hidden">
        <label htmlFor="legal-toc-mobile" className="sr-only">
          Jump to section
        </label>
        <select
          id="legal-toc-mobile"
          defaultValue=""
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
          onChange={(e) => {
            const target = document.getElementById(e.target.value);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <option value="" disabled>
            Jump to section&hellip;
          </option>
          {items.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: fixed to the viewport, but docks at the end of the content
          instead of floating on top of the footer. Aligned to the page's own
          container so it lines up with the reserved grid gap. */}
      <div
        className={cn(
          "pointer-events-none inset-x-0 z-10 hidden lg:block",
          mode.position,
        )}
        style={{ top: mode.top }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav
            ref={navRef}
            aria-label="Table of contents"
            className="pointer-events-auto w-[280px] max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <p className="mb-2 px-2.5 pt-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
              On this page
            </p>
            {list}
          </nav>
        </div>
      </div>
    </>
  );
}
