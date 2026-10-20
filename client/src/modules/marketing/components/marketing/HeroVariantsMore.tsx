import Image from "next/image";
import React from "react";
import { HeroAskField } from "./HeroAskField";
import { Headline, InlineNote, NOTE, SUBLINE, Talk, type HeroVariantProps } from "./HeroVariants";

/**
 * Second round of hero experiments, after reading the Oura, Nike and Airbnb
 * notes in awesome-design-md. Same words as the first round. What is borrowed:
 * Oura's oversized light serif and square photograph, Nike's photograph that
 * runs to the edge of the screen, Airbnb's single field as the way in.
 */

const ALT =
  "A mother with her arm around her son, watching children play on a sports field at sunset";

/** E: the headline is the whole top of the page, set large in the light serif, with a square-cornered photograph under it. */
export function HeroSerifStatement({ ctaHref }: HeroVariantProps) {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <h1 className="font-editorial text-ink max-w-5xl text-balance text-[2.9rem] font-light leading-[1.02] tracking-[-0.03em] sm:text-7xl lg:text-[6.25rem]">
          Helping parents make confident <em className="italic">sports decisions</em>
        </h1>

        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,34rem)_auto] lg:items-end lg:justify-between">
          <p className="text-ink-body text-pretty text-base leading-relaxed sm:text-lg">
            {SUBLINE}
          </p>
          <div className="flex flex-col items-start lg:items-end">
            <Talk href={ctaHref} />
            <p className="text-ink-muted mt-3 text-sm lg:text-right">{NOTE}</p>
          </div>
        </div>

        <div className="bg-paper-deep relative mt-12 aspect-[3/2] overflow-hidden lg:mt-16">
          <Image
            src="/images/hero-parent-child-wide.jpg"
            alt={ALT}
            fill
            priority
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/** F: text on the left, the photograph runs off the right edge of the screen at full height, square cornered. */
export function HeroEdgePhoto({ ctaHref }: HeroVariantProps) {
  return (
    <section className="bg-paper lg:grid lg:min-h-[36rem] lg:grid-cols-2">
      <div className="px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:flex lg:items-center lg:justify-end lg:py-20 lg:pl-8 lg:pr-16">
        <div className="mx-auto max-w-[34rem] lg:mx-0">
          <Headline />
          <p className="text-ink-body mt-6 text-pretty text-base leading-relaxed sm:text-lg">
            {SUBLINE}
          </p>
          <div className="mt-8 w-full sm:w-auto">
            <Talk href={ctaHref} />
          </div>
          <InlineNote />
        </div>
      </div>

      <div className="bg-paper-deep relative order-first aspect-[4/5] sm:aspect-[3/2] lg:order-none lg:aspect-auto">
        <Image
          src="/images/hero-parent-child-portrait.jpg"
          alt={ALT}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-[50%_40%]"
        />
      </div>
    </section>
  );
}

/** G: centred and quiet; one field is the way in, and what is typed becomes the first WhatsApp message. */
export function HeroAskFirst() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Headline />
          <p className="text-ink-body mt-6 max-w-[52ch] text-pretty text-base leading-relaxed sm:text-lg">
            {SUBLINE}
          </p>
          <div className="mt-9 w-full max-w-2xl">
            <HeroAskField />
          </div>
          <p className="text-ink-muted mt-4 text-sm">{NOTE}</p>
        </div>

        <div className="bg-paper-deep relative mx-auto mt-12 aspect-[3/2] max-w-4xl overflow-hidden rounded-2xl lg:mt-16">
          <Image
            src="/images/hero-parent-child-wide.jpg"
            alt={ALT}
            fill
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
