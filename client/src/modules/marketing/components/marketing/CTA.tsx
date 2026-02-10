import { Button } from "@/modules/shared/ui/Button";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export interface CTAProps {
  variant?: "default" | "gradient" | "image";
  title: string;
  description: string;
  primaryCTA: {
    label: string;
    href: string;
  };
  secondaryCTA?: {
    label: string;
    href: string;
  };
  backgroundImage?: string;
}

/**
 * Call-to-Action Section Component
 * Designed to drive conversions with strong visual appeal
 */
export const CTA: React.FC<CTAProps> = ({
  variant = "default",
  title,
  description,
  primaryCTA,
  secondaryCTA,
  backgroundImage,
}) => {
  // Default variant - Solid background
  if (variant === "default") {
    return (
      <section className="py-16 sm:py-20 lg:py-24 bg-deep-slate">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {title}
          </h2>
          <p className="text-lg sm:text-xl text-white/90 mb-10">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={primaryCTA.href}>
              <Button variant="primary" size="lg">
                {primaryCTA.label}
              </Button>
            </Link>
            {secondaryCTA && (
              <Link href={secondaryCTA.href}>
                <Button variant="outline" size="lg">
                  {secondaryCTA.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Gradient variant - Eye-catching gradient background
  if (variant === "gradient") {
    return (
      <section className="py-16 sm:py-20 lg:py-24 bg-linear-to-r from-power-orange to-turf-green">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {title}
          </h2>
          <p className="text-lg sm:text-xl text-white/95 mb-10">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={primaryCTA.href}>
              <Button variant="secondary" size="lg">
                {primaryCTA.label}
              </Button>
            </Link>
            {secondaryCTA && (
              <Link href={secondaryCTA.href}>
                <Button variant="outline" size="lg">
                  {secondaryCTA.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Image variant - Background image with overlay
  if (variant === "image") {
    return (
      <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
        {/* Background Image */}
        {backgroundImage && (
          <div className="absolute inset-0">
            <Image src={backgroundImage} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-deep-slate/80" />
          </div>
        )}

        {/* Content */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            {title}
          </h2>
          <p className="text-lg sm:text-xl text-white/95 mb-10">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={primaryCTA.href}>
              <Button variant="primary" size="lg">
                {primaryCTA.label}
              </Button>
            </Link>
            {secondaryCTA && (
              <Link href={secondaryCTA.href}>
                <Button variant="outline" size="lg">
                  {secondaryCTA.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
};


