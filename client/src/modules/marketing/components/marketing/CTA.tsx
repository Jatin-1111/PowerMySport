import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { Button } from "@/modules/shared/ui/Button";
import Link from "next/link";
import React from "react";
import { SectionLabel } from "./SectionLabel";

export interface CTAProps {
  title: string;
  description: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  label?: string;
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
//
// `.reveal-on-scroll` (globals.css) rather than a framer-motion `whileInView`
// stagger. This component closes six marketing pages, so its variants were
// leaving hidden `opacity: 0` copy at the bottom of all of them until the
// scroll observer fired. The CSS utility defaults to visible.

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
        // Not WhatsApp's own #25D366: white text on it measures 2:1.
        isWhatsApp
          ? "bg-green-700 hover:bg-green-800 focus-visible:ring-green-700"
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

// ─── The CTA band ─────────────────────────────────────────────────────────────
//
// One quiet panel that closes the marketing pages. There used to be three
// variants: this one, a "gradient" one that laid a washed-out stock photo,
// a two-colour mesh and slanted polygons behind the same content, and an
// unused "image" one. With the decoration gone they were the same panel.

export const CTA: React.FC<CTAProps> = ({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  label,
}) => {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-14">
          <div className="reveal-on-scroll">
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
};
