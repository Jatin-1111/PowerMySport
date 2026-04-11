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
          "relative py-20 sm:py-24 lg:py-32 overflow-hidden",
          gradient && "bg-linear-to-br from-power-orange to-turf-green",
        )}
      >
        <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl mix-blend-overlay"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="text-center">
            {subtitle && (
              <StaggerItem>
                <p className="inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm sm:text-base font-semibold text-white uppercase tracking-wide mb-6 premium-shadow">
                  {subtitle}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white mb-6 leading-tight drop-shadow-md">
                {title}
              </h1>
            </StaggerItem>
            {description && (
              <StaggerItem>
                <p className="text-lg sm:text-2xl text-white/95 max-w-3xl mx-auto mb-10 drop-shadow-sm font-light">
                  {description}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <div className="flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center">
                {primaryCTA && (
                  <Link href={primaryCTA.href} className="w-full sm:w-auto">
                    <Button variant="secondary" size="lg" className="premium-shadow text-lg px-8 py-6 h-auto">
                      {primaryCTA.label}
                    </Button>
                  </Link>
                )}
                {secondaryCTA && (
                  <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 hover:text-white premium-shadow text-lg px-8 py-6 h-auto">
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
      <section className="bg-deep-slate py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-tr from-power-orange/10 to-turf-green/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <StaggerContainer className="text-center">
            {subtitle && (
              <StaggerItem>
                <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
                  {subtitle}
                </p>
              </StaggerItem>
            )}
            <StaggerItem>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                {title}
              </h1>
            </StaggerItem>
            {description && (
              <StaggerItem>
                <p className="text-lg text-white/90 max-w-2xl mx-auto">
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
                  <p className="text-sm font-bold text-power-orange uppercase tracking-wide mb-3">
                    {subtitle}
                  </p>
                </StaggerItem>
              )}
              <StaggerItem>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-deep-slate mb-6 leading-tight">
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
                      <Button variant="primary" size="lg" className="premium-shadow">
                        {primaryCTA.label}
                      </Button>
                    </Link>
                  )}
                  {secondaryCTA && (
                    <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="premium-shadow">
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
                <div className="relative h-96 overflow-hidden rounded-2xl premium-shadow lg:h-[32rem]">
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
