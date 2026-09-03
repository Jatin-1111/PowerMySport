export function DisputesChargebacks() {
  return (
    <section id="disputes-chargebacks" className="mb-8">
      <h2 className="mt-8 mb-4 text-2xl font-semibold">4. Payment Disputes &amp; Chargebacks</h2>

      <h3 className="mt-6 mb-3 text-xl font-semibold">4.1 Dispute Filing Process</h3>
      <p>
        If you believe a charge was made in error or a service was not delivered, you must raise a
        dispute directly with PowerMySport <strong>within 48 hours</strong> of the scheduled booking
        time, and before contacting your bank or payment provider. Disputes raised after this window
        will not be considered, except where PowerMySport determines, at its sole discretion, that
        exceptional circumstances justify an exception. To raise a dispute:
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        <li>Email teams@powermysport.com or call +91 89685 82443, quoting your booking ID</li>
        <li>State your dispute reason and provide a detailed explanation</li>
        <li>
          Attach or forward all supporting documents (screenshots, communications, etc.); incomplete
          submissions may be rejected without further review
        </li>
        <li>Your dispute will be logged and reviewed by the PowerMySport disputes team</li>
      </ol>
      <p className="mt-3">
        <strong>A note on refund scams:</strong> PowerMySport will never call or message you asking
        for your OTP, CVV, card number, or net-banking password to &quot;process&quot; or
        &quot;verify&quot; a refund. We also never ask you to make a payment or share a QR code to
        receive a refund. If anyone contacts you this way claiming to represent PowerMySport,
        disengage and report it to teams@powermysport.com immediately.
      </p>

      <h3 className="mt-6 mb-3 text-xl font-semibold">4.2 Dispute Investigation Timeline</h3>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong>Acknowledgment:</strong> Within 48 hours of filing
        </li>
        <li>
          <strong>Initial Review:</strong> Within 5-7 business days
        </li>
        <li>
          <strong>Communication:</strong> Our team may contact either or both parties for additional
          information; failure to respond within 5 business days may result in the dispute being
          decided on available evidence or closed
        </li>
        <li>
          <strong>Final Decision:</strong> Within 10-15 business days
        </li>
        <li>
          <strong>Escalation (if needed):</strong> Up to 20 business days
        </li>
      </ul>

      <h3 className="mt-6 mb-3 text-xl font-semibold">4.3 Chargeback Process</h3>
      <p>
        Filing a chargeback with your bank or payment provider without first exhausting the dispute
        process above is treated as a presumptive breach of these policies and of good faith. In
        such cases:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>We will contest the chargeback with evidence of the transaction and of this policy</li>
        <li>
          We reserve the right to immediately suspend your account pending resolution, without
          refund of any amount
        </li>
        <li>
          If the chargeback is resolved in the bank&apos;s favor, we will additionally charge a
          chargeback-handling fee of ₹500-₹1,500, recoverable from your wallet, any pending payout,
          or by any other lawful means
        </li>
        <li>
          A chargeback found to be unsubstantiated or fraudulent will result in permanent account
          termination and, at PowerMySport&apos;s discretion, referral for legal action to recover
          amounts owed
        </li>
        <li>Repeated or disputed chargebacks will result in permanent account termination</li>
      </ul>

      <h3 className="mt-6 mb-3 text-xl font-semibold">
        4.4 Common Dispute Reasons &amp; Resolution
      </h3>
      <div className="overflow-x-auto">
        <table className="mt-4 mb-4 w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-3 text-left">Dispute Type</th>
              <th className="border border-gray-300 p-3 text-left">Eligible for Refund?</th>
              <th className="border border-gray-300 p-3 text-left">Required Evidence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-3">Coach/Venue no-show</td>
              <td className="border border-gray-300 p-3">100% refund, subject to verification</td>
              <td className="border border-gray-300 p-3">
                Check-in photo/timestamp, communications
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 p-3">Service not matching description</td>
              <td className="border border-gray-300 p-3">
                Refundable once the mismatch is verified, consistent with the Consumer Protection
                (E-Commerce) Rules, 2020
              </td>
              <td className="border border-gray-300 p-3">Photos, testimonies, booking details</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-3">
                Booking made in error (duplicate charge)
              </td>
              <td className="border border-gray-300 p-3">100% refund, less processing fee</td>
              <td className="border border-gray-300 p-3">Booking IDs, transaction timestamps</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 p-3">Unauthorized transaction</td>
              <td className="border border-gray-300 p-3">
                100% refund upon confirmed investigation
              </td>
              <td className="border border-gray-300 p-3">Account security details, device info</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-3">Technical error (platform malfunction)</td>
              <td className="border border-gray-300 p-3">
                100% refund; further compensation, if any, solely at PowerMySport&apos;s discretion
              </td>
              <td className="border border-gray-300 p-3">Error screenshots, logs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
