"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, LogIn, UserPlus, MessageCircle } from "lucide-react";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  childName?: string;
  sport?: string;
  submissionId: string;
}

export function LoginRequiredModal({
  isOpen,
  onClose,
  childName,
  sport,
  submissionId,
}: LoginRequiredModalProps) {
  const redirectUrl = `/guidance?submissionId=${submissionId}&openChat=1`;
  const encodedRedirect = encodeURIComponent(redirectUrl);

  const loginHref = `/login?redirect=${encodedRedirect}`;
  const registerHref = `/register?redirect=${encodedRedirect}`;

  const subjectLabel = sport
    ? `${sport} guidance`
    : childName
    ? `${childName}'s guidance`
    : "your guidance";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/[0.04]">
              {/* Close button */}
              <button
                onClick={onClose}
                id="login-modal-close"
                aria-label="Close modal"
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Header */}
              <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 ring-1 ring-orange-100">
                  <MessageCircle className="h-7 w-7 text-power-orange" />
                </div>

                <h2
                  id="login-modal-title"
                  className="text-lg font-bold text-slate-900 leading-snug"
                >
                  Log in to chat with your coach
                </h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Create a free account or log in to get personalized coaching
                  advice about {subjectLabel}.
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-100" />

              {/* Actions */}
              <div className="flex flex-col gap-3 px-6 py-5">
                <a
                  href={loginHref}
                  id="login-modal-login-btn"
                  className="flex items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.45)] transition-all hover:bg-orange-600 active:scale-[0.98]"
                >
                  <LogIn className="h-4 w-4" />
                  Log In
                </a>
                <a
                  href={registerHref}
                  id="login-modal-register-btn"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Free Account
                </a>
                <p className="text-center text-[11px] text-slate-400">
                  Your guidance and roadmap are always free — no account required.
                  <br />
                  Coaching chat requires a free account.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
