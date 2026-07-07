"use client";

import { cn } from "@/utils/cn";
import { motion, Variants } from "framer-motion";
import { Quote, Star } from "lucide-react";
import Image from "next/image";
import React from "react";
import { SectionLabel } from "./SectionLabel";

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating?: number;
}

export interface TestimonialsProps {
  title?: string;
  subtitle?: string;
  testimonials: Testimonial[];
  variant?: "default" | "centered";
}

// ─── Motion variants ──────────────────────────────────────────────────────────

const headerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const headerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 240, damping: 24 },
  },
};

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index: number;
}) {
  const isHighlighted = index === 1;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl p-6 will-change-transform",
        isHighlighted
          ? "border-2 border-power-orange/30 bg-gradient-to-br from-orange-50/80 to-amber-50/60 shadow-[0_8px_40px_-8px_rgba(233,115,22,0.18)] backdrop-blur-md"
          : "border border-white/70 bg-white/80 shadow-sm backdrop-blur-md premium-shadow",
      )}
    >
      {/* Left accent stripe for highlighted card */}
      {isHighlighted && (
        <div className="absolute left-0 top-6 bottom-6 w-1 rounded-full bg-gradient-to-b from-power-orange to-amber-400" />
      )}

      {/* Quote icon */}
      <div
        className={cn(
          "mb-4 flex h-8 w-8 items-center justify-center rounded-lg",
          isHighlighted
            ? "bg-power-orange/10 text-power-orange"
            : "bg-slate-100 text-slate-400",
        )}
      >
        <Quote className="h-4 w-4" />
      </div>

      {/* Star rating */}
      {testimonial.rating && (
        <div className="mb-4 flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.35 + i * 0.07,
                type: "spring",
                stiffness: 400,
                damping: 16,
              }}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  i < testimonial.rating!
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-200 text-slate-200",
                )}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Quote text */}
      <blockquote className="mb-6 grow text-sm leading-relaxed text-slate-700 sm:text-base">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-power-orange to-amber-500 text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-110">
          {testimonial.avatar ? (
            <Image
              src={testimonial.avatar}
              alt={testimonial.author}
              fill
              className="object-cover"
              sizes="44px"
            />
          ) : (
            testimonial.author.charAt(0)
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">
            {testimonial.author}
          </p>
          <p className="text-xs text-slate-500">{testimonial.role}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export const Testimonials: React.FC<TestimonialsProps> = ({
  title,
  subtitle,
  testimonials,
}) => {
  return (
    <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
      {/* Blurred sports backdrop for depth */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[0.04] blur-sm"
          aria-hidden
        />
      </div>

      {/* Ambient blobs */}
      <div className="pointer-events-none absolute left-0 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-100/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-72 w-72 translate-x-1/2 rounded-full bg-indigo-100/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section Header ── */}
        {(title || subtitle) && (
          <motion.div
            variants={headerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="mb-12 text-center sm:mb-16"
          >
            {subtitle && (
              <motion.div
                variants={headerItemVariants}
                className="mb-4 flex justify-center"
              >
                <SectionLabel label={subtitle} color="orange" />
              </motion.div>
            )}
            {title && (
              <motion.h2
                variants={headerItemVariants}
                className="font-title text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                {title}
              </motion.h2>
            )}
          </motion.div>
        )}

        {/* ── Testimonials Grid ── */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 gap-5 md:grid-cols-3 sm:gap-6"
        >
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
