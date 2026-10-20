import { cn } from "@/utils/cn";
import React from "react";
import { HOW_STEPS } from "../../data/howItWorksSteps";
import { Specimen } from "./HowItWorksVariants";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * More "How it works" options, after reading the Uber, Clay, Cal, Framer and Nike notes
 * in awesome-design-md. Same five steps and the same words as the others.
 *
 *  H  Bands (Uber): each step is a full-width band, alternating light and light-deep,
 *     with the step where the advice arrives flipped to ink.
 *  I  Colour-blocked cards (Clay) that each hold a real fragment of what the parent
 *     sees (Cal's "look at the actual product"), in a tonal palette from the site.
 *  J  Giant numerals (Nike, Framer): one oversized serif row, no rules and no cards.
 */

function Header({ className }: { className?: string }) {
  return (
    <div className={cn("reveal-on-scroll max-w-3xl", className)}>
      <SectionKicker label="How it works" />
      <h2 className={SECTION_HEADING}>From questions to action</h2>
    </div>
  );
}

// ─── H: bands ───────────────────────────────────────────────────────────────

/** The step where the advice arrives is the one that flips. */
const FLIPPED = 2;

export function HowBands() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8 lg:pt-28">
        <Header />
      </div>

      <ol>
        {HOW_STEPS.map((step, index) => {
          const flipped = index === FLIPPED;
          return (
            <li
              key={step.title}
              className={cn(
                "reveal-on-scroll py-10 sm:py-12 lg:py-14",
                flipped ? "bg-ink" : index % 2 === 0 ? "bg-paper" : "bg-paper-deep"
              )}
            >
              <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12 lg:px-8">
                <span
                  className={cn(
                    "font-editorial text-6xl font-light tabular-nums leading-none",
                    flipped ? "text-white" : "text-ink"
                  )}
                >
                  {index + 1}
                </span>
                <div>
                  <h3
                    className={cn(
                      "mb-2 text-xl font-semibold",
                      flipped ? "text-white" : "text-ink"
                    )}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={cn(
                      "max-w-[40ch] text-pretty text-lg leading-relaxed",
                      flipped ? "text-white/80" : "text-ink-body"
                    )}
                  >
                    {step.body}
                  </p>
                </div>
                <ul
                  className={cn(
                    "border-t text-base leading-snug",
                    flipped ? "border-white/20 text-white" : "border-ink/15 text-ink"
                  )}
                >
                  {step.items.map((item) => (
                    <li
                      key={typeof item === "string" ? item : item.label}
                      className={cn("border-b py-3", flipped ? "border-white/20" : "border-ink/15")}
                    >
                      {typeof item === "string" ? item : item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── I: colour-blocked cards that hold what the parent sees ─────────────────

/** Tonal fills from the site's own palette, never the same one twice in a row. */
const BLOCK_TONE = ["bg-white", "bg-wash", "bg-paper-deep", "bg-ink", "bg-white"] as const;
const BLOCK_SPAN = [
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-3",
  "lg:col-span-3",
] as const;

export function HowColourBlocks() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-6">
          {HOW_STEPS.map((step, index) => {
            const dark = BLOCK_TONE[index] === "bg-ink";
            return (
              <li
                key={step.title}
                className={cn(
                  "reveal-on-scroll border-hairline flex flex-col rounded-3xl border p-6 sm:p-8",
                  BLOCK_TONE[index],
                  BLOCK_SPAN[index],
                  dark && "border-ink"
                )}
              >
                <span
                  className={cn(
                    "font-editorial mb-6 block text-5xl font-light tabular-nums leading-none",
                    dark ? "text-white" : "text-ink"
                  )}
                >
                  {index + 1}
                </span>
                <h3 className={cn("mb-2 text-xl font-semibold", dark ? "text-white" : "text-ink")}>
                  {step.title}
                </h3>
                <p
                  className={cn(
                    "mb-6 max-w-[40ch] text-pretty leading-relaxed",
                    dark ? "text-white/80" : "text-ink-body"
                  )}
                >
                  {step.body}
                </p>
                {/* The fragment stays white so it reads as the product, on any card colour. */}
                <div className="mt-auto">
                  <Specimen index={index} step={step} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ─── J: giant numerals ──────────────────────────────────────────────────────

export function HowGiantNumerals() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:mt-20 lg:grid-cols-5">
          {HOW_STEPS.map((step, index) => (
            <li key={step.title} className="reveal-on-scroll">
              <span
                aria-hidden
                className="font-editorial text-ink block text-[7rem] font-light tabular-nums leading-[0.85] tracking-[-0.04em] sm:text-[8rem] xl:text-[9rem]"
              >
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 mt-6 text-lg font-semibold">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="text-ink-body max-w-[30ch] text-pretty leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── K: the recommended mix ─────────────────────────────────────────────────

/**
 * Cards from I, the big numerals from J and the ink card from H, on the step where the
 * advice arrives. Every step shows a small example of what the parent sees, so nobody has
 * to imagine it. On a phone it is one plain column, read top to bottom.
 */
const MIX_TONE = ["bg-white", "bg-wash", "bg-ink", "bg-paper-deep", "bg-white"] as const;

export function HowCombined() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-6">
          {HOW_STEPS.map((step, index) => {
            const dark = MIX_TONE[index] === "bg-ink";
            return (
              <li
                key={step.title}
                className={cn(
                  "reveal-on-scroll border-hairline flex flex-col rounded-3xl border p-6 sm:p-8",
                  MIX_TONE[index],
                  BLOCK_SPAN[index],
                  dark && "border-ink"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "font-editorial mb-5 block text-7xl font-light tabular-nums leading-[0.85] tracking-[-0.03em] sm:text-8xl",
                    dark ? "text-white" : "text-ink"
                  )}
                >
                  {index + 1}
                </span>
                <h3 className={cn("mb-2 text-xl font-semibold", dark ? "text-white" : "text-ink")}>
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p
                  className={cn(
                    "mb-6 max-w-[40ch] text-pretty leading-relaxed",
                    dark ? "text-white/80" : "text-ink-body"
                  )}
                >
                  {step.body}
                </p>
                <div className="mt-auto">
                  <Specimen index={index} step={step} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
