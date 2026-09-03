"use client";

import { Checkbox } from "../../../shared/ui/Checkbox";
import { Input } from "../../../shared/ui/Input";
import { Textarea } from "../../../shared/ui/Textarea";
import { toast } from "@/lib/toast";
import type {
  AcademyPayoutFrequency,
  AcademyStep6Payload,
} from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Step6PayoutsProps {
  academyId: string;
  onSubmit: (data: AcademyStep6Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep6Payload;
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

    // Must provide at least one payment method
    if (!hasBankDetails && !hasUpi) {
      errors.paymentMethod = "Please provide either a bank account or UPI ID for payouts";
    }

    // If any bank field is filled, validate all bank fields
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

    // If UPI is provided, validate format
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
      toast.error("Fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AcademyStep6Payload = {
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
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 6: Payouts & Policies</h2>
        <p className="text-slate-600">Final step - Set up your payment details and policies</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment method error */}
        {fieldErrors.paymentMethod && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{fieldErrors.paymentMethod}</p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indigo-600" />
          <p className="text-sm text-blue-900">
            Provide either a <strong>bank account</strong> or <strong>UPI ID</strong> (or both) for
            receiving payouts.
          </p>
        </div>

        {/* Bank Account Section */}
        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <legend className="mb-4 text-base font-bold text-slate-900">Bank Account Details</legend>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.bankAccountName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bankAccountName: e.target.value,
                }))
              }
              placeholder="As per your bank records"
              disabled={isSubmitting}
              className={fieldErrors.bankAccountName ? "border-red-300 bg-red-50" : ""}
            />
            {fieldErrors.bankAccountName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.bankAccountName}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Account Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.bankAccountNumber}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bankAccountNumber: e.target.value.replace(/\D/g, ""),
                }))
              }
              placeholder="1234567890123456"
              disabled={isSubmitting}
              className={fieldErrors.bankAccountNumber ? "border-red-300 bg-red-50" : ""}
            />
            {fieldErrors.bankAccountNumber && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.bankAccountNumber}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.bankIfsc}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bankIfsc: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g. SBIN0001234"
              maxLength={11}
              disabled={isSubmitting}
              className={fieldErrors.bankIfsc ? "border-red-300 bg-red-50" : ""}
            />
            <p className="mt-1 text-xs text-slate-500">Format: 4 letters + 0 + 6 alphanumeric</p>
            {fieldErrors.bankIfsc && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.bankIfsc}</p>
            )}
          </div>
        </fieldset>

        {/* UPI Optional */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            UPI ID{" "}
            <span className="text-xs font-normal text-slate-500">
              (optional if bank account provided)
            </span>
          </label>
          <Input
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
                  paymentMethod: "",
                }));
            }}
            placeholder="username@upi"
            disabled={isSubmitting}
            className={fieldErrors.upiId ? "border-red-300 bg-red-50" : ""}
          />
          <p className="mt-1 text-xs text-slate-500">Format: name@bankname (e.g., john@okaxis)</p>
          {fieldErrors.upiId && <p className="mt-1 text-xs text-red-600">{fieldErrors.upiId}</p>}
        </div>

        {/* Payout Frequency */}
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
            className="focus:ring-power-orange h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
            disabled={isSubmitting}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Policies Section */}
        <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <legend className="mb-4 text-base font-bold text-slate-900">Policies</legend>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Cancellation Policy <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={formData.cancellationPolicy}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  cancellationPolicy: e.target.value,
                }))
              }
              placeholder="Describe your cancellation policy (e.g., 24 hours before session)"
              rows={3}
              disabled={isSubmitting}
              className={fieldErrors.cancellationPolicy ? "border-red-300 bg-red-50" : ""}
            />
            {fieldErrors.cancellationPolicy && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.cancellationPolicy}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Refund Policy <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={formData.refundPolicy}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  refundPolicy: e.target.value,
                }))
              }
              placeholder="Describe your refund policy"
              rows={3}
              disabled={isSubmitting}
              className={fieldErrors.refundPolicy ? "border-red-300 bg-red-50" : ""}
            />
            {fieldErrors.refundPolicy && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.refundPolicy}</p>
            )}
          </div>
        </fieldset>

        {/* Terms Agreement */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="mb-3 text-sm text-blue-900">
            PowerMySport charges a platform commission of <strong>15% of your listed fee</strong> on
            every completed booking made through the Platform (plus GST on the commission). There is
            no joining or listing fee. Full details are in the{" "}
            <Link
              href="/partner-terms"
              target="_blank"
              className="text-orange-600 underline hover:no-underline"
            >
              Partner Terms
            </Link>
            .
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={formData.agreedToTerms}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  agreedToTerms: checked as boolean,
                }))
              }
              disabled={isSubmitting}
              className="mt-1"
            />
            <span className="text-sm text-blue-900">
              I agree to the{" "}
              <Link
                href="/partner-terms"
                target="_blank"
                className="text-orange-600 underline hover:no-underline"
              >
                Partner Terms (Experts &amp; Academies)
              </Link>
              , including the 15% platform commission, and the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-orange-600 underline hover:no-underline"
              >
                Terms of Service
              </Link>
              . I confirm all information provided is accurate.
            </span>
          </label>
          {fieldErrors.agreedToTerms && (
            <p className="mt-2 text-xs text-red-600">{fieldErrors.agreedToTerms}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button type="button" onClick={onBack} variant="outline" disabled={isSubmitting}>
              Back
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSubmitting || loading} fullWidth>
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </div>
  );
}
