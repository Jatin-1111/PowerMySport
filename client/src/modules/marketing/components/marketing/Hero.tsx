import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { Check } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import React from "react";
import { Bezel } from "./Bezel";
import { HomeEyebrow } from "./HomeEyebrow";
import { PillButton } from "./PillButton";

export interface HeroProps {
  title: string;
  /** Substring of `title` set in the brand colour */
  titleHighlight?: string;
  eyebrow?: string;
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
 * The homepage hero: massive grotesk headline on the left, one photograph in a
 * double bezel on the right with a small tilted note overlapping its corner.
 * The tilt and the overlap are dropped below `md` so nothing fights a thumb.
 */
export const Hero: React.FC<HeroProps> = ({
  title,
  titleHighlight,
  eyebrow,
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
    <section className="relative overflow-hidden bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-[640px] w-[640px] bg-[radial-gradient(closest-side,rgba(233,115,22,0.10),transparent)]"
      />

      <div className="relative mx-auto grid min-h-[min(100dvh,56rem)] max-w-7xl items-center gap-16 px-4 pb-24 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:px-8 lg:pb-32">
        <div className="flex flex-col items-start">
          {eyebrow && <HomeEyebrow label={eyebrow} tone="yellow" className="mb-8" />}

          <h1 className="font-title mb-8 text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-7xl">
            {before}
            {hlIndex >= 0 && <span className="text-power-orange-solid">{titleHighlight}</span>}
            {after}
          </h1>

          {description && (
            <p className="mb-10 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {description}
            </p>
          )}

          {ctaPrompt && <p className="mb-4 text-sm font-medium text-slate-900">{ctaPrompt}</p>}

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {primaryCTA && (
              <PillButton
                href={primaryCTA.href}
                variant={primaryIsWhatsApp ? "whatsapp" : "primary"}
                leading={
                  primaryIsWhatsApp ? <WhatsAppIcon className="h-[18px] w-[18px] shrink-0" /> : null
                }
              >
                {primaryCTA.label}
              </PillButton>
            )}
            {secondaryCTA && (
              <PillButton href={secondaryCTA.href} variant="light">
                {secondaryCTA.label}
              </PillButton>
            )}
          </div>

          {trustPoints && trustPoints.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-50 ring-1 ring-orange-200/60">
                    <Check weight="bold" aria-hidden className="text-power-orange-solid h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          )}

          {stats && stats.length > 0 && (
            <dl className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <Bezel key={stat.label} innerClassName="px-4 py-3">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                    {stat.value}
                  </dd>
                  {stat.helper && <p className="mt-0.5 text-xs text-slate-500">{stat.helper}</p>}
                </Bezel>
              ))}
            </dl>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <Bezel>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.375rem)]">
              <Image
                src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?fm=jpg&q=75&w=1400&auto=format&fit=crop"
                alt="Young footballer chasing the ball across a grass pitch"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover object-[62%_center] saturate-[0.75]"
              />
            </div>
          </Bezel>

          {ctaNote && (
            <div className="mt-4 md:absolute md:-bottom-8 md:-left-10 md:mt-0 md:max-w-[15rem] md:-rotate-2">
              <Bezel className="bg-white/70" innerClassName="px-5 py-4">
                <p className="text-power-orange-solid text-[10px] font-medium uppercase tracking-[0.2em]">
                  Reply time
                </p>
                <p className="mt-1.5 text-sm leading-snug text-slate-700">{ctaNote}</p>
              </Bezel>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
