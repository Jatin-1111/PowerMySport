"use client";

import { cn } from "@/utils/cn";
import React, { useId, useRef, useState } from "react";
import { EXAMPLE_CHILD, MY_CHILD_ROWS, type MyChildKey } from "../../data/myChildExample";
import { ExampleLabel } from "./MyChildSections";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * C: five tabs, one per part of the picture. The parent picks a part and sees what
 * PMS keeps there. Nothing animates beyond a colour change, so there is no motion
 * to reduce, and the tabs follow the standard tablist keyboard pattern.
 */
export function MyChildTabs() {
  const [active, setActive] = useState<MyChildKey>("profile");
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (to: number) => {
    const index = (to + MY_CHILD_ROWS.length) % MY_CHILD_ROWS.length;
    const row = MY_CHILD_ROWS[index];
    if (!row) return;
    setActive(row.key);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(MY_CHILD_ROWS.length - 1);
    }
  };

  const current = MY_CHILD_ROWS.find((row) => row.key === active) ?? MY_CHILD_ROWS[0];

  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="My Child" />
          <h2 className={`${SECTION_HEADING} mb-6`}>
            A picture of your child that builds over time
          </h2>
          <p className={SECTION_LEAD}>
            Five parts, kept together. Pick one to see what PMS remembers there.
          </p>
        </div>

        <div className="reveal-on-scroll border-hairline mt-12 overflow-hidden rounded-2xl border bg-white lg:mt-16">
          <div className="border-hairline flex items-center gap-3 border-b px-5 py-4 sm:px-6">
            <span
              aria-hidden
              className="bg-paper-deep text-ink font-editorial flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl font-light"
            >
              {EXAMPLE_CHILD.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
              <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
            </div>
            <ExampleLabel />
          </div>

          <div className="md:grid md:grid-cols-[14rem_1fr]">
            <div
              role="tablist"
              aria-label={`What PMS keeps about ${EXAMPLE_CHILD.name}`}
              aria-orientation="vertical"
              className="border-hairline flex overflow-x-auto border-b md:flex-col md:overflow-visible md:border-b-0 md:border-r"
            >
              {MY_CHILD_ROWS.map((row, index) => {
                const selected = row.key === active;
                return (
                  <button
                    key={row.key}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${row.key}`}
                    aria-selected={selected}
                    aria-controls={`${uid}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(row.key)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={cn(
                      "focus-visible:ring-ink shrink-0 whitespace-nowrap px-5 py-3.5 text-left text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset md:px-6",
                      selected
                        ? "bg-paper-deep text-ink border-b-power-orange-solid md:border-l-power-orange-solid border-b-2 font-semibold md:border-b-0 md:border-l-2"
                        : "text-ink-body hover:bg-paper hover:text-ink border-b-2 border-b-transparent md:border-b-0 md:border-l-2 md:border-l-transparent"
                    )}
                  >
                    {row.label}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id={`${uid}-panel`}
              aria-labelledby={`${uid}-tab-${active}`}
              tabIndex={0}
              className="focus-visible:ring-ink min-h-[15rem] px-5 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-8 sm:py-8"
            >
              <h3 className="font-editorial text-ink mb-5 text-3xl font-light">{current?.label}</h3>
              <ul>
                {current?.lines.map((line) => (
                  <li
                    key={line}
                    className="border-hairline text-ink border-t py-3.5 text-lg tabular-nums leading-snug first:border-t-0 first:pt-0"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
