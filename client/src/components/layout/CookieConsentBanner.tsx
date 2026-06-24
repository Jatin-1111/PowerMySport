"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pms-cookie-consent";

/**
 * One-time cookie notice banner.
 *
 * PowerMySport uses essential cookies only (auth, security) — see /cookies — so
 * this is an acknowledgement notice rather than a category-by-category consent
 * manager. Acceptance is stored in localStorage so it never shows again.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alreadyHandled = false;
    try {
      alreadyHandled = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // localStorage unavailable (e.g. privacy mode) — show the notice anyway.
    }

    if (alreadyHandled) return;

    // Small delay so the banner eases in after the page settles.
    const timer = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // Ignore write failures — worst case the banner shows again next visit.
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed bottom-0 right-0 z-[60] flex max-w-full justify-end p-4 sm:p-6"
          role="dialog"
          aria-modal="false"
          aria-label="Cookie notice"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 backdrop-blur-xl premium-shadow">
            {/* Soft brand glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-200/30 blur-3xl"
            />

            <div className="relative">
              {/* Header: icon + title + close */}
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-power-orange">
                  <Cookie className="h-5 w-5" />
                </span>
                <p className="flex-1 font-bold text-slate-900">We use cookies</p>
                <button
                  onClick={dismiss}
                  aria-label="Dismiss cookie notice"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
                </button>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-slate-600">
                We use essential cookies to keep you signed in and secure, plus
                anonymous analytics to see which pages help parents most—no ads,
                and no personal data. By continuing, you agree to our{" "}
                <Link
                  href="/cookies"
                  className="font-semibold text-power-orange underline-offset-2 hover:underline"
                >
                  Cookie Policy
                </Link>
                .
              </p>

              <div className="flex gap-2">
                <button
                  onClick={dismiss}
                  className="flex-1 rounded-xl bg-power-orange px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(233,115,22,0.55)] transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-2"
                >
                  Got it
                </button>
                <Link
                  href="/cookies"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
