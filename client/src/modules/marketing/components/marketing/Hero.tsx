import { Button } from "@/modules/shared/ui/Button";
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
          "relative py-20 sm:py-24 lg:py-32",
          gradient && "bg-gradient-to-br from-power-orange to-turf-green",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {subtitle && (
              <p className="text-sm sm:text-base font-semibold text-white/90 uppercase tracking-wide mb-4">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-lg sm:text-xl text-white/95 max-w-3xl mx-auto mb-10">
                {description}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {primaryCTA && (
                <Link href={primaryCTA.href}>
                  <Button variant="secondary" size="lg">
                    {primaryCTA.label}
                  </Button>
                </Link>
              )}
              {secondaryCTA && (
                <Link href={secondaryCTA.href}>
                  <Button variant="outline" size="lg">
                    {secondaryCTA.label}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Page variant - Compact hero for internal pages
  if (variant === "page") {
    return (
      <section className="bg-deep-slate py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {subtitle && (
              <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
                {subtitle}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              {title}
            </h1>
            {description && (
              <p className="text-lg text-white/90 max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Split variant - Text on left, image on right
  if (variant === "split") {
    return (
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div>
              {subtitle && (
                <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
                  {subtitle}
                </p>
              )}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-slate mb-6 leading-tight">
                {title}
              </h1>
              {description && (
                <p className="text-lg text-muted-foreground mb-8">
                  {description}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                {primaryCTA && (
                  <Link href={primaryCTA.href}>
                    <Button variant="primary" size="lg">
                      {primaryCTA.label}
                    </Button>
                  </Link>
                )}
                {secondaryCTA && (
                  <Link href={secondaryCTA.href}>
                    <Button variant="outline" size="lg">
                      {secondaryCTA.label}
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Image */}
            {imageSrc && (
              <div className="relative h-96 lg:h-[500px] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={imageSrc}
                  alt={imageAlt || title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
};


