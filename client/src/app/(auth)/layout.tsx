"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Map, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
// Floodlit stadium at night — Unsplash (free license), pre-cropped to portrait
// images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1280&h=1600&fit=crop
import stadiumNight from "../../../public/auth/stadium-night.jpg";

const features = [
  { Icon: Map, text: "Personalised pathway for your child's sport" },
  { Icon: ShieldCheck, text: "Verified coaches, academies & expert guidance" },
  { Icon: Sparkles, text: "AI guidance at every decision point" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-white dark:bg-slate-950 lg:grid-cols-2">
      {/* ── LEFT: Image panel (desktop only) ──────────────────── */}
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen p-4">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-deep-slate">
            <Image
              src={stadiumNight}
              alt="Floodlit stadium under a night sky"
              fill
              priority
              placeholder="blur"
              sizes="(min-width: 1024px) 50vw, 0px"
              className="object-cover"
            />

            {/* Scrims for text legibility */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-deep-slate via-deep-slate/30 to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-deep-slate/70 to-transparent"
            />

            {/* Logo */}
            <motion.div
              className="relative z-10 p-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <Link href="/" className="group inline-flex flex-col gap-1">
                <span className="font-title text-2xl font-black leading-none tracking-tight">
                  <span className="text-white">Power</span>
                  <span className="text-power-orange">My</span>
                  <span className="text-white">Sport</span>
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/80">
                  Guiding Every Sporting Journey
                </span>
              </Link>
            </motion.div>

            {/* Headline + features */}
            <motion.div
              className="relative z-10 mt-auto p-10 pt-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              <h2
                className="max-w-md font-title text-[2.5rem] font-black leading-[1.08] text-white"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                The trusted guide for{" "}
                <span className="text-power-orange">every sports parent.</span>
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-200/85">
                Personalised pathways, expert guidance, and a trusted community
                — everything you need to navigate your child&apos;s sporting
                journey with confidence.
              </p>

              <ul className="mt-8 space-y-3">
                {features.map((f, i) => (
                  <motion.li
                    key={f.text}
                    className="flex items-center gap-3.5"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 + i * 0.1 }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
                      <f.Icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="text-sm font-medium text-slate-100/90">
                      {f.text}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form panel ──────────────────────────────────── */}
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 py-1.5 pl-3 pr-4 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          {/* Mobile logo only */}
          <Link href="/" className="font-title text-lg font-black lg:hidden">
            <span className="text-slate-900 dark:text-white">Power</span>
            <span className="text-power-orange">My</span>
            <span className="text-slate-900 dark:text-white">Sport</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-5 px-6 pb-6 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} PowerMySport</span>
          <Link
            href="/terms"
            className="transition-colors hover:text-slate-600 dark:hover:text-slate-400"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-slate-600 dark:hover:text-slate-400"
          >
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}
