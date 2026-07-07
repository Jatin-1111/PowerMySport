"use client";

import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { slideIn, PERSONALITY_OPTIONS } from "../../constants";
import type { GuidanceFormState } from "../../types";

export function Step4Details({
  form,
  update,
}: {
  form: GuidanceFormState;
  update: <K extends keyof GuidanceFormState>(
    k: K,
    v: GuidanceFormState[K],
  ) => void;
}) {
  const toggleTag = (tag: string) => {
    const has = form.personality_tags.includes(tag);
    update(
      "personality_tags",
      has
        ? form.personality_tags.filter((t) => t !== tag)
        : [...form.personality_tags, tag],
    );
  };

  // Smart question chips based on context
  const smartChips: string[] = [
    ...(form.child_age <= 11
      ? ["Should my child play multiple sports at this age, or specialise?"]
      : []),
    ...(form.primary_objective === "Compete"
      ? ["What talent indicators should I watch for in my child?"]
      : []),
    "How do I find and evaluate the right coach for my child's age?",
    "What documents should I start collecting from Day 1 for future trials?",
    "How do I balance school academics with serious sport training?",
  ];

  const appendChip = (chip: string) => {
    const existing = form.parent_specific_question.trim();
    update("parent_specific_question", existing ? `${existing} ${chip}` : chip);
  };

  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="font-title text-2xl font-bold text-slate-900 mb-1">
          Personality & your questions
        </h2>
        <p className="text-sm text-slate-500">
          Pick traits and tap quick questions or write your own.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Personality traits{" "}
          <span className="text-slate-400 normal-case font-normal">
            (pick all that fit)
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_OPTIONS.map(({ label, icon: Icon }) => {
            const selected = form.personality_tags.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleTag(label)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                  selected
                    ? "border-power-orange bg-power-orange/5 text-power-orange shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="text-slate-600 flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate">{label}</span>
                {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Your biggest concern or question{" "}
          <span className="text-slate-400 normal-case font-normal">
            (optional)
          </span>
        </span>
        {/* Smart question chips */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> Quick questions — tap to add
          </p>
          <div className="flex flex-wrap gap-2">
            {smartChips.map((chip) => {
              const alreadyAdded = form.parent_specific_question.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => !alreadyAdded && appendChip(chip)}
                  disabled={alreadyAdded}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all text-left ${
                    alreadyAdded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                      : "border-slate-200 bg-white text-slate-600 hover:border-power-orange hover:text-power-orange hover:bg-power-orange/5"
                  }`}
                >
                  {alreadyAdded ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <span className="text-[10px] shrink-0">+</span>
                  )}
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
        <textarea
          rows={4}
          value={form.parent_specific_question}
          onChange={(e) => update("parent_specific_question", e.target.value)}
          placeholder="Or write your own concern — e.g. 'My child is shy about joining teams. How can I ease them in?'"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10 resize-none"
        />
      </div>
    </motion.div>
  );
}
