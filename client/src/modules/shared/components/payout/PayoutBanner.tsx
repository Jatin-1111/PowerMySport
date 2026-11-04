"use client";

import { IPayoutMethod } from "@/types";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface PayoutBannerProps {
  /** Null = no method set up, undefined = still fetching */
  payoutMethod: IPayoutMethod | null | undefined;
  /** Path to the payout settings page */
  payoutHref: string;
  /** Text of the link to the payout settings page */
  ctaLabel?: string;
}

/**
 * A quiet notice that payouts are not set up yet. It is a single line with a
 * text link, not a card with a button, because it sits above every page of the
 * console and must not compete with the page's own primary action. It goes
 * away once a method exists, or when dismissed.
 */
export function PayoutBanner({
  payoutMethod,
  payoutHref,
  ctaLabel = "Set up payouts",
}: PayoutBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Still loading, a method exists, or the user dismissed it.
  if (payoutMethod !== null || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Payout setup"
      className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 py-3 pl-4 pr-2"
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-amber-800"
      />
      <p className="min-w-0 flex-1 text-pretty text-sm leading-relaxed text-amber-900">
        <span className="font-semibold">Payouts are not set up.</span> Add a bank account or UPI ID
        so earnings from bookings reach you.{" "}
        <Link
          href={payoutHref}
          className="rounded-sm font-semibold underline decoration-amber-900/40 underline-offset-4 transition-colors duration-200 hover:decoration-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
        >
          {ctaLabel}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss payout notice"
        className="-my-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-amber-800 transition-colors duration-200 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
