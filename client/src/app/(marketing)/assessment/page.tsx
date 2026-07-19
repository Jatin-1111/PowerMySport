"use client";

import { SportKnownFlow } from "@/modules/find-sport/components/SportKnownFlow";
import { WizardShell } from "@/modules/find-sport/components/WizardShell";
import { motion } from "framer-motion";
import { CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import { useState } from "react";

type Mode = "pick" | "discover" | "known";

function ModePicker({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-white to-slate-50" />
        <div className="absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full bg-power-orange/8 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-200/15 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-power-orange mb-4">
            <Sparkles className="h-3 w-3" />
            Sport Assessment
          </div>
          <h1 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl mb-3 tracking-tight">
            How can we help you today?
          </h1>
          <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">
            Whether you already know the sport or not, we&apos;ll build the right plan for your child.
          </p>
        </motion.div>

        {/* Choice cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            <button
              type="button"
              onClick={() => onSelect("discover")}
              className="group flex h-full w-full flex-col text-left rounded-3xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-power-orange hover:shadow-md transition-all duration-200 active:scale-[0.99]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-power-orange transition-transform duration-300 group-hover:scale-110">
                <HelpCircle className="h-6 w-6" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-power-orange mb-1">
                Not sure yet?
              </p>
              <h2 className="font-title text-xl font-bold text-slate-900 mb-2">
                Help me find a sport
              </h2>
              <p className="flex-1 text-sm text-slate-500 leading-relaxed mb-5">
                Answer a few quick questions about your child&apos;s personality, physical traits, and goals — we&apos;ll recommend the best sport match.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">~5 minutes</span>
                <span className="text-sm font-bold text-power-orange group-hover:translate-x-1 transition-transform duration-200 inline-flex">
                  Find the sport →
                </span>
              </div>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            <button
              type="button"
              onClick={() => onSelect("known")}
              className="group flex h-full w-full flex-col text-left rounded-3xl border-2 border-slate-200 bg-white p-7 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all duration-200 active:scale-[0.99]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                Already know it?
              </p>
              <h2 className="font-title text-xl font-bold text-slate-900 mb-2">
                Build the profile
              </h2>
              <p className="flex-1 text-sm text-slate-500 leading-relaxed mb-5">
                Tell us your child&apos;s sport and we&apos;ll build their profile — so we can personalise the roadmap and guidance for exactly where they are.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">~5 min · more questions</span>
                <span className="text-sm font-bold text-emerald-600 group-hover:translate-x-1 transition-transform duration-200 inline-flex">
                  Build profile →
                </span>
              </div>
            </button>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-center text-xs text-slate-400 mt-6"
        >
          Free to use · No account required to explore
        </motion.p>
      </div>
    </div>
  );
}

export default function AssessmentPage() {
  const [mode, setMode] = useState<Mode>("pick");

  if (mode === "discover") return <WizardShell />;
  if (mode === "known") return <SportKnownFlow onBack={() => setMode("pick")} />;
  return <ModePicker onSelect={setMode} />;
}
