"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    Bell,
    CheckCheck,
    ChevronDown,
    ClipboardList,
    FileText,
    RotateCcw,
} from "lucide-react";
import { useState } from "react";

import {
    ApplicationRecord
} from '../utils';

// ─── P6: Applications Tab ─────────────────────────────────────────────────────

export function ApplicationsTab({
  applications,
  onUpdateStatus,
}: {
  applications: ApplicationRecord[];
  onUpdateStatus: (id: string, status: ApplicationRecord["status"]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const statusConfig: Record<
    ApplicationRecord["status"],
    { label: string; color: string; bg: string; icon: React.ReactNode }
  > = {
    Submitted: {
      label: "Submitted",
      color: "text-indigo-700",
      bg: "bg-indigo-50 border-indigo-200",
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    "In Review": {
      label: "In Review",
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
      icon: <RotateCcw className="h-3.5 w-3.5 animate-spin-slow" />,
    },
    Approved: {
      label: "Approved",
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
      icon: <CheckCheck className="h-3.5 w-3.5" />,
    },
  };

  if (applications.length === 0) {
    return (
      <motion.div
        key="apps-empty"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <ClipboardList className="h-7 w-7 text-slate-300" />
        </div>
        <p className="font-title text-lg font-bold text-slate-800">
          No applications tracked
        </p>
        <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
          Open any tournament, scholarship, or university card and submit
          documents — your applications will appear here.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="applications"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <Bell className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-700 leading-relaxed">
          Use this as a personal tracker. Tap any application to see documents
          and update the status as things progress.
        </p>
      </div>

      {applications.map((app) => {
        const sc = statusConfig[app.status];
        const isOpen = expanded === app.id;
        const nextStatus: ApplicationRecord["status"] =
          app.status === "Submitted"
            ? "In Review"
            : app.status === "In Review"
              ? "Approved"
              : "Approved";

        return (
          <div
            key={app.id}
            className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div
              className={`absolute inset-y-0 left-0 w-1 ${
                app.status === "Approved"
                  ? "bg-turf-green"
                  : app.status === "In Review"
                    ? "bg-amber-400"
                    : "bg-blue-400"
              } rounded-l-full`}
            />
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : app.id)}
              className="w-full flex items-center gap-3 pl-5 pr-4 py-3.5 text-left hover:bg-slate-50 transition"
            >
              <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shrink-0 ${sc.bg} ${sc.color}`}
              >
                {sc.icon} {sc.label}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate text-sm">
                  {app.itemName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {app.sport} · {app.itemType} ·{" "}
                  {new Date(app.submittedAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-slate-400 shrink-0"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.15 },
                  }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Documents Submitted
                      </p>
                      <ul className="space-y-1.5">
                        {app.documents.map((doc, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {doc.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {app.status !== "Approved" && (
                      <button
                        onClick={() => onUpdateStatus(app.id, nextStatus)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2 transition"
                      >
                        Mark as "{nextStatus}"
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );
}

