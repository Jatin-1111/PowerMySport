"use client";

import { useEffect } from "react";

export default function RefundPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">
            Cancellation, Refund & Dispute Policy
          </h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Overview</h2>
            <p>
              This policy outlines the cancellation, refund, and dispute
              resolution procedures for PowerMySport bookings. Our goal is to
              provide fair treatment to all parties (players, coaches, and venue
              owners) while protecting the integrity of the marketplace.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Cancellation & Refund Windows
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Player-Initiated Cancellations
            </h3>
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
                    5-7 business days to original payment method
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    24-48 hours before booking
                  </td>
                  <td className="border border-gray-300 p-3">50% refund</td>
                  <td className="border border-gray-300 p-3">
                    5-7 business days to original payment method
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">
                    &lt;24 hours before booking
                  </td>
                  <td className="border border-gray-300 p-3">
                    No refund (Forfeit)
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

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Coach/Venue-Initiated Cancellations
            </h3>
            <p>
              If a coach or venue owner cancels a booking, the player is
              entitled to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>100% refund</strong> of the amount paid
              </li>
              <li>Automatic refund processed within 24 hours</li>
              <li>
                Option to rebook at the same or similar time slot with priority
              </li>
              <li>No cancellation fee imposed on the player</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.3 Force Majeure Cancellations
            </h3>
            <p>
              In cases of force majeure (natural disasters, government lockdown,
              venue closure, etc.):
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>100% refund or recheduling</strong> options offered to
                all parties
              </li>
              <li>
                PowerMySport will not charge commission fees to coaches/venue
                owners
              </li>
              <li>
                Players can request refund or transfer booking to future date
                without penalty
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Refund Processing
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Refund Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Approval:</strong> 24-48 hours after cancellation
                request
              </li>
              <li>
                <strong>Processing:</strong> 5-7 business days for bank refunds
              </li>
              <li>
                <strong>Wallet Credits:</strong> Instant (if refunded as
                PowerMySport wallet credit)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Refund Method
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Card Payments:</strong> Refunded to original card within
                5-7 business days
              </li>
              <li>
                <strong>UPI/Bank Transfer:</strong> Refunded to original account
                within 5-7 business days
              </li>
              <li>
                <strong>Wallet:</strong> Instant credit to PowerMySport account
                (can be used for future bookings)
              </li>
              <li>
                <strong>Combination Payments:</strong> Each payment method
                refunded proportionally based on original transaction
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Refund Deductions
            </h3>
            <p>The following deductions may apply in certain circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Outstanding disputes or chargebacks filed by the player</li>
              <li>Booking recovery costs for fraudulent activity</li>
              <li>
                Payment processing fees (if applicable, from 50% or forfeit
                refunds)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Payment Disputes & Chargebacks
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Dispute Filing Process
            </h3>
            <p>
              If you believe a charge was made in error or a service was not
              delivered, you can file a dispute through our platform before
              contacting your bank:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Log in to PowerMySport account</li>
              <li>Navigate to "Bookings" → select the disputed booking</li>
              <li>Click "File Dispute" button</li>
              <li>Select dispute reason and provide detailed explanation</li>
              <li>
                Attach supporting documents (screenshots, communications, etc.)
              </li>
              <li>Submit for review by PowerMySport dispute team</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Dispute Investigation Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Acknowledgment:</strong> Within 24 hours of filing
              </li>
              <li>
                <strong>Initial Review:</strong> Within 3-5 business days
              </li>
              <li>
                <strong>Communication:</strong> Our team will contact both
                parties for additional information
              </li>
              <li>
                <strong>Final Decision:</strong> Within 7-10 business days
              </li>
              <li>
                <strong>Escalation (if needed):</strong> Up to 15 business days
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Chargeback Process
            </h3>
            <p>
              If you file a chargeback with your bank or payment provider
              without first attempting resolution through PowerMySport:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                We will respond to the chargeback with evidence of the
                transaction
              </li>
              <li>
                We maintain the right to suspend your account pending resolution
              </li>
              <li>
                If chargeback is found in the bank's favor, we will deduct the
                chargeback fee (₹500-1000) from your account
              </li>
              <li>Repeated chargebacks may result in account termination</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.4 Common Dispute Reasons & Resolution
            </h3>
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
                  <td className="border border-gray-300 p-3">100% refund</td>
                  <td className="border border-gray-300 p-3">
                    Check-in photo/timestamp, communications
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    Service not matching description
                  </td>
                  <td className="border border-gray-300 p-3">Case-by-case</td>
                  <td className="border border-gray-300 p-3">
                    Photos, testimonies, booking details
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">
                    Booking made in error (duplicate charge)
                  </td>
                  <td className="border border-gray-300 p-3">100% refund</td>
                  <td className="border border-gray-300 p-3">
                    Booking IDs, transaction timestamps
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    Unauthorized transaction
                  </td>
                  <td className="border border-gray-300 p-3">
                    100% refund + investigation
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
                    100% refund + compensation
                  </td>
                  <td className="border border-gray-300 p-3">
                    Error screenshots, logs
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Special Cases
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 No-Show Policy
            </h3>
            <p>
              <strong>Player No-Show:</strong> If a player does not arrive for
              the booking:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>No refund is issued</li>
              <li>Coaches/venues keep 100% of the payment</li>
              <li>
                Multiple no-shows may result in account warnings or suspension
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Partial Refunds
            </h3>
            <p>
              In cases where the service was partially completed or partially
              accepted:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                PowerMySport dispute team assesses the value of service
                delivered
              </li>
              <li>
                Refund is calculated proportionally (e.g., 1 hour out of 2 hours
                booked = 50% refund)
              </li>
              <li>Both parties must agree to partial refund settlement</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Promo Code & Discount Refunds
            </h3>
            <p>When a booking with promo codes or discounts is cancelled:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Discount is removed, refund is based on original price</li>
              <li>
                Promo code can be re-used if cancellation occurs within 48 hours
              </li>
              <li>Expired promo codes cannot be extended</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Coach & Venue Refunds
            </h2>
            <p>
              Coaches and venue owners receive their earned revenue after
              PowerMySport commission is deducted:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Commission Rate:</strong> 15-20% (varies by service
                type)
              </li>
              <li>
                <strong>Payment Schedule:</strong> Weekly or bi-weekly (varies
                by account level)
              </li>
              <li>
                <strong>In case of customer refund:</strong> Coach/venue refund
                is also reduced proportionally
              </li>
              <li>
                <strong>Reversal:</strong> If a refund is issued due to
                coach/venue fault, their earned amount is reclaimed
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Escalation & Appeals
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Disagreement with Decision
            </h3>
            <p>If you disagree with our dispute decision:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You may file an appeal within 5 business days of the decision
              </li>
              <li>
                Provide new evidence or information not previously available
              </li>
              <li>
                Case will be reviewed by a senior member of the disputes team
              </li>
              <li>Second review decision is final unless fraud is detected</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Binding Arbitration
            </h3>
            <p>
              As outlined in our Terms of Service, certain disputes may be
              subject to binding arbitration. In such cases, both parties agree
              to settle the matter through a neutral arbitrator rather than in
              court.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Contact & Support
            </h2>
            <p>For refund or dispute inquiries:</p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Support Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:support@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  support@powermysport.com
                </a>
              </p>
              <p>
                Email (Disputes Only):{" "}
                <a
                  href="mailto:disputes@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  disputes@powermysport.com
                </a>
              </p>
              <p>Response Time: 24 hours (business days)</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This policy is subject to change at PowerMySport's discretion.
              Significant changes will be communicated 30 days in advance to all
              users.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
