export function Booking() {
  return (
    <section id="booking" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Booking and Payments</h2>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Booking Process</h3>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>All bookings are subject to availability and are not guaranteed until confirmed</li>
        <li>Bookings are confirmed only after successful payment capture</li>
        <li>
          You will receive a confirmation email with booking details; you are solely responsible for
          verifying its accuracy immediately
        </li>
        <li>
          For group bookings, the total cost may be split among participating players (equally or by
          a custom amount); this split applies only to what players owe each other and does not
          alter how venues or coaches are paid
        </li>
        <li>
          We reserve the right to cancel or refuse any booking suspected of fraud, error, or abuse,
          at our sole discretion
        </li>
      </ul>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Payment Terms</h3>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          All prices are displayed in Indian Rupees (INR) and are inclusive of applicable taxes
          unless stated otherwise
        </li>
        <li>
          Full payment must be completed at the time of booking; no booking is held without payment
        </li>
        <li>
          We accept major credit/debit cards, UPI, and digital wallets through our authorized
          payment partners; we are not liable for any failure, delay, or error caused by such
          third-party payment providers
        </li>
        <li>
          Service charges and platform fees are disclosed before payment and are strictly
          non-negotiable
        </li>
        <li>
          Venue listers, coaches, and experts receive payouts only after booking/session completion
          and only in accordance with our then-current payout schedule, which we may change at our
          sole discretion
        </li>
      </ul>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Cancellation and Refunds</h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        All cancellations, refunds, no-shows, and payment disputes are governed exclusively and in
        their entirety by our Cancellation, Refund &amp; Dispute Policy, which is incorporated into
        these Terms by reference and controls in the event of any conflict with this section. We
        reserve the right to amend that policy at any time. Refunds, where owed, are issued solely
        at our discretion in accordance with that policy and are never guaranteed as a matter of
        right.
      </p>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Right to Refuse Service</h3>
      <p className="leading-relaxed text-slate-600">
        A venue lister, coach, or expert may decline to provide a service to a specific player for
        reasons including safety, capacity, or behavioral concerns, or any other good-faith reason
        not prohibited by applicable law. Where a confirmed booking is declined at the point of
        service for such a reason, refund treatment is governed by our Cancellation, Refund &amp;
        Dispute Policy in the same way as any other provider-initiated cancellation. PowerMySport is
        not liable for a venue lister&apos;s, coach&apos;s, or expert&apos;s decision to decline
        service to a specific player.
      </p>
    </section>
  );
}
