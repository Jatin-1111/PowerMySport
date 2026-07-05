"use client";

import { BackgroundBeams } from "@/modules/shared/ui/BackgroundBeams";
import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React, { useRef } from "react";
import { SectionLabel } from "./SectionLabel";

export interface HeroProps {
  variant?: "home" | "page" | "split";
  title: string;
  subtitle?: string;
  description?: string;
  primaryCTA?: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  imageSrc?: string;
  imageAlt?: string;
  gradient?: boolean;
  stats?: Array<{ label: string; value: string; helper?: string }>;
}

// ─── Motion Variants ──────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.13, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

const imageVariants: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.96 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 200, damping: 26, delay: 0.2 },
  },
};

// ─── Decorative geometric SVG accent ─────────────────────────────────────────

function GeometricAccent({
  className,
  color = "orange",
}: {
  className?: string;
  color?: "orange" | "green";
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("pointer-events-none", className)}
      aria-hidden
    >
      <polygon
        points="0,60 60,0 200,0 200,140 140,200 0,200"
        fill={
          color === "orange" ? "rgba(233,115,22,0.07)" : "rgba(34,197,94,0.07)"
        }
        stroke={
          color === "orange" ? "rgba(233,115,22,0.15)" : "rgba(34,197,94,0.15)"
        }
        strokeWidth="1"
      />
    </svg>
  );
}

// ─── HOME VARIANT ─────────────────────────────────────────────────────────────

function HomeHero({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  stats,
}: HeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[60vh] overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#edf4ff_40%,#fff8ee_100%)] sm:min-h-[80vh] lg:min-h-[88vh]"
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-sky-300/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-amber-200/25 blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-orange-200/15 blur-[80px]" />

      {/* Animated beam accent */}
      <BackgroundBeams className="opacity-70" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-16 sm:gap-12 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28 lg:px-8">
        {/* ── Left: Text column ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-start"
        >
          {subtitle && (
            <motion.div variants={itemVariants} className="mb-6">
              <SectionLabel label={subtitle} color="orange" />
            </motion.div>
          )}

          <motion.h1
            variants={itemVariants}
            className="font-title mb-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:mb-6 sm:text-4xl lg:text-[4.25rem]"
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              variants={itemVariants}
              className="mb-8 max-w-xl text-base leading-relaxed text-slate-600 sm:mb-10 sm:text-lg lg:text-xl"
            >
              {description}
            </motion.p>
          )}

          <motion.div
            variants={itemVariants}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4"
          >
            {primaryCTA && (
              <Link href={primaryCTA.href} className="w-full sm:w-auto">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="h-auto w-full rounded-xl px-8 py-4 text-base font-bold shadow-[0_8px_32px_-8px_rgba(233,115,22,0.55)] transition-shadow hover:shadow-[0_12px_40px_-8px_rgba(233,115,22,0.65)]"
                  >
                    {primaryCTA.label}
                  </Button>
                </motion.div>
              </Link>
            )}
            {secondaryCTA && (
              <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto w-full rounded-xl border-slate-300 bg-white/90 px-8 py-4 text-base text-slate-800 hover:border-slate-400 hover:bg-white hover:text-slate-900"
                  >
                    {secondaryCTA.label}
                  </Button>
                </motion.div>
              </Link>
            )}
          </motion.div>

          {stats && stats.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="mt-10 grid w-full gap-3 sm:grid-cols-3"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 backdrop-blur-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                  {stat.helper && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {stat.helper}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* ── Right: Clipped image panel ── */}
        <motion.div
          variants={imageVariants}
          initial="hidden"
          animate="show"
          className="relative hidden lg:block"
        >
          {/* Floating geometric decoration behind the image */}
          <div className="absolute -right-8 -top-8 h-[420px] w-[420px]">
            <GeometricAccent className="h-full w-full" color="orange" />
          </div>
          <div className="absolute -bottom-6 -left-6 h-64 w-64 opacity-60">
            <GeometricAccent className="h-full w-full" color="green" />
          </div>

          {/* Neon glow orb behind the image */}
          <div className="absolute right-8 top-12 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/20 via-amber-300/10 to-transparent blur-3xl" />
          <div className="absolute bottom-4 left-8 h-48 w-48 rounded-full bg-gradient-to-br from-turf-green/15 to-transparent blur-2xl" />

          {/* Clipped image frame */}
          <motion.div
            className="relative h-[560px] w-full overflow-hidden rounded-[2rem]"
            style={{
              y: imageY,
              clipPath:
                "polygon(0 0, 92% 0, 100% 8%, 100% 100%, 8% 100%, 0 92%)",
            }}
          >
            <Image
              src="https://images.unsplash.com/photo-1526232761682-d26e03ac148e?fm=jpg&q=60&w=3000&auto=format&fit=crop"
              alt="Young children practicing soccer on a turf field with a coach"
              fill
              priority
              sizes="(max-width: 1280px) 50vw, 680px"
              className="object-cover"
            />
            {/* Subtle gradient on image bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent" />
          </motion.div>

          {/* Floating badge chip over the image */}
          {/* <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 0.6,
              type: "spring",
              stiffness: 260,
              damping: 20,
            }}
            className="absolute -bottom-4 -left-6 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-md sm:flex"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-power-orange text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">0% Commission</p>
              <p className="text-[10px] text-slate-500">On all bookings now</p>
            </div>
          </motion.div> */}

          {/* Live badge top right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.75,
              type: "spring",
              stiffness: 300,
              damping: 18,
            }}
            className="absolute right-4 top-6 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 shadow-md backdrop-blur-sm sm:flex"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turf-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-turf-green" />
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              Live availability
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom wave divider */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/60 to-transparent" />
    </section>
  );
}

// ─── PAGE VARIANT ─────────────────────────────────────────────────────────────

function PageHero({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center"
        >
          {subtitle && (
            <motion.div
              variants={itemVariants}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label={subtitle} color="slate" />
            </motion.div>
          )}
          <motion.h1
            variants={itemVariants}
            className="font-title mb-5 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-6xl"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl"
            >
              {description}
            </motion.p>
          )}
          {(primaryCTA || secondaryCTA) && (
            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            >
              {primaryCTA && (
                <Link href={primaryCTA.href}>
                  <Button variant="primary" size="lg" className="rounded-xl">
                    {primaryCTA.label}
                  </Button>
                </Link>
              )}
              {secondaryCTA && (
                <Link href={secondaryCTA.href}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-xl bg-white"
                  >
                    {secondaryCTA.label}
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ─── SPLIT VARIANT ────────────────────────────────────────────────────────────

function SplitHero({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  imageSrc,
  imageAlt,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-ghost-white py-20 sm:py-24 lg:py-28">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-200/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-amber-200/20 blur-[100px]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {subtitle && (
            <motion.div variants={itemVariants} className="mb-5">
              <SectionLabel label={subtitle} color="orange" />
            </motion.div>
          )}
          <motion.h1
            variants={itemVariants}
            className="font-title mb-6 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-6xl"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariants}
              className="mb-8 text-lg leading-relaxed text-slate-600"
            >
              {description}
            </motion.p>
          )}
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-3 sm:flex-row sm:gap-4"
          >
            {primaryCTA && (
              <Link href={primaryCTA.href}>
                <Button variant="primary" size="lg" className="rounded-xl">
                  {primaryCTA.label}
                </Button>
              </Link>
            )}
            {secondaryCTA && (
              <Link href={secondaryCTA.href}>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl bg-white"
                >
                  {secondaryCTA.label}
                </Button>
              </Link>
            )}
          </motion.div>
        </motion.div>

        {imageSrc && (
          <motion.div
            variants={imageVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative h-[280px] w-full sm:h-[380px] lg:h-[460px]"
          >
            {/* Decorative glow */}
            <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-orange-400/15 via-transparent to-turf-green/10 blur-2xl" />
            <div
              className="relative h-full w-full overflow-hidden rounded-3xl"
              style={{
                clipPath:
                  "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
              }}
            >
              <Image
                src={imageSrc}
                alt={imageAlt || title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/8 rounded-3xl" />
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const Hero: React.FC<HeroProps> = (props) => {
  if (props.variant === "home") return <HomeHero {...props} />;
  if (props.variant === "split") return <SplitHero {...props} />;
  return <PageHero {...props} />;
};
