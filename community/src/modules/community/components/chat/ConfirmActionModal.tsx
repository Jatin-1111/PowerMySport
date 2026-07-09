"use client";

import { AnimatePresence, motion } from "framer-motion";

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl pointer-events-auto"
            >
              <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                {description}
              </p>
              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition disabled:opacity-50 ${
                    variant === "danger"
                      ? "bg-rose-500 hover:bg-rose-600 active:bg-rose-700"
                      : "bg-power-orange hover:bg-orange-600 active:bg-orange-700"
                  }`}
                >
                  {isLoading ? "Please wait…" : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
