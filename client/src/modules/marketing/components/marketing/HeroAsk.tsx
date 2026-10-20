import Image from "next/image";
import React from "react";
import { HeroAskField } from "./HeroAskField";

export interface HeroAskProps {
  /** A greeting for a signed-in parent, shown above the field. */
  greeting?: string;
}

/**
 * The homepage hero for visitors and parents with no child profile yet. Centred
 * and quiet: the headline, one field, and one action. What a parent types
 * becomes the first WhatsApp message, and the note says what happens after.
 * The photograph sits below as a single plate.
 */
export const HeroAsk: React.FC<HeroAskProps> = ({ greeting }) => (
  <section className="bg-paper">
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        {/* Heavy grotesk for the statement, an italic serif for the phrase that
            matters: the serif is larger to match the grotesk's visual weight. */}
        <h1 className="font-title text-ink text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] max-[374px]:text-[2.2rem] sm:text-5xl lg:text-[3.9rem]">
          Helping Parents Make Confident{" "}
          <em className="font-editorial text-[1.22em] font-light italic tracking-[-0.02em]">
            Sports Decisions
          </em>
        </h1>
        <p className="text-ink-body mt-6 max-w-[52ch] text-pretty text-base leading-relaxed sm:text-lg">
          From discovering the right sport to navigating competition and future pathways, PMS helps
          you understand your child&apos;s options, decide what to do next, and take action.
        </p>

        {greeting && <p className="text-ink-muted mt-8 text-sm font-medium">{greeting}</p>}
        <div className={`w-full max-w-2xl ${greeting ? "mt-3" : "mt-9"}`}>
          <HeroAskField />
        </div>
        <p className="text-ink-muted mt-4 text-sm">
          After you message us, a PowerMySport team member replies within 24 hours.
        </p>
      </div>

      <div className="bg-paper-deep relative mx-auto mt-12 aspect-[3/2] max-w-4xl overflow-hidden rounded-2xl lg:mt-16">
        <Image
          src="/images/hero-parent-child-wide.jpg"
          alt="A mother with her arm around her son, watching children play on a sports field at sunset"
          fill
          priority
          sizes="(min-width: 896px) 896px, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  </section>
);
