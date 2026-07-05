"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type {
  AcademyPayoutFrequency,
  AcademyStep6Payload,
} from "@/modules/onboarding/types/academy";

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
    payoutFrequency: (previousData?.payoutFrequency ||
      "monthly") as AcademyPayoutFrequency,
    cancellationPolicy: previousData?.cancellationPolicy || "",
    refundPolicy: previousData?.refundPolicy || "",
    agreedToTerms: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const hasBankDetails =
      formData.bankAccountNumber ||
      formData.bankIfsc ||
      formData.bankAccountName;
    const hasUpi = formData.upiId.trim();

    // Must provide at least one payment method
    if (!hasBankDetails && !hasUpi) {
      errors.paymentMethod =
        "Please provide either a bank account or UPI ID for payouts";
    }

    // If any bank field is filled, validate all bank fields
    if (hasBankDetails) {
      if (formData.bankAccountName.trim().length < 3) {
        errors.bankAccountName =
          "Account holder name is required (min 3 characters)";
      }
      if (!/^\d{9,18}$/.test(formData.bankAccountNumber)) {
        errors.bankAccountNumber = "Invalid account number (9-18 digits)";
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bankIfsc)) {
        errors.bankIfsc = "Invalid IFSC code (e.g., SBIN0001234)";
      }
    }

    // If UPI is provided, validate format
    if (
      hasUpi &&
      !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(formData.upiId.trim())
    ) {
      errors.upiId = "Invalid UPI ID format (e.g., name@upi)";
    }

    if (formData.cancellationPolicy.trim().length < 10) {
      errors.cancellationPolicy =
        "Please provide a clear cancellation policy (min 10 characters)";
    }
    if (formData.refundPolicy.trim().length < 10) {
      errors.refundPolicy =
        "Please provide a clear refund policy (min 10 characters)";
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
      toast.error(
        error instanceof Error ? error.message : "Failed to save payouts",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 6: Payouts & Policies
        </h2>
        <p className="text-slate-600">
          Final step - Set up your payment details and policies
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment method error */}
        {fieldErrors.paymentMethod && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-red-700 text-sm">{fieldErrors.paymentMethod}</p>
          </div>
        )}

        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <CheckCircle2 size={18} className="text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-blue-900 text-sm">
            Provide either a <strong>bank account</strong> or{" "}
            <strong>UPI ID</strong> (or both) for receiving payouts.
          </p>
        </div>

        {/* Bank Account Section */}
        <fieldset className="rounded-lg bg-slate-50 p-6 border border-slate-200 space-y-4">
          <legend className="text-base font-bold text-slate-900 mb-4">
            Bank Account Details
          </legend>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
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
              className={
                fieldErrors.bankAccountName ? "border-red-300 bg-red-50" : ""
              }
            />
            {fieldErrors.bankAccountName && (
              <p className="text-red-600 text-xs mt-1">
                {fieldErrors.bankAccountName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
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
              className={
                fieldErrors.bankAccountNumber ? "border-red-300 bg-red-50" : ""
              }
            />
            {fieldErrors.bankAccountNumber && (
              <p className="text-red-600 text-xs mt-1">
                {fieldErrors.bankAccountNumber}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
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
            <p className="text-xs text-slate-500 mt-1">
              Format: 4 letters + 0 + 6 alphanumeric
            </p>
            {fieldErrors.bankIfsc && (
              <p className="text-red-600 text-xs mt-1">
                {fieldErrors.bankIfsc}
              </p>
            )}
          </div>
        </fieldset>

        {/* UPI Optional */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
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
          <p className="text-xs text-slate-500 mt-1">
            Format: name@bankname (e.g., john@okaxis)
          </p>
          {fieldErrors.upiId && (
            <p className="text-red-600 text-xs mt-1">{fieldErrors.upiId}</p>
          )}
        </div>

        {/* Payout Frequency */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
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
            className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-2"
            disabled={isSubmitting}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Policies Section */}
        <fieldset className="rounded-lg bg-slate-50 p-6 border border-slate-200 space-y-4">
          <legend className="text-base font-bold text-slate-900 mb-4">
            Policies
          </legend>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
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
              className={
                fieldErrors.cancellationPolicy ? "border-red-300 bg-red-50" : ""
              }
            />
            {fieldErrors.cancellationPolicy && (
              <p className="text-red-600 text-xs mt-1">
                {fieldErrors.cancellationPolicy}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
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
              className={
                fieldErrors.refundPolicy ? "border-red-300 bg-red-50" : ""
              }
            />
            {fieldErrors.refundPolicy && (
              <p className="text-red-600 text-xs mt-1">
                {fieldErrors.refundPolicy}
              </p>
            )}
          </div>
        </fieldset>

        {/* Terms Agreement */}
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <label className="flex items-start gap-3 cursor-pointer">
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
              I agree to PowerMySport Terms & Conditions and confirm all
              information is accurate
            </span>
          </label>
          {fieldErrors.agreedToTerms && (
            <p className="text-red-600 text-xs mt-2">
              {fieldErrors.agreedToTerms}
            </p>
          )}
        </div>

        {/* Actions */}
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
            variant="primary"
            disabled={isSubmitting || loading}
            fullWidth
          >
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </div>
  );
}
