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
    <div className="animate-in fade-in slide-in-from-top-2 relative overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm duration-500">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <AlertTriangle size={20} className="text-amber-600" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">Payout method not set up</p>
          <p className="mt-0.5 text-sm text-amber-700">
            You&apos;re not set up to receive payouts yet. Add your bank account or UPI details so
            earnings from bookings reach you automatically.
          </p>
          <div className="mt-3">
            <Link
              href={payoutHref}
              className="bg-power-orange inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-amber-500/60 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
