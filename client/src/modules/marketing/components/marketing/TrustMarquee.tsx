"use client";

import { InfiniteMovingCards } from "@/modules/shared/ui/InfiniteMovingCards";
import { motion, Variants } from "framer-motion";
import { parentTestimonials } from "@/modules/marketing/data/testimonials";
import { SectionLabel } from "./SectionLabel";

interface TrustMarqueeProps {
  title?: string;
  subtitle?: string;
}

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

/**
 * Looping marquee of real parent quotes, used as the homepage's testimonial
 * showcase instead of a static grid.
 */
export function TrustMarquee({
  title = "What Parents Say",
  subtitle = "Testimonials",
}: TrustMarqueeProps) {
  const items = parentTestimonials.map((t) => ({
    quote: t.quote,
    name: t.author,
    title: t.role,
  }));

  return (
    <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute left-0 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-100/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-72 w-72 translate-x-1/2 rounded-full bg-indigo-100/30 blur-3xl" />

      {(title || subtitle) && (
        <motion.div
          variants={headerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="relative mb-10 text-center sm:mb-14"
        >
          {subtitle && (
            <motion.div variants={headerItemVariants} className="mb-4 flex justify-center">
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

      <InfiniteMovingCards items={items} direction="left" speed="slow" className="relative" />
    </section>
  );
}
