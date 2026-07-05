"use client";

import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";
import { toast } from "@/lib/toast";
import type {
  AcademyBatchTiming,
  AcademyStep5Payload,
} from "@/modules/onboarding/types/academy";

interface Step5PricingProps {
  academyId: string;
  onSubmit: (data: AcademyStep5Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep5Payload;
}

export default function Step5Pricing({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step5PricingProps) {
  const [formData, setFormData] = useState({
    sessionRatePerHour: previousData?.sessionRatePerHour || 0, // in paise
    batchTimings: previousData?.batchTimings || ([] as AcademyBatchTiming[]),
    maxBatchSize: previousData?.maxBatchSize || 20,
    trialsessionOffered: previousData?.trialsessionOffered ?? false,
    trialSessionPrice: previousData?.trialSessionPrice || 0, // in paise
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.sessionRatePerHour || formData.sessionRatePerHour < 100) {
      // 100 paise = ₹1 minimum
      errors.sessionRatePerHour = "Rate must be at least ₹1 per hour";
    }
    if (formData.sessionRatePerHour > 1_000_000_00) {
      // ₹1,000,000 maximum
      errors.sessionRatePerHour = "Rate cannot exceed ₹10,00,000 per hour";
    }
    if (formData.batchTimings.length === 0) {
      errors.batchTimings = "Select at least one batch timing";
    }
    const batchSize = formData.maxBatchSize;
    if (!batchSize || isNaN(batchSize) || batchSize < 1 || batchSize > 100) {
      errors.maxBatchSize = "Batch size must be between 1 and 100";
    }
    if (
      formData.trialsessionOffered &&
      formData.trialSessionPrice !== undefined &&
      formData.trialSessionPrice < 0
    ) {
      errors.trialSessionPrice = "Trial session price cannot be negative";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toggleTiming = (timing: AcademyBatchTiming) => {
    setFormData((prev) => ({
      ...prev,
      batchTimings: prev.batchTimings.includes(timing)
        ? prev.batchTimings.filter((t) => t !== timing)
        : [...prev.batchTimings, timing],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before continuing");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        academyId,
        // Ensure trialSessionPrice is undefined if trial not offered
        trialSessionPrice: formData.trialsessionOffered
          ? formData.trialSessionPrice
          : undefined,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save pricing",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 5: Pricing & Subscriptions
        </h2>
        <p className="text-slate-600">Set your pricing structure</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session Rate */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Session Rate per Hour <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">₹</span>
            <input
              type="number"
              value={
                formData.sessionRatePerHour > 0
                  ? formData.sessionRatePerHour / 100
                  : ""
              }
              onChange={(e) => {
                const val = parseFloat(e.target.value || "0");
                setFormData((prev) => ({
                  ...prev,
                  sessionRatePerHour: isNaN(val) ? 0 : Math.round(val * 100),
                }));
                if (fieldErrors.sessionRatePerHour)
                  setFieldErrors((prev) => ({
                    ...prev,
                    sessionRatePerHour: "",
                  }));
              }}
              placeholder="500"
              min="1"
              step="1"
              className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                fieldErrors.sessionRatePerHour
                  ? "border-red-300 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
              disabled={isSubmitting}
            />
            <span className="text-sm text-slate-500">/hr</span>
          </div>
          {fieldErrors.sessionRatePerHour && (
            <p className="text-red-600 text-xs mt-1">
              {fieldErrors.sessionRatePerHour}
            </p>
          )}
        </div>

        {/* Batch Timings */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Batch Timings <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {[
              { id: "morning", label: "Morning (6 AM - 12 PM)" },
              { id: "evening", label: "Evening (3 PM - 9 PM)" },
              { id: "both", label: "Both" },
            ].map((timing) => (
              <label
                key={timing.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.batchTimings.includes(
                    timing.id as AcademyBatchTiming,
                  )}
                  onChange={() => toggleTiming(timing.id as AcademyBatchTiming)}
                  className="w-4 h-4 rounded"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-slate-700">{timing.label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.batchTimings && (
            <p className="text-red-600 text-xs mt-2">
              {fieldErrors.batchTimings}
            </p>
          )}
        </div>

        {/* Max Batch Size */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Max Batch Size <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.maxBatchSize || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setFormData((prev) => ({
                ...prev,
                maxBatchSize: isNaN(val) ? 0 : val,
              }));
              if (fieldErrors.maxBatchSize)
                setFieldErrors((prev) => ({ ...prev, maxBatchSize: "" }));
            }}
            min="1"
            max="100"
            placeholder="20"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
              fieldErrors.maxBatchSize
                ? "border-red-300 bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.maxBatchSize && (
            <p className="text-red-600 text-xs mt-1">
              {fieldErrors.maxBatchSize}
            </p>
          )}
        </div>

        {/* Trial Sessions */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={formData.trialsessionOffered}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  trialsessionOffered: e.target.checked,
                }))
              }
              className="w-4 h-4 rounded"
              disabled={isSubmitting}
            />
            <span className="font-medium text-slate-900">
              Offer Trial Sessions
            </span>
          </label>

          {formData.trialsessionOffered && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Trial Session Price
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">₹</span>
                <input
                  type="number"
                  value={formData.trialSessionPrice / 100}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      trialSessionPrice: Math.round(
                        parseFloat(e.target.value || "0") * 100,
                      ),
                    }))
                  }
                  placeholder="100"
                  min="0"
                  step="1"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Enter 0 for free trial
              </p>
            </div>
          )}
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <p className="text-sm text-blue-900">
            💡 You can create subscription plans and packages later from your
            dashboard.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Continue to Step 6"}
          </Button>
        </div>
      </form>
    </div>
  );
}
