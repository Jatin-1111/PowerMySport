"use client";

import type { IPayoutMethod, PayoutMethodType } from "@/types";
import { CreditCard, FileText, Landmark, Smartphone } from "lucide-react";

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
  v: TaxPayoutInfoValue,
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

const field =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100";
const label =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const card =
  "rounded-2xl border-0 bg-white p-6 shadow-[0_2px_16px_rgb(0,0,0,0.06)] dark:bg-slate-900 sm:p-8";

function SectionHeading({
  icon: Icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  tint: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function TaxPayoutInfoStep({
  value,
  onChange,
}: {
  value: TaxPayoutInfoValue;
  onChange: (patch: Partial<TaxPayoutInfoValue>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className={card}>
        <SectionHeading
          icon={FileText}
          tint="bg-indigo-50 text-indigo-600"
          title="Tax Details"
          subtitle="Required for session-fee payouts and tax reporting"
        />
        <div className="space-y-4">
          <div>
            <label className={label}>
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              className={field}
              placeholder="e.g. ABCDE1234F"
              value={value.panNumber}
              maxLength={10}
              onChange={(e) =>
                onChange({ panNumber: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div>
            <label className={label}>GST Number (optional)</label>
            <input
              className={field}
              placeholder="e.g. 22AAAAA0000A1Z5"
              value={value.gstNumber}
              maxLength={15}
              onChange={(e) =>
                onChange({ gstNumber: e.target.value.toUpperCase() })
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Only if you&apos;re GST-registered — most individual experts
              can leave this blank.
            </p>
          </div>
        </div>
      </div>

      <div className={card}>
        <SectionHeading
          icon={Landmark}
          tint="bg-emerald-50 text-emerald-600"
          title="Payout Method"
          subtitle="Where your session earnings will be sent"
        />

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["BANK_TRANSFER", "UPI"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ payoutType: type })}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all ${
                value.payoutType === type
                  ? "border-power-orange bg-power-orange/10 text-power-orange"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-power-orange/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {type === "BANK_TRANSFER" ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {type === "BANK_TRANSFER" ? "Bank Transfer" : "UPI"}
            </button>
          ))}
        </div>

        {value.payoutType === "BANK_TRANSFER" ? (
          <div className="space-y-4">
            <div>
              <label className={label}>
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <input
                className={field}
                placeholder="As per bank records"
                value={value.accountHolderName}
                onChange={(e) => onChange({ accountHolderName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  className={field}
                  value={value.accountNumber}
                  onChange={(e) => onChange({ accountNumber: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>
                  Confirm Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  className={field}
                  value={value.confirmAccountNumber}
                  onChange={(e) =>
                    onChange({ confirmAccountNumber: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  className={field}
                  placeholder="e.g. SBIN0001234"
                  value={value.ifscCode}
                  onChange={(e) =>
                    onChange({ ifscCode: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <label className={label}>
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={field}
                  value={value.bankName}
                  onChange={(e) => onChange({ bankName: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className={label}>
              UPI ID <span className="text-red-500">*</span>
            </label>
            <input
              className={field}
              placeholder="e.g. yourname@okaxis"
              value={value.upiId}
              onChange={(e) => onChange({ upiId: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
