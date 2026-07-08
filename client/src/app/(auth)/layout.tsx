"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Map, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import React from "react";

const features = [
  { Icon: Map, text: "Personalised pathway for your child's sport" },
  { Icon: ShieldCheck, text: "Verified coaches, academies & expert guidance" },
  { Icon: Sparkles, text: "AI guidance at every decision point" },
];

function CourtSVG() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 480 640"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Outer court */}
      <rect
        x="48" y="80" width="384" height="480" rx="2"
        stroke="rgba(34,197,94,0.10)" strokeWidth="1.5"
      />
      {/* Half-court line */}
      <line
        x1="48" y1="320" x2="432" y2="320"
        stroke="rgba(34,197,94,0.08)" strokeWidth="1.5"
      />
      {/* Center circle */}
      <circle
        cx="240" cy="320" r="56"
        stroke="rgba(34,197,94,0.10)" strokeWidth="1.5"
      />
      <circle cx="240" cy="320" r="4" fill="rgba(34,197,94,0.20)" />
      {/* Top key */}
      <rect
        x="180" y="80" width="120" height="120"
        stroke="rgba(34,197,94,0.08)" strokeWidth="1.5"
      />
      {/* Top free-throw arc */}
      <path
        d="M 180 200 A 60 60 0 0 0 300 200"
        stroke="rgba(34,197,94,0.08)" strokeWidth="1.5"
      />
      {/* Bottom key */}
      <rect
        x="180" y="440" width="120" height="120"
        stroke="rgba(34,197,94,0.08)" strokeWidth="1.5"
      />
      {/* Bottom free-throw arc */}
      <path
        d="M 180 440 A 60 60 0 0 1 300 440"
        stroke="rgba(34,197,94,0.08)" strokeWidth="1.5"
      />
      {/* Top basket ring */}
      <circle
        cx="240" cy="110" r="14"
        stroke="rgba(233,115,22,0.18)" strokeWidth="1.5"
      />
      {/* Bottom basket ring */}
      <circle
        cx="240" cy="530" r="14"
        stroke="rgba(233,115,22,0.18)" strokeWidth="1.5"
      />
      {/* Backboards */}
      <line
        x1="208" y1="84" x2="272" y2="84"
        stroke="rgba(233,115,22,0.22)" strokeWidth="2"
      />
      <line
        x1="208" y1="556" x2="272" y2="556"
        stroke="rgba(233,115,22,0.22)" strokeWidth="2"
      />
    </svg>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* ── LEFT: Brand panel (desktop only) ──────────────────── */}
      <div className="relative hidden overflow-hidden bg-deep-slate lg:flex lg:flex-col p-12">
        {/* Ambient glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-power-orange/12 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-turf-green/10 blur-[100px]"
        />

        <CourtSVG />

        {/* Logo */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Link href="/" className="inline-flex flex-col gap-0.5 group">
            <span className="font-title text-2xl font-black tracking-tight leading-none">
              <span className="text-slate-900">Power</span>
              <span className="text-power-orange">My</span>
              <span className="text-slate-900">Sport</span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500">
              Guiding Every Sporting Journey.
            </span>
          </Link>
        </motion.div>

        {/* Headline + features */}
        <motion.div
          className="relative z-10 mt-auto mb-auto py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.18 }}
        >
          <h2
            className="font-title text-[2.4rem] font-black leading-[1.1] text-white"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            The trusted guide for{" "}
            <span className="text-gradient">every sports parent.</span>
          </h2>
          <p className="mt-4 max-w-[270px] text-[15px] leading-relaxed text-slate-400">
            Personalised pathways, expert guidance, and trusted community — everything to navigate your child&apos;s sporting journey with confidence.
          </p>

          <ul className="mt-9 space-y-4">
            {features.map((f, i) => (
              <motion.li
                key={f.text}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.32 + i * 0.1 }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <f.Icon className="h-3.5 w-3.5 text-turf-green" />
                </span>
                <span className="text-sm text-slate-300">{f.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>


      </div>

      {/* ── RIGHT: Form panel ──────────────────────────────────── */}
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-power-orange"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          {/* Mobile logo only */}
          <Link
            href="/"
            className="font-title text-lg font-black text-power-orange lg:hidden"
          >
            PowerMySport
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 lg:px-16 xl:px-20">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
