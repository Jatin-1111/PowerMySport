"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { Testimonial } from "./Testimonials";

interface TestimonialSpotlightProps {
  testimonials: Testimonial[];
  autoplay?: boolean;
  className?: string;
}

/**
 * Single-quote rotating spotlight for pages with only a few testimonials.
 * Adapted from Aceternity UI's Animated Testimonials — the photo stack is
 * swapped for an initials avatar since we don't have verified photos of the
 * parents quoted, and reusing stock photography would misrepresent them.
 */
export function TestimonialSpotlight({
  testimonials,
  autoplay = true,
  className,
}: TestimonialSpotlightProps) {
  const [active, setActive] = useState(0);

  const next = () => setActive((prev) => (prev + 1) % testimonials.length);
  const prev = () =>
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    if (!autoplay) return;
    const interval = setInterval(next, 5500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, testimonials.length]);

  if (testimonials.length === 0) return null;
  const current = testimonials[active];

  return (
    <div className={cn("relative mx-auto max-w-3xl text-center", className)}>
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-power-orange">
        <Quote className="h-6 w-6" />
      </div>

      <div className="relative min-h-[220px] sm:min-h-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            {current.rating && (
              <div className="mb-5 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < current.rating!
                        ? "fill-amber-400 text-amber-400"
                        : "fill-slate-200 text-slate-200",
                    )}
                  />
                ))}
              </div>
            )}
            <p className="text-xl font-medium leading-relaxed text-slate-800 sm:text-2xl">
              &ldquo;{current.quote}&rdquo;
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-power-orange to-amber-500 text-sm font-bold text-white">
                {current.author.charAt(0)}
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">
                  {current.author}
                </p>
                <p className="text-xs text-slate-500">{current.role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous testimonial"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-power-orange hover:text-power-orange"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-6 bg-power-orange" : "w-1.5 bg-slate-200",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Next testimonial"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-power-orange hover:text-power-orange"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
