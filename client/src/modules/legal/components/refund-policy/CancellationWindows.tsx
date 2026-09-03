export function CancellationWindows() {
  return (
    <section id="cancellation-windows" className="mb-8">
      <h2 className="mt-8 mb-4 text-2xl font-semibold">2. Cancellation &amp; Refund Windows</h2>

      <h3 className="mt-6 mb-3 text-xl font-semibold">2.1 Player-Initiated Cancellations</h3>
      <div className="overflow-x-auto">
        <table className="mt-4 mb-4 w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-3 text-left">Cancellation Window</th>
              <th className="border border-gray-300 p-3 text-left">Refund Percentage</th>
              <th className="border border-gray-300 p-3 text-left">Timeline</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-3">&gt;48 hours before booking</td>
              <td className="border border-gray-300 p-3">100% refund</td>
              <td className="border border-gray-300 p-3">
                5-10 business days to original payment method (instant if issued as wallet credit)
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 p-3">24-48 hours before booking</td>
              <td className="border border-gray-300 p-3">50% refund</td>
              <td className="border border-gray-300 p-3">
                5-10 business days to original payment method (instant if issued as wallet credit)
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-3">&lt;24 hours before booking</td>
              <td className="border border-gray-300 p-3">No refund (full forfeiture)</td>
              <td className="border border-gray-300 p-3">N/A</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-300 p-3">After booking completed or no-show</td>
              <td className="border border-gray-300 p-3">No refund</td>
              <td className="border border-gray-300 p-3">N/A</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Refunds are calculated on the amount you actually paid for the booking. Any payment-gateway
        charge that is non-refundable to PowerMySport will be deducted from the refunded amount.
        PowerMySport reserves the right to deny a refund entirely where a booking is cancelled and
        re-booked in a manner suggestive of abuse of this policy.
      </p>

      <h3 className="mt-6 mb-3 text-xl font-semibold">2.2 Coach/Venue-Initiated Cancellations</h3>
      <p>If a coach or venue owner cancels a confirmed booking, the player is entitled to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong>100% refund</strong> of the amount actually paid (platform fee inclusive), subject
          to verification that the cancellation was not caused or requested by the player
        </li>
        <li>Refund processed within 3-5 business days of verification</li>
        <li>
          Option, but not a right, to rebook at the same or similar time slot subject to
          availability
        </li>
        <li>No cancellation fee imposed on the player</li>
      </ul>

      <h3 className="mt-6 mb-3 text-xl font-semibold">2.3 Force Majeure Cancellations</h3>
      <p>
        In cases of force majeure (natural disasters, government lockdown, venue closure, or other
        events beyond any party&apos;s reasonable control), PowerMySport will, at its sole
        discretion, offer either a refund of the amount paid (less non-refundable processing
        charges) or the option to reschedule to a future date. PowerMySport&apos;s determination of
        what constitutes a force majeure event is final.
      </p>
    </section>
  );
}
