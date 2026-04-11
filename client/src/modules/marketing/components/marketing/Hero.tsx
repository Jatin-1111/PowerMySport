import { Button } from "@/modules/shared/ui/Button";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { cn } from "@/utils/cn";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export interface HeroProps {
  variant?: "home" | "page" | "split";
  title: string;
  subtitle?: string;
  description?: string;
  primaryCTA?: {
    label: string;
    href: string;
  };
  secondaryCTA?: {
    label: string;
    href: string;
  };
  imageSrc?: string;
  imageAlt?: string;
  gradient?: boolean;
}

/**
 * Hero Section Component
 * Supports three variants: home (large with gradient), page (compact), split (text + image)
 */
export const Hero: React.FC<HeroProps> = ({
  variant = "home",
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  imageSrc,
  imageAlt,
  gradient = true,
}) => {
  // Home variant - Large hero with gradient background
  if (variant === "home") {
    return (
      <section
        className={cn(
          "relative overflow-hidden py-20 sm:py-24 lg:py-32",
          gradient &&
            "bg-[linear-gradient(120deg,#f8fbff_0%,#e5f1ff_38%,#fff4e2_100%)]",
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="text-center">
            {subtitle && (
              <StaggerItem>
                <p className="mb-6 inline-block rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 backdrop-blur-sm sm:text-base">
                  {subtitle}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <h1 className="font-title mb-6 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl lg:text-7xl">
                {title}
              </h1>
            </StaggerItem>
            {description && (
              <StaggerItem>
                <p className="mx-auto mb-10 max-w-3xl text-base leading-7 text-slate-700 sm:text-xl sm:leading-8">
                  {description}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <div className="flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center">
                {primaryCTA && (
                  <Link href={primaryCTA.href} className="w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="lg"
                      className="h-auto rounded-xl px-8 py-6 text-lg premium-shadow"
                    >
                      {primaryCTA.label}
                    </Button>
                  </Link>
                )}
                {secondaryCTA && (
                  <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-auto rounded-xl border-slate-300 bg-white/90 px-8 py-6 text-lg text-slate-900 premium-shadow hover:bg-white"
                    >
                      {secondaryCTA.label}
                    </Button>
                  </Link>
                )}
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>
    );
  }

  // Page variant - Compact hero for internal pages
  if (variant === "page") {
    return (
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="text-center">
            {subtitle && (
              <StaggerItem>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {subtitle}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <h1 className="font-title mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900">
                {title}
              </h1>
            </StaggerItem>
            {description && (
              <StaggerItem>
                <p className="mx-auto max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
                  {description}
                </p>
              </StaggerItem>
            )}
          </StaggerContainer>
        </div>
      </section>
    );
  }

  // Split variant - Text on left, image on right
  if (variant === "split") {
    return (
      <section className="py-16 sm:py-20 lg:py-24 bg-ghost-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <StaggerContainer>
              {subtitle && (
                <StaggerItem>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {subtitle}
                  </p>
                </StaggerItem>
              )}
              <StaggerItem>
                <h1 className="font-title text-4xl sm:text-5xl lg:text-6xl font-extrabold text-deep-slate mb-6 leading-tight">
                  {title}
                </h1>
              </StaggerItem>
              {description && (
                <StaggerItem>
                  <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
                    {description}
                  </p>
                </StaggerItem>
              )}
              <StaggerItem>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
                  {primaryCTA && (
                    <Link href={primaryCTA.href} className="w-full sm:w-auto">
                      <Button
                        variant="primary"
                        size="lg"
                        className="premium-shadow"
                      >
                        {primaryCTA.label}
                      </Button>
                    </Link>
                  )}
                  {secondaryCTA && (
                    <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="lg"
                        className="premium-shadow"
                      >
                        {secondaryCTA.label}
                      </Button>
                    </Link>
                  )}
                </div>
              </StaggerItem>
            </StaggerContainer>

            {/* Image */}
            {imageSrc && (
              <FadeIn delay={0.2} duration={0.8}>
                <div className="relative h-96 overflow-hidden rounded-2xl premium-shadow lg:h-128">
                  <Image
                    src={imageSrc}
                    alt={imageAlt || title}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl"></div>
                </div>
              </FadeIn>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
};
