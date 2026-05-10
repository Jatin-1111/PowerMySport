"use client";

import { IPayoutMethod } from "@/types";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface PayoutBannerProps {
  /** Null = not loaded yet, undefined = still fetching */
  payoutMethod: IPayoutMethod | null | undefined;
  /** Path to the payout settings page */
  payoutHref: string;
  /** Display name for the CTA */
  ctaLabel?: string;
}

/**
 * Shows a prominent animated warning banner when the user hasn't set up a
 * payout method. Disappears once the method is configured.
 */
export function PayoutBanner({
  payoutMethod,
  payoutHref,
  ctaLabel = "Set Up Payouts",
}: PayoutBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Still loading or method exists or user dismissed
  if (payoutMethod !== null || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-900/30 via-amber-800/20 to-orange-900/20 p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-400/5" />

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
          <AlertTriangle size={20} className="text-amber-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-300">
            Payout method not set up
          </p>
          <p className="mt-0.5 text-xs text-amber-400/80">
            You&apos;re not set up to receive payouts yet. Add your bank account
            or UPI details so earnings from bookings reach you automatically.
          </p>
          <div className="mt-3">
            <Link
              href={payoutHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-400 transition-colors"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
