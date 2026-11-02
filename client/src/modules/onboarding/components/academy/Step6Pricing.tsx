"use client";

import { toast } from "@/lib/toast";
import type { AcademyPricingPayload } from "@/modules/onboarding/types/academy";
import {
  BATCH_OPTIONS,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
  defaultPricing,
  isTimingTicked,
  pricingForSave,
  pricingFromSaved,
  toggleBatchTiming,
  trialPriceWarning,
  validatePricing,
  type PricingValues,
} from "@/modules/onboarding/utils/academyPricingRules";
import { paiseToInputText, parseRupeesInput } from "@/modules/onboarding/utils/money";
import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

interface Step6PricingProps {
  onSubmit: (data: AcademyPricingPayload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  /** Pricing already saved, so Back and resume do not lose it. */
  previousData?: AcademyPricingPayload;
}

const field =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:bg-slate-100";
const border = (hasError: boolean) => (hasError ? "border-red-300 bg-red-50" : "border-slate-300");

/**
 * Step 6 of academy sign-up: what the academy charges and how its batches run.
 * Amounts are typed in rupees and saved in paise. Subscription plans and session
 * packages are not asked for here: they are created from the academy's dashboard
 * after approval.
 */
export default function Step6Pricing({
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step6PricingProps) {
  const [values, setValues] = useState<PricingValues>(() =>
    previousData ? pricingFromSaved(previousData) : defaultPricing()
  );
  const [rateText, setRateText] = useState(() => paiseToInputText(values.ratePaise));
  const [trialText, setTrialText] = useState(() => paiseToInputText(values.trialPaise));
  const [batchText, setBatchText] = useState(() => String(values.maxBatchSize));
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isSubmitting || loading;
  const errors = validatePricing(values);
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);
  const warning = trialPriceWarning(values);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      toast.error("Please fix the pricing details before continuing");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(pricingForSave(values));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save pricing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-2 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 6: Pricing</h2>
        <p className="text-slate-600">What you charge, and how your batches run.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div>
          <label htmlFor="pricing-rate" className="mb-1 block text-sm font-semibold text-slate-900">
            Session rate per hour (₹)
          </label>
          <input
            id="pricing-rate"
            inputMode="decimal"
            className={`${field} ${border(Boolean(shown("rate")))}`}
            value={rateText}
            disabled={busy}
            placeholder="500"
            onChange={(e) => {
              setRateText(e.target.value);
              setValues((v) => ({ ...v, ratePaise: parseRupeesInput(e.target.value) }));
            }}
          />
          {shown("rate") && <p className="mt-1 text-xs text-red-600">{shown("rate")}</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-900">Batch timings</legend>
          <div className="space-y-2">
            {BATCH_OPTIONS.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={isTimingTicked(values.batchTimings, option.id)}
                  disabled={busy}
                  onChange={() =>
                    setValues((v) => ({
                      ...v,
                      batchTimings: toggleBatchTiming(v.batchTimings, option.id),
                    }))
                  }
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
          {shown("batchTimings") && (
            <p className="mt-2 text-xs text-red-600">{shown("batchTimings")}</p>
          )}
        </fieldset>

        <div>
          <label
            htmlFor="pricing-batch"
            className="mb-1 block text-sm font-semibold text-slate-900"
          >
            Largest batch (students)
          </label>
          <input
            id="pricing-batch"
            inputMode="numeric"
            className={`${field} ${border(Boolean(shown("maxBatchSize")))}`}
            value={batchText}
            disabled={busy}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, "").slice(0, 3);
              setBatchText(text);
              setValues((v) => ({ ...v, maxBatchSize: text ? Number(text) : 0 }));
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            A whole number from {MIN_BATCH_SIZE} to {MAX_BATCH_SIZE}.
          </p>
          {shown("maxBatchSize") && (
            <p className="mt-1 text-xs text-red-600">{shown("maxBatchSize")}</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={values.trialOffered}
              disabled={busy}
              onChange={(e) => setValues((v) => ({ ...v, trialOffered: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-900">Offer a trial session</span>
          </label>

          {values.trialOffered && (
            <div className="mt-3">
              <label
                htmlFor="pricing-trial"
                className="mb-1 block text-sm font-medium text-slate-900"
              >
                Trial session price (₹)
              </label>
              <input
                id="pricing-trial"
                inputMode="decimal"
                className={`${field} ${border(Boolean(shown("trialPrice")))}`}
                value={trialText}
                disabled={busy}
                placeholder="0"
                onChange={(e) => {
                  setTrialText(e.target.value);
                  setValues((v) => ({ ...v, trialPaise: parseRupeesInput(e.target.value) }));
                }}
              />
              <p className="mt-1 text-xs text-slate-600">
                Leave empty or enter 0 for a free trial.
              </p>
              {warning && <p className="mt-1 text-xs text-amber-700">{warning}</p>}
              {shown("trialPrice") && (
                <p className="mt-1 text-xs text-red-600">{shown("trialPrice")}</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            You can create subscription plans and session packages from your dashboard once your
            academy is approved.
          </p>
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
