"use client";

import { LegalPageHeader } from "@/components/legal/LegalPageHeader";
import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/components/legal/LegalTableOfContents";
import { Card } from "@/modules/shared/ui/Card";
import {
  AlertTriangle,
  CalendarCheck,
  Gavel,
  HandCoins,
  Mail,
  Scale,
  ScrollText,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";

const REFUND_POLICY_TOC: LegalTocItem[] = [
  { id: "overview", label: "Overview", icon: ScrollText },
  { id: "cancellation-windows", label: "Cancellation & Refund Windows", icon: CalendarCheck },
  { id: "refund-processing", label: "Refund Processing", icon: Wallet },
  { id: "disputes-chargebacks", label: "Payment Disputes & Chargebacks", icon: ShieldAlert },
  { id: "special-cases", label: "Special Cases", icon: AlertTriangle },
  { id: "coach-venue-refunds", label: "Coach & Venue Refunds", icon: HandCoins },
  { id: "escalation-appeals", label: "Escalation & Appeals", icon: Gavel },
  { id: "contact-support", label: "Contact & Support", icon: Mail },
  { id: "statutory-rights", label: "Your Statutory Rights", icon: Scale },
];

export default function RefundPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={Wallet}
        title="Cancellation, Refund & Dispute Policy"
        lastUpdated="July 24, 2026"
        effective="July 24, 2026"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <LegalTableOfContents items={REFUND_POLICY_TOC} />
          <Card className="legal-content bg-white p-8 prose prose-lg max-w-none lg:col-start-2">
          <section id="overview" className="mb-8">
            <h2 className="text-2xl font-semibold mt-2 mb-4">1. Overview</h2>
            <p>
              This policy governs all cancellations, refunds, no-shows, and
              payment disputes for bookings made through PowerMySport and is
              incorporated by reference into our Terms of Service. It
              constitutes the entire and exclusive statement of your refund
              rights; no representation made by a venue, coach, or academy
              outside this policy is binding on PowerMySport. All refund
              decisions are made at PowerMySport&apos;s sole discretion in
              accordance with this policy, and no refund is owed as a matter
              of right except as expressly stated herein.
            </p>
          </section>

          <section id="cancellation-windows" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Cancellation &amp; Refund Windows
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Player-Initiated Cancellations
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-3 text-left">
                      Cancellation Window
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Refund Percentage
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Timeline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3">
                      &gt;48 hours before booking
                    </td>
                    <td className="border border-gray-300 p-3">100% refund</td>
                    <td className="border border-gray-300 p-3">
                      5-10 business days to original payment method (instant if
                      issued as wallet credit)
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      24-48 hours before booking
                    </td>
                    <td className="border border-gray-300 p-3">50% refund</td>
                    <td className="border border-gray-300 p-3">
                      5-10 business days to original payment method (instant if
                      issued as wallet credit)
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3">
                      &lt;24 hours before booking
                    </td>
                    <td className="border border-gray-300 p-3">
                      No refund (full forfeiture)
                    </td>
                    <td className="border border-gray-300 p-3">N/A</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      After booking completed or no-show
                    </td>
                    <td className="border border-gray-300 p-3">No refund</td>
                    <td className="border border-gray-300 p-3">N/A</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Refunds are calculated on the amount you actually paid for the
              booking. Any payment-gateway charge that is non-refundable to
              PowerMySport will be deducted from the refunded amount.
              PowerMySport reserves the right to deny a refund entirely where
              a booking is cancelled and re-booked in a manner suggestive of
              abuse of this policy.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Coach/Venue-Initiated Cancellations
            </h3>
            <p>
              If a coach or venue owner cancels a confirmed booking, the
              player is entitled to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>100% refund</strong> of the amount actually paid
                (platform fee inclusive), subject to verification that the
                cancellation was not caused or requested by the player
              </li>
              <li>Refund processed within 3-5 business days of verification</li>
              <li>
                Option, but not a right, to rebook at the same or similar time
                slot subject to availability
              </li>
              <li>No cancellation fee imposed on the player</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.3 Force Majeure Cancellations
            </h3>
            <p>
              In cases of force majeure (natural disasters, government
              lockdown, venue closure, or other events beyond any party&apos;s
              reasonable control), PowerMySport will, at its sole discretion,
              offer either a refund of the amount paid (less non-refundable
              processing charges) or the option to reschedule to a future
              date. PowerMySport&apos;s determination of what constitutes a
              force majeure event is final.
            </p>
          </section>

          <section id="refund-processing" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Refund Processing
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Refund Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Approval:</strong> Within 2-5 business days after a
                complete cancellation or dispute request is submitted
              </li>
              <li>
                <strong>Processing:</strong> 5-10 business days for bank
                refunds after approval
              </li>
              <li>
                <strong>Wallet Credits:</strong> Where PowerMySport elects to
                issue a wallet credit instead of a cash refund, it is credited
                promptly but is non-withdrawable and usable only for future
                bookings
              </li>
            </ul>
            <p className="mt-4">
              PowerMySport reserves the right, at its sole discretion, to
              issue any approved refund as platform wallet credit rather than
              a cash refund to the original payment method.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Refund Method
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Card Payments:</strong> Refunded to the original card
                within 5-10 business days of approval
              </li>
              <li>
                <strong>UPI/Bank Transfer:</strong> Credited to the original
                account within 5-10 business days of approval
              </li>
              <li>
                <strong>Wallet:</strong> Credited to your PowerMySport wallet
                (usable only for future bookings, non-transferable and
                non-withdrawable as cash)
              </li>
              <li>
                <strong>Combination Payments:</strong> Refunded proportionally
                across original payment methods, at PowerMySport&apos;s
                discretion as to allocation
              </li>
            </ul>
            <p className="mt-4">
              Payment gateway and processing fees are non-refundable in all
              circumstances and will be deducted from any refund. PowerMySport
              is not responsible for delays caused by banks, payment
              processors, or other third parties.
            </p>
          </section>

          <section id="disputes-chargebacks" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Payment Disputes &amp; Chargebacks
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Dispute Filing Process
            </h3>
            <p>
              If you believe a charge was made in error or a service was not
              delivered, you must raise a dispute directly with PowerMySport{" "}
              <strong>within 48 hours</strong> of the scheduled booking time,
              and before contacting your bank or payment provider. Disputes
              raised after this window will not be considered, except where
              PowerMySport determines, at its sole discretion, that
              exceptional circumstances justify an exception. To raise a
              dispute:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>
                Email teams@powermysport.com or call +91 89685 82443, quoting
                your booking ID
              </li>
              <li>State your dispute reason and provide a detailed explanation</li>
              <li>
                Attach or forward all supporting documents (screenshots,
                communications, etc.); incomplete submissions may be rejected
                without further review
              </li>
              <li>
                Your dispute will be logged and reviewed by the PowerMySport
                disputes team
              </li>
            </ol>
            <p className="mt-3">
              <strong>A note on refund scams:</strong> PowerMySport will never
              call or message you asking for your OTP, CVV, card number, or
              net-banking password to &quot;process&quot; or
              &quot;verify&quot; a refund. We also never ask you to make a
              payment or share a QR code to receive a refund. If anyone
              contacts you this way claiming to represent PowerMySport,
              disengage and report it to teams@powermysport.com immediately.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Dispute Investigation Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Acknowledgment:</strong> Within 48 hours of filing
              </li>
              <li>
                <strong>Initial Review:</strong> Within 5-7 business days
              </li>
              <li>
                <strong>Communication:</strong> Our team may contact either or
                both parties for additional information; failure to respond
                within 5 business days may result in the dispute being
                decided on available evidence or closed
              </li>
              <li>
                <strong>Final Decision:</strong> Within 10-15 business days
              </li>
              <li>
                <strong>Escalation (if needed):</strong> Up to 20 business
                days
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Chargeback Process
            </h3>
            <p>
              Filing a chargeback with your bank or payment provider without
              first exhausting the dispute process above is treated as a
              presumptive breach of these policies and of good faith. In such
              cases:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                We will contest the chargeback with evidence of the
                transaction and of this policy
              </li>
              <li>
                We reserve the right to immediately suspend your account
                pending resolution, without refund of any amount
              </li>
              <li>
                If the chargeback is resolved in the bank&apos;s favor, we
                will additionally charge a chargeback-handling fee of
                ₹500-₹1,500, recoverable from your wallet, any pending payout,
                or by any other lawful means
              </li>
              <li>
                A chargeback found to be unsubstantiated or fraudulent will
                result in permanent account termination and, at
                PowerMySport&apos;s discretion, referral for legal action to
                recover amounts owed
              </li>
              <li>Repeated or disputed chargebacks will result in permanent account termination</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.4 Common Dispute Reasons &amp; Resolution
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-3 text-left">
                      Dispute Type
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Eligible for Refund?
                    </th>
                    <th className="border border-gray-300 p-3 text-left">
                      Required Evidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3">
                      Coach/Venue no-show
                    </td>
                    <td className="border border-gray-300 p-3">
                      100% refund, subject to verification
                    </td>
                    <td className="border border-gray-300 p-3">
                      Check-in photo/timestamp, communications
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      Service not matching description
                    </td>
                    <td className="border border-gray-300 p-3">
                      Refundable once the mismatch is verified, consistent with
                      the Consumer Protection (E-Commerce) Rules, 2020
                    </td>
                    <td className="border border-gray-300 p-3">
                      Photos, testimonies, booking details
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3">
                      Booking made in error (duplicate charge)
                    </td>
                    <td className="border border-gray-300 p-3">
                      100% refund, less processing fee
                    </td>
                    <td className="border border-gray-300 p-3">
                      Booking IDs, transaction timestamps
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      Unauthorized transaction
                    </td>
                    <td className="border border-gray-300 p-3">
                      100% refund upon confirmed investigation
                    </td>
                    <td className="border border-gray-300 p-3">
                      Account security details, device info
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3">
                      Technical error (platform malfunction)
                    </td>
                    <td className="border border-gray-300 p-3">
                      100% refund; further compensation, if any, solely at
                      PowerMySport&apos;s discretion
                    </td>
                    <td className="border border-gray-300 p-3">
                      Error screenshots, logs
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="special-cases" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Special Cases
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 No-Show Policy
            </h3>
            <p>
              <strong>Player No-Show:</strong> A player who does not use the
              booking&apos;s check-in code before it expires, without prior
              notice to PowerMySport, is treated as a no-show:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>No refund is issued under any circumstance</li>
              <li>Coaches/venues retain 100% of the payment</li>
              <li>
                A pattern of repeated no-shows, once identified by our team,
                may result in a temporary booking restriction or permanent
                account suspension, at PowerMySport&apos;s sole discretion
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Partial Refunds
            </h3>
            <p>
              Where a service was only partially delivered:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                The PowerMySport disputes team alone assesses the value of the
                service actually delivered; its determination is final and
                binding
              </li>
              <li>
                Any refund is calculated proportionally at PowerMySport&apos;s
                discretion (for example, 1 hour used out of a 2-hour booking
                may result in up to a 50% refund, less applicable fees)
              </li>
              <li>PowerMySport is not obligated to obtain both parties&apos; agreement before finalizing a partial refund</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Promo Code &amp; Discount Refunds
            </h3>
            <p>When a booking made using a promo code or discount is cancelled:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Any refund is calculated on the discounted amount actually paid, not the original list price</li>
              <li>The promo code is forfeited and will not be reissued or extended, regardless of the cancellation window</li>
              <li>Promo codes and discounts have no cash value and cannot be redeemed for cash under any circumstance</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.4 Abuse of This Policy
            </h3>
            <p>
              PowerMySport monitors for patterns of frequent cancellations,
              repeated disputes, or chargeback abuse. Accounts exhibiting such
              patterns, as determined solely by PowerMySport, may have future
              refund eligibility restricted or revoked, be required to prepay
              non-refundable amounts, or be permanently suspended.
            </p>
          </section>

          <section id="coach-venue-refunds" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Coach &amp; Venue Refunds
            </h2>
            <p>
              Coaches and venue owners receive their earned revenue only after
              the PowerMySport commission and any applicable fees are
              deducted, and only in accordance with the following:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Commission:</strong> PowerMySport does not currently
                deduct a commission from venue or coach payouts; we reserve
                the right to introduce one at any time, with the applicable
                rate disclosed to affected venues/coaches in advance
              </li>
              <li>
                <strong>Payout Timing:</strong> Payouts are released after
                booking completion and internal verification; we do not
                currently commit to a fixed weekly or bi-weekly schedule, and
                payouts may be withheld pending verification, dispute
                resolution, or fraud review
              </li>
              <li>
                <strong>In case of customer refund:</strong> The
                corresponding coach/venue payout is reduced or withheld
                proportionally, without exception
              </li>
              <li>
                <strong>Reversal:</strong> Where a refund is issued due to
                coach/venue fault, non-compliance, or a policy violation, the
                full amount previously paid out may be reclaimed by deduction
                from future payouts or by direct recovery
              </li>
              <li>
                <strong>Holdbacks:</strong> PowerMySport may withhold a
                reasonable reserve from payouts to cover anticipated refunds,
                disputes, or chargebacks
              </li>
            </ul>
          </section>

          <section id="escalation-appeals" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Escalation &amp; Appeals
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Disagreement with Decision
            </h3>
            <p>If you disagree with a dispute decision:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You may file a single appeal within 3 business days of the
                decision
              </li>
              <li>
                The appeal must include new evidence or information not
                previously submitted; appeals without new evidence will be
                summarily denied
              </li>
              <li>
                The case will be reviewed by a senior member of the disputes
                team
              </li>
              <li>
                The decision on appeal is final and binding, and no further
                internal review will be offered, unless fraud on
                PowerMySport&apos;s part is separately established
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Binding Arbitration
            </h3>
            <p>
              Any dispute not resolved through the above process shall be
              subject to the mandatory, binding arbitration provisions of our
              Terms of Service. You waive any right to bring a class,
              collective, or representative claim in connection with any
              refund or dispute matter.
            </p>
          </section>

          <section id="contact-support" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Contact &amp; Support
            </h2>
            <p>For refund or dispute inquiries:</p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Support Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:teams@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  teams@powermysport.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a
                  href="tel:+918968582443"
                  className="text-blue-600 hover:underline"
                >
                  +91 89685 82443
                </a>
              </p>
              <p>Response Time: Within 48 hours (business days)</p>
            </div>
          </section>

          <section id="statutory-rights" className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Your Statutory Rights
            </h2>
            <p>
              Nothing in this policy limits, excludes, or waives any
              non-waivable right you have as a consumer under the Consumer
              Protection Act, 2019, the Consumer Protection (E-Commerce)
              Rules, 2020, or any other applicable Indian law. Where this
              policy is silent or in conflict with such a statutory right, the
              statutory right prevails.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This policy may be amended by PowerMySport at any time and at
              its sole discretion. Changes take effect immediately upon
              posting; continued use of the Platform or submission of a
              booking after posting constitutes acceptance of the revised
              policy. This policy, along with the Terms of Service and Privacy
              Policy, is the entire and exclusive statement of PowerMySport&apos;s
              obligations regarding cancellations, refunds, and disputes,
              subject always to Section 9 above.
            </p>
          </section>
          </Card>
        </div>
      </div>
    </div>
  );
}
