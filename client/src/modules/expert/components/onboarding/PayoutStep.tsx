import { TaxPayoutInfoStep } from "@/modules/expert/components/TaxPayoutInfoStep";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import type { ExpertOnboardingState } from "./useExpertOnboarding";

/**
 * The last step: tax and payout details, the commission the expert agrees to,
 * and what happens after they submit. The commission is stated in full before
 * the checkbox because agreeing to it is the point of the checkbox.
 */
export function PayoutStep({ o }: { o: ExpertOnboardingState }) {
  return (
    <div>
      <TaxPayoutInfoStep
        value={o.taxPayout}
        onChange={(patch) => o.setTaxPayout((v) => ({ ...v, ...patch }))}
      />

      <section aria-labelledby="terms-heading" className="border-hairline border-t py-8">
        <h2 id="terms-heading" className="text-ink text-lg font-semibold">
          Commission and terms
        </h2>
        <p className="text-ink-body mt-3 max-w-[64ch] text-pretty text-sm">
          PowerMySport charges a platform commission of{" "}
          <strong className="text-ink">15% of your session fee</strong> on every completed session
          booked through the Platform (plus GST on the commission). There is no joining or listing
          fee. On a ₹1,000 session you receive ₹823 after commission and GST, before any applicable
          TDS.
        </p>
        <label className="mt-5 flex max-w-2xl cursor-pointer items-start gap-3 py-2">
          <input
            type="checkbox"
            checked={o.agreedToPartnerTerms}
            onChange={(e) => o.setAgreedToPartnerTerms(e.target.checked)}
            disabled={o.submitting}
            className="accent-ink focus-visible:ring-ink mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
          />
          <span className="text-ink text-sm">
            I agree to the{" "}
            <a
              href="/partner-terms"
              target="_blank"
              rel="noopener noreferrer"
              className={`${TEXT_LINK} ring-offset-paper`}
            >
              Partner Terms (Experts and Academies)
            </a>
            , including the 15% platform commission, and confirm that the credentials and
            information I have provided are accurate.
          </span>
        </label>
        <p className="text-ink-body mt-5 max-w-[64ch] text-pretty text-sm">
          Submitting sends your profile for review. Our team verifies it before it goes live, and we
          email you once it is approved, usually within 3 to 5 days.
        </p>
      </section>
    </div>
  );
}
