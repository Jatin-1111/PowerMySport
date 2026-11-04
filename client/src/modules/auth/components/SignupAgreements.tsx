import Link from "next/link";
import type React from "react";

interface SignupAgreementsProps {
  values: { acceptedTerms: boolean; acceptedPrivacy: boolean; whatsappConsent: boolean };
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const BOX =
  "text-power-orange focus:ring-power-orange/50 mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300";
const LABEL = "flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200";
const LINK = "text-power-orange font-semibold transition-colors hover:text-orange-600";

/**
 * What a person agrees to when they sign up: the two required agreements, and one
 * optional tick for WhatsApp updates. The WhatsApp one starts unticked and is never
 * required, because consent that was pre-ticked or demanded is not consent.
 */
export function SignupAgreements({ values, errors, onChange }: SignupAgreementsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <label className={LABEL}>
        <input
          type="checkbox"
          name="acceptedTerms"
          checked={values.acceptedTerms}
          onChange={onChange}
          value="true"
          className={BOX}
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className={LINK}>
            Terms of Service
          </Link>
        </span>
      </label>
      {errors.acceptedTerms && <p className="text-xs text-red-500">{errors.acceptedTerms}</p>}

      <label className={LABEL}>
        <input
          type="checkbox"
          name="acceptedPrivacy"
          checked={values.acceptedPrivacy}
          onChange={onChange}
          value="true"
          className={BOX}
        />
        <span>
          I agree to the{" "}
          <Link href="/privacy" target="_blank" className={LINK}>
            Privacy Policy
          </Link>
        </span>
      </label>
      {errors.acceptedPrivacy && <p className="text-xs text-red-500">{errors.acceptedPrivacy}</p>}

      <label className={LABEL}>
        <input
          type="checkbox"
          name="whatsappConsent"
          checked={values.whatsappConsent}
          onChange={onChange}
          value="true"
          className={BOX}
        />
        <span>
          Send me booking updates on WhatsApp.{" "}
          <span className="text-slate-500 dark:text-slate-400">
            Optional. We use your phone number for this, and you can turn it off any time in
            Settings or by replying STOP.
          </span>
        </span>
      </label>
    </div>
  );
}
