import { buildWhatsAppUrl } from "@/lib/whatsapp";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { HeroChooserCard } from "./HeroChooserCard";
import { Headline, InlineNote, NOTE, SUBLINE, Talk, type HeroVariantProps } from "./HeroVariants";

/**
 * Third round, after the Intercom, Pinterest and Wise notes in awesome-design-md.
 * Intercom: the product is the picture. Pinterest: small tags laid on a photograph.
 * Wise: a bold headline beside a card you can use. Same words as before.
 */

const ALT =
  "A mother with her arm around her son, watching children play on a sports field at sunset";

/** H: the photograph with a chat card laid over its corner, showing what the first minutes of a conversation are like. */
export function HeroChatPreview({ ctaHref }: HeroVariantProps) {
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

          <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none lg:pb-16">
            <div className="bg-paper-deep relative aspect-[4/3] overflow-hidden rounded-2xl lg:ml-16 lg:aspect-[3/4]">
              <Image
                src="/images/hero-parent-child-portrait.jpg"
                alt={ALT}
                fill
                priority
                sizes="(min-width: 1024px) 400px, 90vw"
                className="object-cover"
              />
            </div>

            <div
              role="img"
              aria-label="An example WhatsApp conversation. A parent asks which sport is right for an 8-year-old. PowerMySport asks what the child enjoys and how many evenings a week they can give it."
              className="border-hairline bg-paper mt-4 rounded-2xl border p-4 shadow-[0_18px_36px_-24px_rgba(57,34,30,0.35)] lg:absolute lg:bottom-0 lg:left-0 lg:mt-0 lg:w-[19rem]"
            >
              <p className="text-ink-muted mb-3 text-xs font-medium">An example conversation</p>
              <div className="flex flex-col gap-2 text-sm leading-snug" aria-hidden>
                <p className="bg-ink ml-auto max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-white">
                  Which sport is right for my 8-year-old?
                </p>
                <p className="bg-paper-deep text-ink max-w-[92%] rounded-lg rounded-bl-sm px-3 py-2">
                  Happy to help. Two quick questions first: what does she enjoy, and how many
                  evenings a week can you give it?
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const TAGS = [
  { text: "Is my child ready to compete?", className: "left-3 top-4 sm:left-4 sm:top-5" },
  { text: "Which tournaments should we enter?", className: "right-3 top-16 sm:right-4 sm:top-20" },
];

/** I: the photograph carries two of the questions parents really ask, each one opening WhatsApp. */
export function HeroQuestionTags({ ctaHref }: HeroVariantProps) {
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
            <p className="text-ink-muted mt-4 text-sm">{NOTE}</p>
          </div>

          <div className="bg-paper-deep relative mx-auto aspect-[3/4] w-full max-w-[26rem] overflow-hidden rounded-2xl lg:max-w-none">
            <Image
              src="/images/hero-parent-child-portrait.jpg"
              alt={ALT}
              fill
              priority
              sizes="(min-width: 1024px) 448px, 90vw"
              className="object-cover"
            />
            {TAGS.map((tag) => (
              <Link
                key={tag.text}
                href={buildWhatsAppUrl(`Hi! ${tag.text}`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`bg-paper text-ink hover:bg-paper-deep focus-visible:ring-ink absolute rounded-md px-3 py-2 text-sm font-medium shadow-[0_8px_20px_-12px_rgba(57,34,30,0.4)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${tag.className}`}
              >
                {tag.text}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * K: three ideas in one. Nike's photograph running off the screen edge, Wise's card
 * you can use, Intercom's habit of showing what happens next (the note under the
 * headline). The card sits on the photograph at wide sizes and under the text on phones.
 */
export function HeroEdgeChooser() {
  return (
    <section className="bg-paper lg:grid lg:min-h-[38rem] lg:grid-cols-2">
      <div className="px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:flex lg:items-center lg:justify-end lg:py-20 lg:pl-8 lg:pr-16">
        <div className="mx-auto max-w-[34rem] lg:mx-0">
          <Headline />
          <p className="text-ink-body mt-6 text-pretty text-base leading-relaxed sm:text-lg">
            {SUBLINE}
          </p>
          <InlineNote />
          <div className="bg-paper-deep mt-8 overflow-hidden rounded-2xl lg:hidden">
            <HeroChooserCard />
          </div>
        </div>
      </div>

      <div className="bg-paper-deep relative order-first aspect-[4/5] sm:aspect-[3/2] lg:order-none lg:aspect-auto">
        <Image
          src="/images/hero-parent-child-portrait.jpg"
          alt={ALT}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-[50%_35%]"
        />
        <div className="bg-paper absolute bottom-8 left-8 hidden w-[22rem] overflow-hidden rounded-2xl shadow-[0_24px_48px_-24px_rgba(57,34,30,0.5)] lg:block">
          <HeroChooserCard />
        </div>
      </div>
    </section>
  );
}

/** J: a heavy headline beside one card you can use; the photograph is the card's header. */
export function HeroChooser() {
  return (
    <section className="bg-paper-deep">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-20">
          <div className="flex flex-col items-start">
            <Headline />
            <p className="text-ink-body mt-6 max-w-[48ch] text-pretty text-base leading-relaxed sm:text-lg">
              {SUBLINE}
            </p>
            <InlineNote />
          </div>

          <div className="bg-paper mx-auto w-full max-w-[26rem] overflow-hidden rounded-2xl lg:max-w-none">
            <div className="relative aspect-[16/9]">
              <Image
                src="/images/hero-parent-child-wide.jpg"
                alt={ALT}
                fill
                priority
                sizes="(min-width: 1024px) 432px, 90vw"
                className="object-cover object-[50%_35%]"
              />
            </div>
            <HeroChooserCard />
          </div>
        </div>
      </div>
    </section>
  );
}
