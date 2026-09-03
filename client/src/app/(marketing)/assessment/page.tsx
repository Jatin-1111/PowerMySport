"use client";

import { motion } from "framer-motion";
import { CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AssessmentPage() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-white to-slate-50" />
        <div className="bg-power-orange/8 absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-200/15 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-10 text-center"
        >
          <div className="text-power-orange mb-4 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />
            Get Started
          </div>
          <h1 className="font-title mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How can we help you today?
          </h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-slate-500">
            Whether you already know the sport or not, we&apos;ll build the right plan for your
            child.
          </p>
        </motion.div>

        {/* Choice cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            <button
              type="button"
              onClick={() => router.push("/assessment/discover")}
              className="hover:border-power-orange group flex h-full w-full flex-col rounded-3xl border-2 border-slate-200 bg-white p-7 text-left shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]"
            >
              <div className="text-power-orange mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 transition-transform duration-300 group-hover:scale-110">
                <HelpCircle className="h-6 w-6" />
              </div>
              <p className="text-power-orange mb-1 text-[11px] font-bold uppercase tracking-wider">
                Not sure yet?
              </p>
              <h2 className="font-title mb-2 text-xl font-bold text-slate-900">
                Help me find a sport
              </h2>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-500">
                Answer a few quick questions about your child&apos;s personality, physical traits,
                and goals — we&apos;ll recommend the best sport match.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">~5 minutes</span>
                <span className="text-power-orange inline-flex text-sm font-bold transition-transform duration-200 group-hover:translate-x-1">
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
              onClick={() => router.push("/sport-profile")}
              className="group flex h-full w-full flex-col rounded-3xl border-2 border-slate-200 bg-white p-7 text-left shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md active:scale-[0.99]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Already know it?
              </p>
              <h2 className="font-title mb-2 text-xl font-bold text-slate-900">
                Build the profile
              </h2>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-500">
                Tell us your child&apos;s sport and we&apos;ll build their profile — so we can
                personalise the roadmap and guidance for exactly where they are.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">~5 min · more questions</span>
                <span className="inline-flex text-sm font-bold text-emerald-600 transition-transform duration-200 group-hover:translate-x-1">
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
          className="mt-6 text-center text-xs text-slate-400"
        >
          Free to use · No account required to explore
        </motion.p>
      </div>
    </div>
  );
}
