import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { Button } from "@/modules/shared/ui/Button";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { SectionLabel } from "./SectionLabel";

export interface CTAProps {
  variant?: "default" | "gradient" | "image";
  title: string;
  description: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  backgroundImage?: string;
  label?: string;
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
//
// `.reveal-on-scroll` (globals.css) rather than a framer-motion `whileInView`
// stagger. This component closes six marketing pages, so its variants were
// leaving hidden `opacity: 0` copy at the bottom of all of them until the
// scroll observer fired. The CSS utility defaults to visible.

// ─── Decorative skew polygon ──────────────────────────────────────────────────

function SkewPolygon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 200"
      className={`pointer-events-none ${className ?? ""}`}
      aria-hidden
      preserveAspectRatio="none"
    >
      <polygon points="0,40 600,0 600,160 0,200" fill="rgba(233,115,22,0.06)" />
      <polygon points="0,60 600,20 600,180 0,220" fill="rgba(34,197,94,0.04)" />
    </svg>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
//
// The link IS the button (`asChild`): one element, one tab stop. Motion is the
// shared `btn-motion` from Button (colour on hover, a small press), not the
// lift-and-scale wrapper this used to sit in.

function CTAButton({
  href,
  children,
  variant,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "outline";
  className?: string;
}) {
  const isExternal = href.startsWith("http");
  const isWhatsApp = href.includes("wa.me");

  return (
    <Button
      asChild
      variant={isWhatsApp ? "primary" : variant}
      size="lg"
      className={`w-full sm:w-auto ${
        isWhatsApp
          ? "bg-[#25D366] hover:bg-[#1da851] focus-visible:ring-[#25D366]"
          : (className ?? "")
      }`}
    >
      <Link href={href} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {isWhatsApp && <WhatsAppIcon className="h-5 w-5 shrink-0" />}
        {children}
      </Link>
    </Button>
  );
}

// ─── DEFAULT VARIANT ──────────────────────────────────────────────────────────

function DefaultCTA({ title, description, primaryCTA, secondaryCTA, label }: CTAProps) {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="premium-shadow relative overflow-hidden rounded-xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
          <SkewPolygon className="absolute inset-0 h-full w-full" />
          <div className="reveal-on-scroll relative">
            {label && (
              <div className="mb-5 flex justify-center">
                <SectionLabel label={label} color="orange" />
              </div>
            )}
            <h2 className="font-title mb-5 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
              {description}
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <CTAButton href={primaryCTA.href} variant="primary">
                {primaryCTA.label}
              </CTAButton>
              {secondaryCTA && (
                <CTAButton href={secondaryCTA.href} variant="outline" className="bg-white">
                  {secondaryCTA.label}
                </CTAButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── GRADIENT VARIANT ─────────────────────────────────────────────────────────

function GradientCTA({ title, description, primaryCTA, secondaryCTA, label }: CTAProps) {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="premium-shadow relative overflow-hidden rounded-xl border border-white/60 shadow-xl">
          {/* Unsplash sports backdrop — very subtle */}
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80"
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1024px"
              className="object-cover"
              aria-hidden
            />
            {/* Multi-layer gradient mesh overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-sky-50/90 to-orange-50/90" />
            <div className="to-turf-green/8 absolute inset-0 bg-gradient-to-tr from-transparent via-transparent" />
          </div>

          {/* Decorative skew polygon */}
          <SkewPolygon className="absolute inset-0 h-full w-full" />

          <div className="reveal-on-scroll relative px-8 py-16 text-center sm:px-12 sm:py-20">
            {label && (
              <div className="mb-5 flex justify-center">
                <SectionLabel label={label} color="orange" />
              </div>
            )}
            <h2 className="font-title mb-5 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">
              {description}
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <CTAButton href={primaryCTA.href} variant="primary">
                {primaryCTA.label}
              </CTAButton>
              {secondaryCTA && (
                <CTAButton href={secondaryCTA.href} variant="outline" className="bg-white/90">
                  {secondaryCTA.label}
                </CTAButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── IMAGE VARIANT ────────────────────────────────────────────────────────────

function ImageCTA({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  backgroundImage,
  label,
}: CTAProps) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24 lg:py-28">
      {/* Background image */}
      {backgroundImage && (
        <div className="absolute inset-0">
          <Image src={backgroundImage} alt="" fill className="object-cover" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-900/50" />
        </div>
      )}
      <SkewPolygon className="absolute inset-0 h-full w-full opacity-30" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="reveal-on-scroll">
          {label && (
            <div className="mb-5 flex justify-center">
              <SectionLabel label={label} color="orange" />
            </div>
          )}
          <h2 className="font-title mb-5 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          <p className="mb-10 text-lg text-white/90 sm:text-xl">{description}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <CTAButton href={primaryCTA.href} variant="primary">
              {primaryCTA.label}
            </CTAButton>
            {secondaryCTA && (
              <CTAButton
                href={secondaryCTA.href}
                variant="outline"
                className="border-white/60 bg-white/10 text-white hover:bg-white/20"
              >
                {secondaryCTA.label}
              </CTAButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const CTA: React.FC<CTAProps> = (props) => {
  if (props.variant === "gradient") return <GradientCTA {...props} />;
  if (props.variant === "image") return <ImageCTA {...props} />;
  return <DefaultCTA {...props} />;
};
