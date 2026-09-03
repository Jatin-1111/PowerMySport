"use client";

import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";
import { toast } from "@/lib/toast";
import type {
  AcademyPayoutFrequency,
  AcademyStep7Payload,
} from "@/modules/onboarding/types/academy";

interface Step6PayoutsProps {
  academyId: string;
  onSubmit: (data: AcademyStep7Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep7Payload;
}

export default function Step6Payouts({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step6PayoutsProps) {
  const [formData, setFormData] = useState({
    bankAccountName: previousData?.bankAccountName || "",
    bankAccountNumber: previousData?.bankAccountNumber || "",
    bankIfsc: previousData?.bankIfsc || "",
    upiId: previousData?.upiId || "",
    payoutFrequency: (previousData?.payoutFrequency || "monthly") as AcademyPayoutFrequency,
    cancellationPolicy: previousData?.cancellationPolicy || "",
    refundPolicy: previousData?.refundPolicy || "",
    agreedToTerms: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const hasBankDetails =
      formData.bankAccountNumber || formData.bankIfsc || formData.bankAccountName;
    const hasUpi = formData.upiId.trim();

    if (!hasBankDetails && !hasUpi) {
      errors.paymentMethod = "Please provide either a bank account or UPI ID for payouts";
    }

    if (hasBankDetails) {
      if (formData.bankAccountName.trim().length < 3) {
        errors.bankAccountName = "Account holder name is required (min 3 characters)";
      }
      if (!/^\d{9,18}$/.test(formData.bankAccountNumber)) {
        errors.bankAccountNumber = "Invalid account number (9-18 digits)";
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bankIfsc)) {
        errors.bankIfsc = "Invalid IFSC code (e.g., SBIN0001234)";
      }
    }

    if (hasUpi && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(formData.upiId.trim())) {
      errors.upiId = "Invalid UPI ID format (e.g., name@upi)";
    }

    if (formData.cancellationPolicy.trim().length < 10) {
      errors.cancellationPolicy = "Please provide a clear cancellation policy (min 10 characters)";
    }
    if (formData.refundPolicy.trim().length < 10) {
      errors.refundPolicy = "Please provide a clear refund policy (min 10 characters)";
    }
    if (!formData.agreedToTerms) {
      errors.agreedToTerms = "You must agree to the terms and conditions";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AcademyStep7Payload = {
        academyId,
        bankAccountName: formData.bankAccountName.trim(),
        bankAccountNumber: formData.bankAccountNumber,
        bankIfsc: formData.bankIfsc,
        upiId: formData.upiId.trim(),
        payoutFrequency: formData.payoutFrequency,
        cancellationPolicy: formData.cancellationPolicy.trim(),
        refundPolicy: formData.refundPolicy.trim(),
      };
      await onSubmit(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save payouts");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 7: Payouts & Policies</h2>
        <p className="text-slate-600">Final step - Set up your payment details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {fieldErrors.paymentMethod && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{fieldErrors.paymentMethod}</p>
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            💡 Provide either a <strong>bank account</strong> or <strong>UPI ID</strong> (or both)
            for receiving payouts.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-4 font-semibold text-slate-900">Bank Account</h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.bankAccountName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bankAccountName: e.target.value,
                  }))
                }
                className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                  fieldErrors.bankAccountName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.bankAccountName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.bankAccountName}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.bankAccountNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bankAccountNumber: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="1234567890123456"
                className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                  fieldErrors.bankAccountNumber
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.bankAccountNumber && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.bankAccountNumber}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                IFSC Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.bankIfsc}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    bankIfsc: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="SBIN0001234"
                className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
                  fieldErrors.bankIfsc ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.bankIfsc && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.bankIfsc}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            UPI ID{" "}
            <span className="text-xs font-normal text-slate-500">
              (optional if bank account provided)
            </span>
          </label>
          <input
            type="text"
            value={formData.upiId}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                upiId: e.target.value.toLowerCase(),
              }));
              if (fieldErrors.upiId)
                setFieldErrors((prev) => ({
                  ...prev,
                  upiId: "",
                }));
            }}
            placeholder="username@upi"
            className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
              fieldErrors.upiId ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.upiId && <p className="mt-1 text-xs text-red-600">{fieldErrors.upiId}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Payout Frequency <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.payoutFrequency}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                payoutFrequency: e.target.value as AcademyPayoutFrequency,
              }))
            }
            className="focus:ring-power-orange w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:outline-none"
            disabled={isSubmitting}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Cancellation Policy <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.cancellationPolicy}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cancellationPolicy: e.target.value,
              }))
            }
            placeholder="Describe your cancellation policy (e.g., 24 hours before session)"
            rows={3}
            className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
              fieldErrors.cancellationPolicy
                ? "border-red-300 bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.cancellationPolicy && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.cancellationPolicy}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Refund Policy <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.refundPolicy}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                refundPolicy: e.target.value,
              }))
            }
            placeholder="Describe your refund policy"
            rows={3}
            className={`focus:ring-power-orange w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none ${
              fieldErrors.refundPolicy ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.refundPolicy && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.refundPolicy}</p>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={formData.agreedToTerms}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  agreedToTerms: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded"
              disabled={isSubmitting}
            />
            <span className="text-sm text-blue-900">
              I agree to PowerMySport Terms & Conditions and confirm all information is accurate
            </span>
          </label>
          {fieldErrors.agreedToTerms && (
            <p className="mt-2 text-xs text-red-600">{fieldErrors.agreedToTerms}</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button type="button" onClick={onBack} variant="outline" disabled={isSubmitting}>
              Back
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || loading} className="flex-1">
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </div>
  );
}
