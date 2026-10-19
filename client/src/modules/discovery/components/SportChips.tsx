"use client";

import { sportsApi } from "@/modules/sports/services/sports";
import { cn } from "@/utils/cn";
import { useEffect, useState } from "react";

/**
 * A one-tap sport filter: "All" and then a scrolling row of sports, set just
 * under the search box so the most common narrowing needs no modal. It reads the
 * same sport list the filter dialog does and hands the chosen name back; what a
 * tab does with it is the tab's business, the same as typing it into the search.
 */
export function SportChips({
  value,
  onSelect,
}: {
  /** The sport filter currently applied, in whatever case the tab holds it. */
  value: string;
  onSelect: (sport: string) => void;
}) {
  const [sports, setSports] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    sportsApi
      .getAllSports()
      .then((all) => {
        if (!live) return;
        setSports(
          all
            .map((s) => s.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        );
      })
      .catch(() => {
        if (live) setSports([]);
      });
    return () => {
      live = false;
    };
  }, []);

  // Nothing to choose from (not loaded, or the call failed): the search box still works.
  if (sports.length === 0) return null;

  const current = value.trim().toLowerCase();
  const chip = (active: boolean) =>
    cn(
      "focus-visible:ring-ink shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
      active
        ? "bg-ink border-ink text-white"
        : "border-hairline text-ink hover:border-ink/40 bg-white"
    );

  return (
    <div
      role="group"
      aria-label="Filter by sport"
      className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      <button
        type="button"
        aria-pressed={current === ""}
        onClick={() => onSelect("")}
        className={chip(current === "")}
      >
        All sports
      </button>
      {sports.map((name) => {
        const active = current === name.toLowerCase();
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? "" : name)}
            className={chip(active)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
