import { Button } from "@/modules/shared/ui/Button";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export interface HeroProps {
  title: string;
  /** Substring of `title` set in italics */
  titleHighlight?: string;
  description?: string;
  /** Short line shown above the CTA row, e.g. a greeting for a signed-in parent */
  ctaPrompt?: string;
  primaryCTA?: { label: string; href: string };
  /** One line saying what happens after the click */
  ctaNote?: string;
  /** Short reassurances under the CTAs, e.g. "No account needed" */
  trustPoints?: string[];
  secondaryCTA?: { label: string; href: string };
  stats?: Array<{ label: string; value: string; helper?: string }>;
}

/**
 * Warm-paper hero. The headline carries the page in a light serif on cream;
 * the photograph sits below it as one wide, rounded plate instead of behind
 * the text, so type never depends on a scrim. A single orange action, one text
 * link beside it, and the reply-time note is a quiet card on the photo's edge.
 */
export const Hero: React.FC<HeroProps> = ({
  title,
  titleHighlight,
  description,
  ctaPrompt,
  primaryCTA,
  secondaryCTA,
  ctaNote,
  trustPoints,
  stats,
}) => {
  const primaryIsWhatsApp = Boolean(primaryCTA?.href.includes("wa.me"));
  const hlIndex = titleHighlight ? title.indexOf(titleHighlight) : -1;
  const before = hlIndex >= 0 ? title.slice(0, hlIndex) : title;
  const after = hlIndex >= 0 && titleHighlight ? title.slice(hlIndex + titleHighlight.length) : "";

  return (
    <section className="bg-[#F8F3EA]">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16">
          <h1 className="font-editorial text-balance text-[2.6rem] font-light leading-[1.04] text-[#1C1B1A] sm:text-6xl lg:text-[5.25rem]">
            {before}
            {hlIndex >= 0 && <em className="font-light italic">{titleHighlight}</em>}
            {after}
          </h1>

          <div className="flex flex-col items-start lg:pb-3">
            {description && (
              <p className="mb-8 max-w-[44ch] text-pretty text-lg leading-relaxed text-[#4A4741]">
                {description}
              </p>
            )}

            {ctaPrompt && <p className="mb-3 text-sm font-medium text-[#1C1B1A]">{ctaPrompt}</p>}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              {primaryCTA && (
                <Button
                  asChild
                  variant="primary"
                  size="lg"
                  className="h-auto px-7 py-3.5 text-base"
                >
                  <Link
                    href={primaryCTA.href}
                    {...(primaryIsWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {primaryIsWhatsApp && <WhatsAppIcon className="h-5 w-5 shrink-0" />}
                    {primaryCTA.label}
                  </Link>
                </Button>
              )}
              {secondaryCTA && (
                <Link
                  href={secondaryCTA.href}
                  className="group inline-flex items-center gap-1.5 rounded text-base font-medium text-[#1C1B1A] underline decoration-[#1C1B1A]/30 underline-offset-[6px] transition-colors duration-200 hover:decoration-[#1C1B1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C1B1A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F3EA]"
                >
                  {secondaryCTA.label}
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.5}
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* The photograph: one wide plate, desaturated and warmed to sit on the paper. */}
        <div className="relative mt-14 lg:mt-20">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#EFE7DA] sm:aspect-[16/8] lg:aspect-[16/6.5]">
            <Image
              src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?fm=jpg&q=75&w=2400&auto=format&fit=crop"
              alt="Young footballer chasing the ball across a grass pitch"
              fill
              priority
              sizes="(min-width: 1280px) 1216px, 100vw"
              className="object-cover object-[88%_top] saturate-[0.7] sepia-[0.12] sm:object-top"
            />
          </div>

          {ctaNote && (
            <div className="mt-4 rounded-xl border border-[#E1DCD3] bg-[#F8F3EA] px-5 py-4 sm:absolute sm:bottom-6 sm:left-6 sm:mt-0 sm:max-w-[17rem] sm:shadow-[0_12px_24px_-16px_rgba(57,34,30,0.28)] lg:bottom-8 lg:left-8">
              <p className="text-sm font-medium text-[#7A766E]">After you message us</p>
              <p className="mt-1 text-pretty text-sm leading-snug text-[#1C1B1A]">{ctaNote}</p>
            </div>
          )}
        </div>

        {trustPoints && trustPoints.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#E1DCD3] pt-6 text-sm text-[#4A4741]">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0 text-[#1C1B1A]" />
                {point}
              </li>
            ))}
          </ul>
        )}

        {stats && stats.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#E1DCD3] bg-[#E1DCD3] sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#F8F3EA] px-5 py-4">
                <dt className="text-sm text-[#7A766E]">{stat.label}</dt>
                <dd className="font-editorial mt-1 text-2xl font-light text-[#1C1B1A]">
                  {stat.value}
                </dd>
                {stat.helper && <p className="mt-0.5 text-xs text-[#7A766E]">{stat.helper}</p>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};
