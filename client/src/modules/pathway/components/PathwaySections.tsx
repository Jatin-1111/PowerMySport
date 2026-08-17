"use client";

// ─── Shared roadmap page sections ────────────────────────────────────────────
//
// The marketing chrome the roadmap pages have always had — the stats banner and
// the "how we help" pair.
//
// Only `/roadmap/[sport]` wears them now. They used to run on the index too, and
// there they sat between the sport list and the footer CTA: three marketing
// blocks stacked under the one thing a visitor came to click. The index replaced
// them with a band of concrete next steps. At the foot of a pathway a parent has
// actually read, the pitch has been earned — so here they stay.
//
// Client-only because of the scroll-triggered motion; the pathway content itself
// is server-rendered above these.

import { motion } from "framer-motion";
import { Award, Dumbbell, MapPin, TrendingUp, Unlock, Zap } from "lucide-react";

import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { AmbientBlob } from "./AmbientBlob";
import { SPRING_STIFF, cardReveal, fadeUp, orchestrator } from "../motion";

const STAT_CARDS = [
  {
    icon: <Zap className="h-6 w-6" />,
    value: "6 stages",
    label: "From First Racket to What Comes After",
    color: "bg-orange-100 text-power-orange",
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    value: "5 questions",
    label: "Answered the Same Way at Every Stage",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: <MapPin className="h-6 w-6" />,
    value: "Built with coaches",
    label: "Written with Experts and Sports Parents",
    color: "bg-amber-100 text-amber-600",
  },
  {
    icon: <Unlock className="h-6 w-6" />,
    value: "₹0",
    label: "Free to Read",
    color: "bg-emerald-100 text-emerald-600",
  },
];

export function PathwayStatsBanner() {
  return (
    <section className="relative py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-64 w-full -translate-x-1/2 bg-gradient-to-b from-orange-50/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={orchestrator}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4"
        >
          {STAT_CARDS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={cardReveal}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={SPRING_STIFF}
              className="group flex flex-col items-center rounded-2xl border border-white/70 bg-white/80 p-5 text-center backdrop-blur-sm premium-shadow will-change-transform sm:p-6"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${stat.color}`}
              >
                {stat.icon}
              </div>
              <p className="font-title text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function PathwayHelpSection() {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16 md:py-20 lg:py-28">
      <AmbientBlob className="h-80 w-80 bg-orange-100/40 -right-24 top-16" />
      <AmbientBlob className="h-72 w-72 bg-emerald-100/30 -left-32 bottom-20" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={orchestrator}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mb-14 text-center"
        >
          <motion.div variants={fadeUp} className="mb-4 flex justify-center">
            <SectionLabel label="We Support You at Every Step" color="green" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-title mx-auto max-w-2xl text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl lg:text-5xl"
          >
            PowerMySport Helps You Grow Faster
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg"
          >
            No matter where you start, we provide the expert guidance and smart
            tools you need to reach the next stage.
          </motion.p>
        </motion.div>

        <motion.div
          variants={orchestrator}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2"
        >
          {[
            {
              icon: <Dumbbell className="h-7 w-7" />,
              title: "Top Experts",
              description:
                "Connect with verified experts who have played at top levels. Learn from people who know exactly what it takes to succeed.",
              color: "bg-orange-100 text-power-orange",
            },
            {
              icon: <Award className="h-7 w-7" />,
              title: "Smart AI Planning",
              description:
                "Our AI creates a custom plan based on your child's age, sport, and current skill level — showing you exactly what to do next.",
              color: "bg-emerald-100 text-emerald-600",
            },
          ].map((item) => (
            <motion.div
              key={item.title}
              variants={cardReveal}
              whileHover={{ y: -6, scale: 1.015 }}
              transition={SPRING_STIFF}
              className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-6 backdrop-blur-sm premium-shadow will-change-transform hover:border-white/90 sm:p-8"
            >
              {/* decorative circle */}
              <div
                aria-hidden
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-slate-50 opacity-60 transition-transform duration-500 group-hover:scale-150"
              />
              <div
                className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110 ${item.color}`}
              >
                {item.icon}
              </div>
              <h3 className="relative mb-3 text-lg font-bold text-slate-900">
                {item.title}
              </h3>
              <p className="relative text-sm leading-relaxed text-slate-600">
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
