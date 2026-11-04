"use client";

import type { IPayoutMethod, PayoutMethodType } from "@/types";
import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from "@/modules/shared/components/settings/ProfileSection";
import { cn } from "@/utils/cn";
import { useRef } from "react";

export interface TaxPayoutInfoValue {
  panNumber: string;
  gstNumber: string;
  payoutType: PayoutMethodType;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string;
}

export const EMPTY_TAX_PAYOUT_INFO: TaxPayoutInfoValue = {
  panNumber: "",
  gstNumber: "",
  payoutType: "BANK_TRANSFER",
  accountHolderName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  bankName: "",
  upiId: "",
};

// Kept identical to the equivalent regexes already enforced elsewhere in the
// app (PayoutMethodManagerV2.tsx for IFSC/UPI, Academy's Step3Legal.tsx for
// the stricter GST checksum format) so a value valid here stays valid there.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const UPI_REGEX = /^[\w.\-+]+@[\w]+$/;

export function validateTaxPayoutInfo(v: TaxPayoutInfoValue): string | null {
  const pan = v.panNumber.trim().toUpperCase();
  if (!pan) return "PAN number is required";
  if (!PAN_REGEX.test(pan)) return "Invalid PAN number format (e.g. ABCDE1234F)";

  const gst = v.gstNumber.trim().toUpperCase();
  if (gst && !GST_REGEX.test(gst)) return "Invalid GST number format";

  if (v.payoutType === "BANK_TRANSFER") {
    if (!v.accountHolderName.trim()) return "Account holder name is required";
    if (!v.accountNumber.trim()) return "Account number is required";
    if (v.accountNumber.trim() !== v.confirmAccountNumber.trim()) {
      return "Account numbers don't match";
    }
    if (!IFSC_REGEX.test(v.ifscCode.trim())) {
      return "Invalid IFSC code format (e.g. SBIN0001234)";
    }
    if (!v.bankName.trim()) return "Bank name is required";
  } else {
    if (!v.upiId.trim()) return "UPI ID is required";
    if (!UPI_REGEX.test(v.upiId.trim())) {
      return "Invalid UPI ID format (e.g. yourname@okaxis)";
    }
  }
  return null;
}

/** Projects only the fields relevant to the active payout type — never sends
 *  stale data left over from the other tab. */
export function buildPayoutMethodPayload(
  v: TaxPayoutInfoValue
): Omit<IPayoutMethod, "addedAt" | "updatedAt"> {
  return v.payoutType === "BANK_TRANSFER"
    ? {
        type: "BANK_TRANSFER",
        accountHolderName: v.accountHolderName.trim(),
        accountNumber: v.accountNumber.trim(),
        ifscCode: v.ifscCode.trim().toUpperCase(),
        bankName: v.bankName.trim(),
      }
    : {
        type: "UPI",
        upiId: v.upiId.trim(),
      };
}

const PAYOUT_TYPES = ["BANK_TRANSFER", "UPI"] as const;
const TYPE_LABEL = { BANK_TRANSFER: "Bank transfer", UPI: "UPI" } as const;

const ROW = "border-hairline border-t py-8";

/**
 * The tax details and payout method the expert gives before submitting. Two
 * ruled sections in the same column as the other steps, not two cards.
 */
export function TaxPayoutInfoStep({
  value,
  onChange,
}: {
  value: TaxPayoutInfoValue;
  onChange: (patch: Partial<TaxPayoutInfoValue>) => void;
}) {
  const payoutTypeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div>
      <section aria-labelledby="tax-heading" className="py-8">
        <h2 id="tax-heading" className="text-ink text-lg font-semibold">
          Tax details
        </h2>
        <p className="text-ink-body mt-1 max-w-[56ch] text-pretty text-sm">
          Required for session-fee payouts and tax reporting.
        </p>
        <div className="mt-6 max-w-2xl space-y-6">
          <div>
            <label htmlFor="tax-pan" className={FIELD_LABEL}>
              PAN number
            </label>
            <input
              id="tax-pan"
              autoCapitalize="characters"
              autoComplete="off"
              className={cn(FIELD_INPUT, "font-mono uppercase tracking-wider md:max-w-xs")}
              value={value.panNumber}
              maxLength={10}
              onChange={(e) => onChange({ panNumber: e.target.value.toUpperCase() })}
            />
            <p className={FIELD_HINT}>
              Five letters, four digits, one letter. For example, ABCDE1234F.
            </p>
          </div>
          <div>
            <label htmlFor="tax-gst" className={FIELD_LABEL}>
              GST number <span className="text-ink-body font-normal">(optional)</span>
            </label>
            <input
              id="tax-gst"
              autoCapitalize="characters"
              autoComplete="off"
              className={cn(FIELD_INPUT, "font-mono uppercase tracking-wider md:max-w-xs")}
              value={value.gstNumber}
              maxLength={15}
              onChange={(e) => onChange({ gstNumber: e.target.value.toUpperCase() })}
            />
            <p className={FIELD_HINT}>
              Only if you are GST-registered. Most individual experts can leave this blank.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="payout-heading" className={ROW}>
        <h2 id="payout-heading" className="text-ink text-lg font-semibold">
          Payout method
        </h2>
        <p className="text-ink-body mt-1 max-w-[56ch] text-pretty text-sm">
          Where your session earnings will be sent.
        </p>

        <div className="mt-6 max-w-2xl space-y-6">
          <div role="radiogroup" aria-label="Payout method type" className="flex flex-wrap gap-2">
            {PAYOUT_TYPES.map((type, idx) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={value.payoutType === type}
                tabIndex={value.payoutType === type ? 0 : -1}
                ref={(el) => {
                  payoutTypeRefs.current[idx] = el;
                }}
                onClick={() => onChange({ payoutType: type })}
                onKeyDown={(e) => {
                  if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
                    e.preventDefault();
                    const next = (idx + 1) % PAYOUT_TYPES.length;
                    onChange({ payoutType: PAYOUT_TYPES[next] });
                    payoutTypeRefs.current[next]?.focus();
                  }
                }}
                className={cn(
                  "focus-visible:ring-ink min-h-11 min-w-32 rounded-md border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  value.payoutType === type
                    ? "border-ink text-ink bg-white font-semibold"
                    : "border-ink/25 text-ink-body hover:border-ink"
                )}
              >
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>

          {value.payoutType === "BANK_TRANSFER" ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="payout-holder-name" className={FIELD_LABEL}>
                  Account holder name
                </label>
                <input
                  id="payout-holder-name"
                  autoComplete="name"
                  className={FIELD_INPUT}
                  value={value.accountHolderName}
                  onChange={(e) => onChange({ accountHolderName: e.target.value })}
                />
                <p className={FIELD_HINT}>As it appears in your bank records.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="payout-account-number" className={FIELD_LABEL}>
                    Account number
                  </label>
                  <input
                    id="payout-account-number"
                    inputMode="numeric"
                    autoComplete="off"
                    className={cn(FIELD_INPUT, "tabular-nums")}
                    value={value.accountNumber}
                    onChange={(e) => onChange({ accountNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="payout-confirm-account" className={FIELD_LABEL}>
                    Confirm account number
                  </label>
                  <input
                    id="payout-confirm-account"
                    inputMode="numeric"
                    autoComplete="off"
                    className={cn(FIELD_INPUT, "tabular-nums")}
                    value={value.confirmAccountNumber}
                    onChange={(e) => onChange({ confirmAccountNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="payout-ifsc" className={FIELD_LABEL}>
                    IFSC code
                  </label>
                  <input
                    id="payout-ifsc"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className={cn(FIELD_INPUT, "font-mono uppercase tracking-wider")}
                    value={value.ifscCode}
                    onChange={(e) => onChange({ ifscCode: e.target.value.toUpperCase() })}
                  />
                  <p className={FIELD_HINT}>For example, SBIN0001234.</p>
                </div>
                <div>
                  <label htmlFor="payout-bank-name" className={FIELD_LABEL}>
                    Bank name
                  </label>
                  <input
                    id="payout-bank-name"
                    className={FIELD_INPUT}
                    value={value.bankName}
                    onChange={(e) => onChange({ bankName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="payout-upi" className={FIELD_LABEL}>
                UPI ID
              </label>
              <input
                id="payout-upi"
                autoComplete="off"
                className={FIELD_INPUT}
                value={value.upiId}
                onChange={(e) => onChange({ upiId: e.target.value })}
              />
              <p className={FIELD_HINT}>For example, yourname@okaxis.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
