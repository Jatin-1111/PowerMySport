"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PenLine, Sparkles } from "lucide-react";

interface BlogHeroProps {
  totalBlogs: number;
}

export default function BlogHero({ totalBlogs }: BlogHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(125deg,#fafdff_0%,#eaf4ff_38%,#fff1dc_100%)] px-5 py-10 shadow-sm sm:rounded-4xl sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-size-[42px_42px] opacity-40" />

      <div className="relative mx-auto max-w-3xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
        >
          <Sparkles size={13} className="text-power-orange" />
          PowerMySport Stories
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="font-title mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
        >
          Where Athletes Share What They Know
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base"
        >
          Training breakthroughs, match-day lessons, gear reviews, and mindset —
          real stories from players and coaches across every sport.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
          className="mt-7 flex flex-col items-center gap-3"
        >
          <Link
            href="/blog/write"
            className="group inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-700"
          >
            <PenLine size={17} className="transition-transform group-hover:-rotate-12" />
            Write a story
          </Link>
          <p className="text-xs font-medium text-slate-400">
            {totalBlogs} {totalBlogs === 1 ? "story" : "stories"} published so far
          </p>
        </motion.div>
      </div>
    </section>
  );
}
