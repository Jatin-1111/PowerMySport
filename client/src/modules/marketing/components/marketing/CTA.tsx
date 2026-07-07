"use client";

import { Button } from "@/modules/shared/ui/Button";
import { motion, Variants } from "framer-motion";
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

// ─── Motion variants ──────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 270, damping: 22 },
  },
};

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

// ─── Button wrapper with spring hover ─────────────────────────────────────────

function AnimatedCTAButton({
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
  return (
    <Link href={href} className="w-full sm:w-auto">
      <motion.div
        whileHover={{ y: -3, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="will-change-transform"
      >
        <Button
          variant={variant}
          size="lg"
          className={`w-full rounded-xl ${className ?? ""}`}
        >
          {children}
        </Button>
      </motion.div>
    </Link>
  );
}

// ─── DEFAULT VARIANT ──────────────────────────────────────────────────────────

function DefaultCTA({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  label,
}: CTAProps) {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 px-8 py-14 text-center shadow-sm backdrop-blur-md premium-shadow">
          <SkewPolygon className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-200/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl" />
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="relative"
          >
            {label && (
              <motion.div
                variants={itemVariants}
                className="mb-5 flex justify-center"
              >
                <SectionLabel label={label} color="orange" />
              </motion.div>
            )}
            <motion.h2
              variants={itemVariants}
              className="font-title mb-5 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              {title}
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg"
            >
              {description}
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4"
            >
              <AnimatedCTAButton href={primaryCTA.href} variant="primary">
                {primaryCTA.label}
              </AnimatedCTAButton>
              {secondaryCTA && (
                <AnimatedCTAButton
                  href={secondaryCTA.href}
                  variant="outline"
                  className="bg-white"
                >
                  {secondaryCTA.label}
                </AnimatedCTAButton>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── GRADIENT VARIANT ─────────────────────────────────────────────────────────

function GradientCTA({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  label,
}: CTAProps) {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/60 shadow-xl premium-shadow">
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
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-turf-green/8" />
          </div>

          {/* Decorative skew polygon */}
          <SkewPolygon className="absolute inset-0 h-full w-full" />

          {/* Ambient blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-200/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="relative px-8 py-16 text-center sm:px-12 sm:py-20"
          >
            {label && (
              <motion.div
                variants={itemVariants}
                className="mb-5 flex justify-center"
              >
                <SectionLabel label={label} color="orange" />
              </motion.div>
            )}
            <motion.h2
              variants={itemVariants}
              className="font-title mb-5 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              {title}
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg"
            >
              {description}
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4"
            >
              <AnimatedCTAButton
                href={primaryCTA.href}
                variant="primary"
                className="shadow-[0_8px_32px_-8px_rgba(233,115,22,0.5)]"
              >
                {primaryCTA.label}
              </AnimatedCTAButton>
              {secondaryCTA && (
                <AnimatedCTAButton
                  href={secondaryCTA.href}
                  variant="outline"
                  className="bg-white/90"
                >
                  {secondaryCTA.label}
                </AnimatedCTAButton>
              )}
            </motion.div>
          </motion.div>
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
          <Image
            src={backgroundImage}
            alt=""
            fill
            className="object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-900/50" />
        </div>
      )}
      <SkewPolygon className="absolute inset-0 h-full w-full opacity-30" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {label && (
            <motion.div
              variants={itemVariants}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label={label} color="orange" />
            </motion.div>
          )}
          <motion.h2
            variants={itemVariants}
            className="font-title mb-5 text-4xl font-bold text-white sm:text-5xl lg:text-6xl"
          >
            {title}
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="mb-10 text-lg text-white/90 sm:text-xl"
          >
            {description}
          </motion.p>
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          >
            <AnimatedCTAButton href={primaryCTA.href} variant="primary">
              {primaryCTA.label}
            </AnimatedCTAButton>
            {secondaryCTA && (
              <AnimatedCTAButton
                href={secondaryCTA.href}
                variant="outline"
                className="border-white/60 bg-white/10 text-white hover:bg-white/20"
              >
                {secondaryCTA.label}
              </AnimatedCTAButton>
            )}
          </motion.div>
        </motion.div>
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
