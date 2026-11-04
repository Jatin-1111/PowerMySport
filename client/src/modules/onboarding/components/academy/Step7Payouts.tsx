"use client";

import { toast } from "@/lib/toast";
import type { AcademyPayoutsPayload } from "@/modules/onboarding/types/academy";
import {
  MAX_POLICY_LENGTH,
  PAYOUT_FREQUENCIES,
  accountEnding,
  cleanAccountNumber,
  cleanIfsc,
  emptyPayouts,
  payoutsForSave,
  payoutsFromSaved,
  validatePayouts,
  type PayoutErrors,
  type PayoutValues,
} from "@/modules/onboarding/utils/academyPayoutRules";
import { Button } from "@/modules/shared/ui/Button";
import Link from "next/link";
import { useState } from "react";

interface Step7PayoutsProps {
  onSubmit: (data: AcademyPayoutsPayload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  /**
   * What was saved before. Only the frequency and the policies come back; bank
   * details are never shown again and the terms are agreed again.
   */
  previousData?: Pick<
    AcademyPayoutsPayload,
    "payoutFrequency" | "cancellationPolicy" | "refundPolicy"
  >;
  /** True when payout details were saved earlier, so the form can say why the fields are empty. */
  payoutDetailsSaved?: boolean;
}

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:bg-slate-100";
const border = (hasError: boolean) => (hasError ? "border-red-300 bg-red-50" : "border-slate-300");
const label = "mb-1 block text-sm font-semibold text-slate-900";

/**
 * Step 7 of academy sign-up, the last: where payouts go, the academy's own
 * cancellation and refund policies, and agreement to the Partner Terms.
 * A bank account (typed twice), a UPI ID, or both. Bank details are checked
 * here with the same rules as the server and are never shown back in full.
 */
export default function Step7Payouts({
  onSubmit,
  loading = false,
  onBack,
  previousData,
  payoutDetailsSaved = false,
}: Step7PayoutsProps) {
  const [values, setValues] = useState<PayoutValues>(() =>
    previousData ? payoutsFromSaved(previousData) : emptyPayouts()
  );
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isSubmitting || loading;
  const errors = validatePayouts(values);
  const shown = (key: keyof PayoutErrors) => (showErrors ? errors[key] : undefined);
  const set = (patch: Partial<PayoutValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      toast.error("Please fix the details before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payoutsForSave(values));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save payout details");
    } finally {
      setIsSubmitting(false);
    }
  };

  const matched =
    values.accountNumber.length >= 9 && values.accountNumber === values.accountNumberConfirm;

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-2 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 7: Payouts and terms</h2>
        <p className="text-slate-600">Where we send your earnings, and your policies.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            Add a <strong>bank account</strong>, a <strong>UPI ID</strong>, or both.
            {payoutDetailsSaved &&
              " For your security we do not show saved payout details again, so enter them again to continue."}
          </p>
        </div>

        {shown("method") && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {shown("method")}
          </p>
        )}

        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-slate-900">Bank account</legend>

          <div>
            <label htmlFor="payout-name" className={label}>
              Account holder name
            </label>
            <input
              id="payout-name"
              autoComplete="off"
              className={`${field} ${border(Boolean(shown("accountName")))}`}
              value={values.accountName}
              disabled={busy}
              onChange={(e) => set({ accountName: e.target.value })}
            />
            {shown("accountName") && (
              <p className="mt-1 text-xs text-red-600">{shown("accountName")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="payout-number" className={label}>
                Account number
              </label>
              <input
                id="payout-number"
                inputMode="numeric"
                autoComplete="off"
                className={`${field} ${border(Boolean(shown("accountNumber")))}`}
                value={values.accountNumber}
                disabled={busy}
                onChange={(e) => set({ accountNumber: cleanAccountNumber(e.target.value) })}
              />
              {shown("accountNumber") && (
                <p className="mt-1 text-xs text-red-600">{shown("accountNumber")}</p>
              )}
            </div>
            <div>
              <label htmlFor="payout-number-confirm" className={label}>
                Confirm account number
              </label>
              <input
                id="payout-number-confirm"
                inputMode="numeric"
                autoComplete="off"
                className={`${field} ${border(Boolean(shown("accountNumberConfirm")))}`}
                value={values.accountNumberConfirm}
                disabled={busy}
                // Typed again on purpose: pasting would copy a mistake across.
                onPaste={(e) => e.preventDefault()}
                onChange={(e) => set({ accountNumberConfirm: cleanAccountNumber(e.target.value) })}
              />
              {shown("accountNumberConfirm") ? (
                <p className="mt-1 text-xs text-red-600">{shown("accountNumberConfirm")}</p>
              ) : matched ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Matches, {accountEnding(values.accountNumber)}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="payout-ifsc" className={label}>
              IFSC code
            </label>
            <input
              id="payout-ifsc"
              autoComplete="off"
              maxLength={11}
              className={`${field} ${border(Boolean(shown("ifsc")))}`}
              value={values.ifsc}
              disabled={busy}
              placeholder="SBIN0001234"
              onChange={(e) => set({ ifsc: cleanIfsc(e.target.value) })}
            />
            {shown("ifsc") && <p className="mt-1 text-xs text-red-600">{shown("ifsc")}</p>}
          </div>
        </fieldset>

        <div>
          <label htmlFor="payout-upi" className={label}>
            UPI ID
          </label>
          <input
            id="payout-upi"
            autoComplete="off"
            className={`${field} ${border(Boolean(shown("upi")))}`}
            value={values.upi}
            disabled={busy}
            placeholder="name@okhdfcbank"
            onChange={(e) => set({ upi: e.target.value })}
          />
          {shown("upi") && <p className="mt-1 text-xs text-red-600">{shown("upi")}</p>}
        </div>

        <div>
          <label htmlFor="payout-frequency" className={label}>
            How often should we pay you?
          </label>
          <select
            id="payout-frequency"
            className={`${field} border-slate-300`}
            value={values.frequency}
            disabled={busy}
            onChange={(e) => set({ frequency: e.target.value as PayoutValues["frequency"] })}
          >
            {PAYOUT_FREQUENCIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {(
          [
            {
              id: "payout-cancellation",
              key: "cancellationPolicy",
              title: "Cancellation policy",
              hint: "For example: Cancel at least 24 hours before a session for a full refund.",
            },
            {
              id: "payout-refund",
              key: "refundPolicy",
              title: "Refund policy",
              hint: "For example: Refunds are processed within seven days of cancellation.",
            },
          ] as const
        ).map((policy) => (
          <div key={policy.id}>
            <label htmlFor={policy.id} className={label}>
              {policy.title}
            </label>
            <textarea
              id={policy.id}
              rows={3}
              className={`${field} ${border(Boolean(shown(policy.key)))}`}
              value={values[policy.key]}
              disabled={busy}
              placeholder={policy.hint}
              onChange={(e) => set({ [policy.key]: e.target.value } as Partial<PayoutValues>)}
            />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-red-600">{shown(policy.key)}</span>
              <span className="text-slate-500">
                {values[policy.key].length} / {MAX_POLICY_LENGTH}
              </span>
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded"
              checked={values.agreed}
              disabled={busy}
              onChange={(e) => set({ agreed: e.target.checked })}
            />
            <span className="text-sm text-slate-800">
              I have read and agree to the{" "}
              <Link
                href="/partner-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Partner Terms
              </Link>
              .
            </span>
          </label>
          {shown("terms") && <p className="mt-2 text-xs text-red-600">{shown("terms")}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={isSubmitting} disabled={busy}>
            Save and continue
          </Button>
        </div>
      </form>
    </div>
  );
}
