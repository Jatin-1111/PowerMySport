"use client";

import { useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { Lightbulb } from "lucide-react";
import EmailVerificationModal from "./EmailVerificationModal";

interface ContactInfoFormData {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

interface Step1ContactInfoProps {
  onContactInfoSubmit: (
    data: ContactInfoFormData,
  ) => Promise<{ venueId: string }>;
  loading?: boolean;
  onSkip?: () => Promise<void>;
}

const isDev =
  typeof window !== "undefined" && process.env.NODE_ENV === "development";

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
  const [globalError, setGlobalError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [venueId, setVenueId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.ownerName.length < 2) {
      errors.ownerName = "Name must be at least 2 characters";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      errors.ownerEmail = "Please enter a valid email address";
    }

    if (
      formData.ownerPhone.length < 10 ||
      !/^[+]?[0-9\s().\-]+$/.test(formData.ownerPhone)
    ) {
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
    setGlobalError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create venue with contact info
      const result = await onContactInfoSubmit(formData);
      setVenueId(result.venueId);

      // Step 2: Send verification code
      const verificationResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/venues/onboarding/send-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.ownerEmail,
            name: formData.ownerName,
          }),
        },
      );

      const verificationData = await verificationResponse.json();

      if (!verificationResponse.ok || !verificationData.success) {
        throw new Error(
          verificationData.message || "Failed to send verification code",
        );
      }

      // Step 3: Show verification modal
      setShowVerificationModal(true);
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Failed to save contact info",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = () => {
    setShowVerificationModal(false);
    // The parent component will handle navigation to next step
    // This is already done by onContactInfoSubmit callback
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 1: Tell us about you
        </h2>
        <p className="text-slate-600">
          Let's start by getting your contact information
        </p>
      </div>

      {globalError && (
        <Card className="bg-red-50 border-red-200">
          <p className="text-error-red font-medium">{globalError}</p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Full Name <span className="text-error-red">*</span>
          </label>
          <input
            type="text"
            name="ownerName"
            value={formData.ownerName}
            onChange={handleInputChange}
            placeholder="Your full name"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
              fieldErrors.ownerName
                ? "border-error-red bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={loading}
          />
          {fieldErrors.ownerName && (
            <p className="text-error-red text-sm mt-1">
              {fieldErrors.ownerName}
            </p>
          )}
          <p className="text-slate-600 text-sm mt-1">
            This will be your primary contact name
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Email Address <span className="text-error-red">*</span>
          </label>
          <input
            type="email"
            name="ownerEmail"
            value={formData.ownerEmail}
            onChange={handleInputChange}
            placeholder="your.email@example.com"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
              fieldErrors.ownerEmail
                ? "border-error-red bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={loading}
          />
          {fieldErrors.ownerEmail && (
            <p className="text-error-red text-sm mt-1">
              {fieldErrors.ownerEmail}
            </p>
          )}
          <p className="text-slate-600 text-sm mt-1">
            We'll use this to communicate about your venue
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Phone Number <span className="text-error-red">*</span>
          </label>
          <input
            type="tel"
            name="ownerPhone"
            value={formData.ownerPhone}
            onChange={handleInputChange}
            placeholder="+91 98765 43210"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
              fieldErrors.ownerPhone
                ? "border-error-red bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={loading}
          />
          {fieldErrors.ownerPhone && (
            <p className="text-error-red text-sm mt-1">
              {fieldErrors.ownerPhone}
            </p>
          )}
          <p className="text-slate-600 text-sm mt-1">
            We may need to contact you regarding your listing
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-power-orange hover:bg-orange-600 text-white py-2.5 text-base"
          disabled={loading || isSubmitting}
        >
          {isSubmitting
            ? "Sending verification code..."
            : "Continue to Verification"}
        </Button>
        {isDev && onSkip && (
          <Button
            type="button"
            onClick={onSkip}
            disabled={loading || isSubmitting}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2.5 text-base"
          >
            Skip (Dev)
          </Button>
        )}
      </form>

      <Card className="bg-power-orange/5 border-power-orange/20">
        <p className="text-sm text-slate-700 flex items-start gap-2">
          <Lightbulb
            size={18}
            className="text-power-orange flex-shrink-0 mt-0.5"
          />
          <span>
            <span className="font-semibold">Tip:</span> Make sure to provide
            accurate contact information. After your venue is approved, we'll
            send you credentials and access to your vendor dashboard at this
            email address.
          </span>
        </p>
      </Card>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <EmailVerificationModal
          email={formData.ownerEmail}
          venueId={venueId}
          onVerified={handleVerificationSuccess}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
}
