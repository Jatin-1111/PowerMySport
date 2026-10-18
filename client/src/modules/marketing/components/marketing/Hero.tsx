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
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,32rem)_minmax(0,28rem)] lg:items-center lg:justify-center lg:gap-16">
          {/* Heavy grotesk for the statement, an italic serif for the phrase that
              matters: the two voices are the point, so the serif is larger to
              match the grotesk's visual weight. */}
          <h1 className="font-title text-ink text-balance text-[2.1rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-[3.9rem]">
            {before}
            {hlIndex >= 0 && (
              <em className="font-editorial text-[1.22em] font-light italic tracking-[-0.02em]">
                {titleHighlight}
              </em>
            )}
            {after}
          </h1>

          <div className="flex flex-col items-start">
            {description && (
              <p className="text-ink-body mb-8 max-w-[44ch] text-pretty text-lg leading-relaxed">
                {description}
              </p>
            )}

            {ctaPrompt && <p className="text-ink mb-3 text-sm font-medium">{ctaPrompt}</p>}

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
                  className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-paper group inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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

        {/* The photograph: one wide plate. A child mid-save, anchored to the top so the whole figure stays in frame at every ratio. */}
        <div className="relative mt-14 lg:mt-20">
          <div className="bg-paper-deep relative aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-[3/2] lg:aspect-[16/10]">
            <Image
              src="https://images.unsplash.com/photo-1544333323-ec9ed3218dd1?fm=jpg&q=75&w=2400&auto=format&fit=crop"
              alt="A young goalkeeper diving to save a shot in front of the goal net"
              fill
              priority
              sizes="(min-width: 1280px) 1216px, 100vw"
              className="object-cover object-top saturate-[0.9]"
            />
          </div>

          {ctaNote && (
            <div className="border-hairline bg-paper mt-4 rounded-xl border px-5 py-4 sm:absolute sm:bottom-6 sm:left-6 sm:mt-0 sm:max-w-[17rem] sm:shadow-[0_12px_24px_-16px_rgba(57,34,30,0.28)] lg:bottom-8 lg:left-8">
              <p className="text-ink-muted text-sm font-medium">After you message us</p>
              <p className="text-ink mt-1 text-pretty text-sm leading-snug">{ctaNote}</p>
            </div>
          )}
        </div>

        {trustPoints && trustPoints.length > 0 && (
          <ul className="border-hairline text-ink-body mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t pt-6 text-sm">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check aria-hidden strokeWidth={1.75} className="text-ink h-4 w-4 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        )}

        {stats && stats.length > 0 && (
          <dl className="border-hairline bg-hairline mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-paper px-5 py-4">
                <dt className="text-ink-muted text-sm">{stat.label}</dt>
                <dd className="font-editorial text-ink mt-1 text-2xl font-light">{stat.value}</dd>
                {stat.helper && <p className="text-ink-muted mt-0.5 text-xs">{stat.helper}</p>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};
