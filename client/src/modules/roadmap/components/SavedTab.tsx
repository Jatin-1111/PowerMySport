"use client";

import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { motion } from "framer-motion";
import {
    Bookmark,
    Briefcase,
    Landmark,
    Trophy,
    Wallet,
    X,
} from "lucide-react";

import {
    SavedItem
} from '../utils';

// ─── P5: Saved Tab ────────────────────────────────────────────────────────────

export function SavedTab({
  savedItems,
  onUnsave,
  onGetHelp,
}: {
  savedItems: SavedItem[];
  onUnsave: (id: string) => void;
  /** Opens a WhatsApp chat prefilled to ask a human for help with this item. */
  onGetHelp: (item: any, type: any) => void;
}) {
  const grouped = {
    tournament: savedItems.filter((s) => s.type === "tournament"),
    scholarship: savedItems.filter((s) => s.type === "scholarship"),
    university: savedItems.filter((s) => s.type === "university"),
    career: savedItems.filter((s) => s.type === "career"),
  };

  const typeConfig = {
    tournament: {
      label: "Tournaments",
      icon: <Trophy className="h-4 w-4" />,
      color: "text-power-orange",
      bg: "bg-orange-50 border-orange-100",
      iconBg: "bg-orange-100",
      accentBar: "bg-gradient-to-b from-orange-400 to-orange-300",
      countStyle: "border-orange-100 bg-orange-50 text-power-orange",
    },
    scholarship: {
      label: "Scholarships",
      icon: <Wallet className="h-4 w-4" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
      iconBg: "bg-emerald-100",
      accentBar: "bg-gradient-to-b from-emerald-400 to-emerald-300",
      countStyle: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    university: {
      label: "Universities",
      icon: <Landmark className="h-4 w-4" />,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100",
      iconBg: "bg-indigo-100",
      accentBar: "bg-gradient-to-b from-indigo-400 to-indigo-300",
      countStyle: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
    career: {
      label: "Careers",
      icon: <Briefcase className="h-4 w-4" />,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100",
      iconBg: "bg-indigo-100",
      accentBar: "bg-gradient-to-b from-blue-400 to-blue-300",
      countStyle: "border-indigo-100 bg-indigo-50 text-indigo-600",
    },
  } as const;

  if (savedItems.length === 0) {
    return (
      <motion.div
        key="saved-empty"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <Bookmark className="h-7 w-7 text-slate-300" />
        </div>
        <p className="font-title text-lg font-bold text-slate-800">
          Your shortlist is empty
        </p>
        <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
          Save any tournament, scholarship, university, or career from the other
          tabs to build your shortlist here.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="saved"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {(["tournament", "scholarship", "university", "career"] as const).map(
        (type) => {
          const items = grouped[type];
          if (items.length === 0) return null;
          const cfg = typeConfig[type];
          return (
            <div key={type}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg} ${cfg.color}`}
                >
                  {cfg.icon}
                </div>
                <h3 className="font-title text-base font-bold text-slate-900">
                  {cfg.label}
                </h3>
                <div className="flex-1 h-px bg-slate-100" />
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.countStyle}`}
                >
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((saved) => (
                  <div
                    key={saved.id}
                    className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden"
                  >
                    {/* Colored left accent */}
                    <div
                      className={`absolute inset-y-0 left-0 w-1 ${cfg.accentBar} rounded-l-2xl`}
                    />
                    <div className="pl-3">
                      <button
                        onClick={() => onUnsave(saved.id)}
                        className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 transition"
                        title="Remove from saved"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[10px] font-semibold text-slate-400 mb-1">
                        {saved.sport} ·{" "}
                        {new Date(saved.savedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="font-bold text-slate-900 text-sm pr-8 break-words mb-3">
                        {saved.name}
                      </p>
                      {type !== "career" && (
                        <button
                          onClick={() => onGetHelp(saved.data, type)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                          Get Help via WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        },
      )}
    </motion.div>
  );
}

