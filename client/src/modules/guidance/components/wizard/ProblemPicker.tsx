import type { ProblemId } from "@/modules/guidance/config/wizard/guidanceUtils";
import {
  PROBLEM_TYPES,
  WIZARD_STEPS,
  estimateMinutes,
} from "@/modules/guidance/config/wizard/wizardConfig";
import { motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";

export function ProblemPicker({ onSelect }: { onSelect: (id: ProblemId) => void }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-white to-slate-50" />
        <div className="bg-power-orange/8 absolute -left-32 -top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-200/15 blur-3xl" />
      </div>

      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-10 text-center"
        >
          <div className="text-power-orange mb-4 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">
            <BrainCircuit className="h-3 w-3" />
            Expert Help
          </div>
          <h1 className="font-title mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What do you need help with?
          </h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-slate-500">
            Pick the challenge you&apos;re facing — we&apos;ll ask a few targeted questions and
            return an actionable plan.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROBLEM_TYPES.map((pt, i) => {
            const Icon = pt.Icon;
            return (
              <motion.button
                key={pt.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.1, duration: 0.35, ease: "easeOut" }}
                onClick={() => onSelect(pt.id)}
                className={`group rounded-3xl border-2 border-slate-200 bg-white p-6 text-left shadow-sm ${pt.hoverBorder} transition-all duration-200 hover:shadow-md active:scale-[0.99]`}
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${pt.color} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider ${pt.accentText} mb-0.5`}
                >
                  {pt.tagline}
                </p>
                <h2 className="font-title mb-1.5 text-lg font-bold text-slate-900">{pt.label}</h2>
                <p className="mb-4 text-sm leading-relaxed text-slate-500">{pt.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    {estimateMinutes(WIZARD_STEPS[pt.id])}
                  </span>
                  <span
                    className={`text-sm font-bold ${pt.accentText} inline-flex transition-transform duration-200 group-hover:translate-x-1`}
                  >
                    Get started →
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 text-center text-xs text-slate-400"
        >
          Free to use · AI-powered · No commitment
        </motion.p>
      </div>
    </div>
  );
}
