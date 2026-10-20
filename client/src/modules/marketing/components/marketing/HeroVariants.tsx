import { Button } from "@/modules/shared/ui/Button";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import Image from "next/image";
import Link from "next/link";
import React from "react";

/**
 * Hero experiments for the review of 20 Oct 2026. Every variant uses the same
 * words, taken from the review: one action (Talk to PMS), the reply-time note,
 * no trust ticks, no kicker above the headline. They differ only in how the
 * photograph and the text share the screen.
 */

export interface HeroVariantProps {
  ctaHref: string;
}

export const SUBLINE =
  "From discovering the right sport to navigating competition and future pathways, PMS helps you understand your child's options, decide what to do next, and take action.";
export const NOTE = "A PowerMySport team member replies within 24 hours.";

const H1 =
  "font-title text-ink text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] max-[374px]:text-[2.2rem] sm:text-5xl lg:text-[3.9rem]";
const H1_EM = "font-editorial text-[1.22em] font-light italic tracking-[-0.02em]";

export function Headline() {
  return (
    <h1 className={H1}>
      Helping Parents Make Confident <em className={H1_EM}>Sports Decisions</em>
    </h1>
  );
}

export function Talk({ href }: { href: string }) {
  return (
    <Button
      asChild
      variant="primary"
      size="lg"
      className="h-auto w-full px-7 py-3.5 text-base sm:w-auto"
    >
      <Link href={href} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className="h-5 w-5 shrink-0" />
        Talk to PMS
      </Link>
    </Button>
  );
}

/** The reply-time note as a quiet rule-and-text block, for layouts with no photo corner to sit on. */
export function InlineNote() {
  return (
    <div className="border-ink/20 mt-7 max-w-[34ch] border-l-2 pl-4">
      <p className="text-ink-muted text-sm font-medium">After you message us</p>
      <p className="text-ink mt-0.5 text-pretty text-sm leading-snug">{NOTE}</p>
    </div>
  );
}

/** The same note as a card that overlaps the photograph's corner. */
function CornerNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`border-hairline bg-paper rounded-xl border px-5 py-4 shadow-[0_12px_24px_-16px_rgba(57,34,30,0.28)] ${className}`}
    >
      <p className="text-ink-muted text-sm font-medium">After you message us</p>
      <p className="text-ink mt-1 text-pretty text-sm leading-snug">{NOTE}</p>
    </div>
  );
}

/** A: headline and action on the left, the photograph cut to a circle on the right, as in the review. */
export function HeroCircleSplit({ ctaHref }: HeroVariantProps) {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-20">
          <div className="flex flex-col items-start">
            <Headline />
            <p className="text-ink-body mt-6 max-w-[48ch] text-pretty text-base leading-relaxed sm:text-lg">
              {SUBLINE}
            </p>
            <div className="mt-8 w-full sm:w-auto">
              <Talk href={ctaHref} />
            </div>
            <InlineNote />
          </div>

          <div className="mx-auto w-full max-w-[26rem] lg:max-w-none">
            <Image
              src="/images/hero-parent-child-circle.webp"
              alt="A mother with her arm around her son, watching children play on a sports field at sunset"
              width={1254}
              height={1254}
              priority
              sizes="(min-width: 1024px) 512px, 90vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** B: the same split, but the photograph is a tall rounded plate with the note on its corner, like the rest of the site. */
export function HeroPlateSplit({ ctaHref }: HeroVariantProps) {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-20">
          <div className="flex flex-col items-start">
            <Headline />
            <p className="text-ink-body mt-6 max-w-[48ch] text-pretty text-base leading-relaxed sm:text-lg">
              {SUBLINE}
            </p>
            <div className="mt-8 w-full sm:w-auto">
              <Talk href={ctaHref} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none">
            <div className="bg-paper-deep relative aspect-[3/4] overflow-hidden rounded-2xl">
              <Image
                src="/images/hero-parent-child-portrait.jpg"
                alt="A mother with her arm around her son, watching children play on a sports field at sunset"
                fill
                priority
                sizes="(min-width: 1024px) 448px, 90vw"
                className="object-cover"
              />
            </div>
            <CornerNote className="mt-4 sm:absolute sm:-bottom-6 sm:-left-8 sm:mt-0 sm:max-w-[17rem]" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** C: text first, then one wide plate of the same photograph below it. */
export function HeroWidePlate({ ctaHref }: HeroVariantProps) {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,32rem)_minmax(0,28rem)] lg:items-end lg:justify-center lg:gap-16">
          <Headline />
          <div className="flex flex-col items-start">
            <p className="text-ink-body mb-7 max-w-[44ch] text-pretty text-base leading-relaxed sm:mb-8 sm:text-lg">
              {SUBLINE}
            </p>
            <Talk href={ctaHref} />
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-4xl lg:mt-16">
          <div className="bg-paper-deep relative aspect-[3/2] overflow-hidden rounded-2xl">
            <Image
              src="/images/hero-parent-child-wide.jpg"
              alt="A mother with her arm around her son, watching children play on a sports field at sunset"
              fill
              priority
              sizes="(min-width: 896px) 896px, 100vw"
              className="object-cover"
            />
          </div>
          <CornerNote className="mt-4 sm:absolute sm:-bottom-6 sm:left-6 sm:mt-0 sm:max-w-[17rem]" />
        </div>
      </div>
    </section>
  );
}
