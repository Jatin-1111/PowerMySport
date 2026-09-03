"use client";

import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Lightbulb } from "lucide-react";
import { useState } from "react";

interface ContactInfoFormData {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

interface Step1ContactInfoProps {
  onContactInfoSubmit: (data: ContactInfoFormData) => Promise<{ venueId: string }>;
  loading?: boolean;
  onSkip?: () => Promise<void>;
}

const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

export default function Step1ContactInfo({
  onContactInfoSubmit,
  loading = false,
  onSkip,
}: Step1ContactInfoProps) {
  const [formData, setFormData] = useState<ContactInfoFormData>({
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getInputClassName = (hasError: boolean) => {
    return `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
      hasError ? "border-error-red bg-red-50" : "border-slate-300 bg-white"
    }`;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.ownerName.length < 2) {
      errors.ownerName = "Name must be at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      errors.ownerEmail = "Please enter a valid email address";
    }

    if (formData.ownerPhone.length < 10 || !/^[+]?[0-9\s().\-]+$/.test(formData.ownerPhone)) {
      errors.ownerPhone = "Please enter a valid phone number";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onContactInfoSubmit(formData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save contact info");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="shadow-xs space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 1: Tell us about you</h2>
        <p className="text-slate-600">Let's start by getting your contact information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Full Name <span className="text-error-red">*</span>
          </label>
          <input
            type="text"
            name="ownerName"
            value={formData.ownerName}
            onChange={handleInputChange}
            placeholder="Your full name"
            className={getInputClassName(Boolean(fieldErrors.ownerName))}
            disabled={loading}
          />
          {fieldErrors.ownerName && (
            <p className="text-error-red mt-1 text-sm">{fieldErrors.ownerName}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">This will be your primary contact name</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Email Address <span className="text-error-red">*</span>
          </label>
          <input
            type="email"
            name="ownerEmail"
            value={formData.ownerEmail}
            onChange={handleInputChange}
            placeholder="your.email@example.com"
            className={getInputClassName(Boolean(fieldErrors.ownerEmail))}
            disabled={loading}
          />
          {fieldErrors.ownerEmail && (
            <p className="text-error-red mt-1 text-sm">{fieldErrors.ownerEmail}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            We'll use this to communicate about your venue
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Phone Number <span className="text-error-red">*</span>
          </label>
          <input
            type="tel"
            name="ownerPhone"
            value={formData.ownerPhone}
            onChange={handleInputChange}
            placeholder="+91 98765 43210"
            className={getInputClassName(Boolean(fieldErrors.ownerPhone))}
            disabled={loading}
          />
          {fieldErrors.ownerPhone && (
            <p className="text-error-red mt-1 text-sm">{fieldErrors.ownerPhone}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            We may need to contact you regarding your listing
          </p>
        </div>

        <Button
          type="submit"
          className="bg-power-orange w-full py-2.5 text-base text-white hover:bg-orange-600"
          disabled={loading || isSubmitting}
        >
          {isSubmitting ? "Sending verification code..." : "Continue to Verification"}
        </Button>
        {isDev && onSkip && (
          <Button
            type="button"
            onClick={onSkip}
            disabled={loading || isSubmitting}
            className="w-full bg-slate-600 py-2.5 text-base text-white hover:bg-slate-700"
          >
            Skip (Dev)
          </Button>
        )}
      </form>

      <Card className="border-power-orange/20 bg-power-orange/5 rounded-xl border shadow-none">
        <p className="flex items-start gap-2 text-sm text-slate-700">
          <Lightbulb size={18} className="text-power-orange mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Tip:</span> Make sure to provide accurate contact
            information. After your venue is approved, we'll send you credentials and access to your
            vendor dashboard at this email address.
          </span>
        </p>
      </Card>
    </div>
  );
}
