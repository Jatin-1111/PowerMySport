import { AlertTriangle, Users } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface LegalConsentProps {
  onConsentChange: (accepted: boolean) => void;
  showPrivacy?: boolean;
  showTerms?: boolean;
  showHealthWaiver?: boolean;
  showCookies?: boolean;
  required?: boolean;
  isLoading?: boolean;
  error?: string;
}

/**
 * Reusable component for displaying legal consent checkboxes
 * Can be customized to show different document types
 */
export const LegalConsentForm: React.FC<LegalConsentProps> = ({
  onConsentChange,
  showPrivacy = true,
  showTerms = true,
  showHealthWaiver = false,
  showCookies = false,
  required = true,
  isLoading = false,
  error = "",
}) => {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({
    terms: false,
    privacy: false,
    healthWaiver: false,
    cookies: false,
  });

  const handleConsentChange = (documentType: string, value: boolean) => {
    const newAccepted = { ...accepted, [documentType]: value };
    setAccepted(newAccepted);

    // Check if all required documents are accepted
    const allAccepted =
      (!showTerms || newAccepted.terms) &&
      (!showPrivacy || newAccepted.privacy) &&
      (!showHealthWaiver || newAccepted.healthWaiver) &&
      (!showCookies || newAccepted.cookies);

    onConsentChange(allAccepted);
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">Legal & Policy Agreements</h3>

      {error && <div className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      {showTerms && (
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="terms-consent"
            checked={accepted.terms}
            onChange={(e) => handleConsentChange("terms", e.target.checked)}
            disabled={isLoading}
            required={required}
            className="mt-1 h-4 w-4 cursor-pointer rounded text-orange-600 disabled:opacity-50"
          />
          <label htmlFor="terms-consent" className="flex-1 cursor-pointer text-sm text-slate-700">
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-orange-600 hover:underline">
              Terms of Service
            </Link>
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      )}

      {showPrivacy && (
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="privacy-consent"
            checked={accepted.privacy}
            onChange={(e) => handleConsentChange("privacy", e.target.checked)}
            disabled={isLoading}
            required={required}
            className="mt-1 h-4 w-4 cursor-pointer rounded text-orange-600 disabled:opacity-50"
          />
          <label htmlFor="privacy-consent" className="flex-1 cursor-pointer text-sm text-slate-700">
            I agree to the{" "}
            <Link href="/privacy" target="_blank" className="text-orange-600 hover:underline">
              Privacy Policy
            </Link>
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      )}

      {showHealthWaiver && (
        <div className="flex items-start space-x-3 rounded border border-yellow-200 bg-yellow-50 p-3">
          <input
            type="checkbox"
            id="health-waiver-consent"
            checked={accepted.healthWaiver}
            onChange={(e) => handleConsentChange("healthWaiver", e.target.checked)}
            disabled={isLoading}
            required={required}
            className="mt-1 h-4 w-4 cursor-pointer rounded text-orange-600 disabled:opacity-50"
          />
          <label
            htmlFor="health-waiver-consent"
            className="flex-1 cursor-pointer text-sm text-slate-700"
          >
            I acknowledge and assume all health and injury risks associated with sports activities.
            I have read and agree to the{" "}
            <Link href="/health-waiver" target="_blank" className="text-orange-600 hover:underline">
              Health, Safety & Liability Waiver
            </Link>
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      )}

      {showCookies && (
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="cookies-consent"
            checked={accepted.cookies}
            onChange={(e) => handleConsentChange("cookies", e.target.checked)}
            disabled={isLoading}
            required={required}
            className="mt-1 h-4 w-4 cursor-pointer rounded text-orange-600 disabled:opacity-50"
          />
          <label htmlFor="cookies-consent" className="flex-1 cursor-pointer text-sm text-slate-700">
            I agree to our use of cookies as described in the{" "}
            <Link href="/cookies" target="_blank" className="text-orange-600 hover:underline">
              Cookie Policy
            </Link>
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        {required && "All marked with * are required to continue. "}
        You can review our policies anytime in the footer.
      </p>
    </div>
  );
};

/**
 * Component for health waiver acceptance during booking
 * Displays warning and requires explicit acceptance
 */
export const BookingHealthWaiverModal: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}> = ({ onAccept, onDecline, isLoading = false }) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white">
        <div className="bg-linear-to-r from-orange-600 to-orange-500 p-6 text-white">
          <h2 className="text-2xl font-bold">Health & Safety Waiver</h2>
          <p className="mt-2 text-orange-100">Please read and accept before proceeding</p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded border border-yellow-200 bg-yellow-50 p-4">
            <p className="mb-3 text-sm text-slate-700">
              <strong className="inline-flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> WARNING:
              </strong>{" "}
              Sports activities carry inherent risks of physical injury, serious injury, permanent
              disability, and even death. By proceeding, you:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>Acknowledge these risks</li>
              <li>Confirm you are physically fit for this activity</li>
              <li>Assume full responsibility for your safety</li>
              <li>Release PowerMySport, coaches, and venues from liability</li>
            </ul>
          </div>

          <div className="max-h-48 overflow-y-auto rounded border bg-slate-50 p-4">
            <p className="text-xs leading-relaxed text-slate-600">
              You acknowledge that participation in sports activities carries inherent risks
              including but not limited to: sprains, strains, fractures, head trauma, cardiovascular
              incidents, and other serious injuries. You confirm that you are in good physical
              health and have consulted with a medical professional if you have pre-existing
              conditions...
            </p>
            <div className="mt-3 text-xs text-indigo-600">
              <Link href="/health-waiver" target="_blank" className="hover:underline">
                Read full waiver →
              </Link>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded bg-slate-50 p-4">
            <input
              type="checkbox"
              id="confirm-waiver"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 cursor-pointer rounded text-orange-600 disabled:opacity-50"
            />
            <label
              htmlFor="confirm-waiver"
              className="flex-1 cursor-pointer text-sm text-slate-700"
            >
              I have read and understood the waiver. I confirm that I am physically fit and assume
              all health and injury risks.
            </label>
          </div>

          <div className="flex gap-3 border-t pt-4">
            <button
              onClick={onDecline}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={!accepted || isLoading}
              className="flex-1 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Processing..." : "Accept & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Parental consent form for adding minors
 */
export const ParentalConsentForm: React.FC<{
  onConsentChange: (accepted: boolean) => void;
  isLoading?: boolean;
  error?: string;
}> = ({ onConsentChange, isLoading = false, error = "" }) => {
  const [accepted, setAccepted] = useState(false);

  const handleChange = (value: boolean) => {
    setAccepted(value);
    onConsentChange(value);
  };

  return (
    <div className="space-y-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-start space-x-3">
        <div className="text-indigo-600">
          <Users className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Parental Consent Required</h3>
          <p className="mt-1 text-sm text-slate-700">
            You are adding a minor. As the legal guardian, you must accept our parental consent
            terms.
          </p>
        </div>
      </div>

      {error && <div className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-start space-x-3 rounded bg-white p-3">
        <input
          type="checkbox"
          id="parental-consent"
          checked={accepted}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={isLoading}
          className="mt-1 h-4 w-4 cursor-pointer rounded text-indigo-600 disabled:opacity-50"
          required
        />
        <label htmlFor="parental-consent" className="flex-1 cursor-pointer text-sm text-slate-700">
          I am the legal parent/guardian and agree to the{" "}
          <Link
            href="/parental-consent"
            target="_blank"
            className="text-indigo-600 hover:underline"
          >
            Parental Consent & Minor Protection Policy
          </Link>{" "}
          and{" "}
          <Link href="/health-waiver" target="_blank" className="text-indigo-600 hover:underline">
            Health Waiver
          </Link>
          <span className="ml-1 text-red-500">*</span>
        </label>
      </div>

      <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        <strong>Important:</strong> By consenting, you assume full liability for your child's
        participation and release all coaches, venues, and PowerMySport from liability for injuries.
      </div>
    </div>
  );
};

/**
 * Refund policy acknowledgment (required for bookings)
 */
export const RefundPolicyAcknowledgment: React.FC<{
  bookingAmount: number;
  onAccept: () => void;
}> = ({ bookingAmount, onAccept }) => {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Cancellation & Refund Policy</h4>
        <div className="space-y-1 text-xs text-slate-700">
          <p>
            <strong>₹{bookingAmount}</strong> charged for this booking
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Cancel &gt;48 hours before: 100% refund</li>
            <li>Cancel 24-48 hours before: 50% refund</li>
            <li>Cancel &lt;24 hours before: No refund</li>
            <li>No-show or after completion: No refund</li>
          </ul>
        </div>
      </div>

      <div className="flex items-start space-x-2">
        <input
          type="checkbox"
          id="refund-ack"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-1 h-4 w-4 cursor-pointer rounded"
        />
        <label htmlFor="refund-ack" className="cursor-pointer text-xs text-slate-700">
          I understand the refund policy and accept these terms
        </label>
      </div>

      {understood && (
        <button
          onClick={onAccept}
          className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Accept & Proceed to Payment
        </button>
      )}
    </div>
  );
};
