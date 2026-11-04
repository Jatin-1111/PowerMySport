"use client";

import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from "@/modules/shared/components/settings/ProfileSection";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import type { IPayoutMethod, PayoutMethodType } from "@/types";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Everything the add and edit form holds. Account numbers are kept twice so they can be checked. */
export interface PayoutDraft {
  type: PayoutMethodType;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string;
}

export const emptyDraft = (): PayoutDraft => ({
  type: "BANK_TRANSFER",
  accountHolderName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  bankName: "",
  upiId: "",
});

export const draftFrom = (method: IPayoutMethod): PayoutDraft =>
  method.type === "BANK_TRANSFER"
    ? {
        ...emptyDraft(),
        type: "BANK_TRANSFER",
        accountHolderName: method.accountHolderName ?? "",
        accountNumber: method.accountNumber ?? "",
        confirmAccountNumber: method.accountNumber ?? "",
        ifscCode: method.ifscCode ?? "",
        bankName: method.bankName ?? "",
      }
    : { ...emptyDraft(), type: "UPI", upiId: method.upiId ?? "" };

/** The first thing wrong with the draft, in words, or null when it can be saved. */
export const validateDraft = (draft: PayoutDraft): string | null => {
  if (draft.type === "BANK_TRANSFER") {
    if (!draft.accountHolderName.trim()) return "Account holder name is required";
    if (!draft.accountNumber.trim()) return "Account number is required";
    if (draft.accountNumber !== draft.confirmAccountNumber) return "Account numbers don't match";
    if (!draft.ifscCode.trim()) return "IFSC code is required";
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(draft.ifscCode.trim())) {
      return "Invalid IFSC code format (e.g. SBIN0001234)";
    }
    if (!draft.bankName.trim()) return "Bank name is required";
    return null;
  }
  if (!draft.upiId.trim()) return "UPI ID is required";
  if (!/^[\w.\-+]+@[\w]+$/.test(draft.upiId.trim())) {
    return "Invalid UPI ID format (e.g. yourname@okaxis)";
  }
  return null;
};

/** The fields the API stores for this draft. Callers add `isDefault` where they need it. */
export const draftPayload = (draft: PayoutDraft) =>
  draft.type === "BANK_TRANSFER"
    ? {
        type: "BANK_TRANSFER" as const,
        accountHolderName: draft.accountHolderName.trim(),
        accountNumber: draft.accountNumber.trim(),
        ifscCode: draft.ifscCode.trim().toUpperCase(),
        bankName: draft.bankName.trim(),
      }
    : { type: "UPI" as const, upiId: draft.upiId.trim() };

export const maskAccountNumber = (num: string) =>
  num.length > 4 ? "•".repeat(num.length - 4) + num.slice(-4) : num;

export const methodLabel = (type: PayoutMethodType) =>
  type === "BANK_TRANSFER" ? "Bank transfer" : "UPI";

/** A saved method as label and value rows, with the account number masked. */
export const methodFacts = (method: IPayoutMethod): Array<{ label: string; value: string }> =>
  method.type === "BANK_TRANSFER"
    ? [
        { label: "Account holder", value: method.accountHolderName || "" },
        { label: "Account number", value: maskAccountNumber(method.accountNumber || "") },
        { label: "Bank", value: [method.bankName, method.ifscCode].filter(Boolean).join(", ") },
      ]
    : [{ label: "UPI ID", value: method.upiId || "" }];

const TYPES = [
  { label: "Bank transfer", value: "BANK_TRANSFER" as const },
  { label: "UPI", value: "UPI" as const },
];

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
      {hint && <p className={FIELD_HINT}>{hint}</p>}
    </div>
  );
}

/** An account number box that hides its digits until asked. */
function SecretInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${FIELD_INPUT} pr-12 font-mono tabular-nums tracking-widest`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide account number" : "Show account number"}
        aria-pressed={shown}
        className="text-ink-body hover:text-ink focus-visible:ring-ink absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
      >
        {shown ? (
          <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Eye size={18} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * The add and edit form for one payout method: bank transfer or UPI, then that
 * method's fields. `idPrefix` keeps ids unique if two forms are ever on a page.
 * Validation lives in `validateDraft`; nothing is checked here.
 */
export function PayoutFields({
  draft,
  onChange,
  disabled,
  idPrefix = "payout",
}: {
  draft: PayoutDraft;
  onChange: (next: PayoutDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const set = <K extends keyof PayoutDraft>(key: K, value: PayoutDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-6">
      <UnderlineFilter
        label="Payout method type"
        value={draft.type}
        onChange={(type) => set("type", type)}
        items={TYPES}
      />

      {draft.type === "BANK_TRANSFER" ? (
        <div className="max-w-xl space-y-5">
          <Field
            id={`${idPrefix}-holder`}
            label="Account holder name"
            hint="As it appears in your bank records."
          >
            <input
              id={`${idPrefix}-holder`}
              type="text"
              autoComplete="off"
              value={draft.accountHolderName}
              onChange={(e) => set("accountHolderName", e.target.value)}
              disabled={disabled}
              className={FIELD_INPUT}
            />
          </Field>
          <Field id={`${idPrefix}-number`} label="Account number">
            <SecretInput
              id={`${idPrefix}-number`}
              value={draft.accountNumber}
              onChange={(v) => set("accountNumber", v)}
              disabled={disabled}
            />
          </Field>
          <Field id={`${idPrefix}-confirm`} label="Confirm account number">
            <SecretInput
              id={`${idPrefix}-confirm`}
              value={draft.confirmAccountNumber}
              onChange={(v) => set("confirmAccountNumber", v)}
              disabled={disabled}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={`${idPrefix}-ifsc`}
              label="IFSC code"
              hint="Four letters, a zero, then six letters or digits."
            >
              <input
                id={`${idPrefix}-ifsc`}
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={11}
                value={draft.ifscCode}
                onChange={(e) => set("ifscCode", e.target.value.toUpperCase())}
                disabled={disabled}
                className={`${FIELD_INPUT} font-mono uppercase tracking-wider`}
              />
            </Field>
            <Field id={`${idPrefix}-bank`} label="Bank name">
              <input
                id={`${idPrefix}-bank`}
                type="text"
                autoComplete="off"
                value={draft.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                disabled={disabled}
                className={FIELD_INPUT}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="max-w-xl space-y-3">
          <Field
            id={`${idPrefix}-upi`}
            label="UPI ID"
            hint="For example name@okaxis. We only use it to send your earnings, and it is stored encrypted."
          >
            <input
              id={`${idPrefix}-upi`}
              type="text"
              autoCapitalize="none"
              autoComplete="off"
              value={draft.upiId}
              onChange={(e) => set("upiId", e.target.value)}
              disabled={disabled}
              className={FIELD_INPUT}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
