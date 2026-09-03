export function Commission() {
  return (
    <section id="commission" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Commission and Fees</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        PowerMySport reserves the right to charge venue listers, coaches, and experts a commission
        on successful bookings and completed sessions:
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-600">
        <li>
          For Experts and Academies, the platform commission is 15% of the listed fee on every
          completed transaction, plus GST on the commission. This and the full onboarding terms for
          these partners are set out in our{" "}
          <a href="/partner-terms" className="text-orange-600 hover:underline">
            Partner Terms (Experts &amp; Academies)
          </a>
          , which control over this section for those partners
        </li>
        <li>
          Where a commission is charged, the applicable rate will be disclosed to the affected venue
          lister, coach, or expert in advance through the Platform, and may be introduced, revised,
          or removed by us at any time upon notice
        </li>
        <li>
          For Expert sessions specifically, the platform commission is deducted from the session fee
          before the 24-hour post-completion payout is released. The net payout amount is displayed
          in the Expert&apos;s dashboard
        </li>
        <li>
          Academies and coaches may separately offer paid subscription or session-package plans
          directly to players; these are distinct products governed by their own listed terms and
          are unrelated to any commission charged on venue or coaching bookings
        </li>
        <li>
          Payment processing fees levied by third-party gateways are non-refundable and may be
          passed on to you
        </li>
        <li>
          We reserve the right to withhold, offset, or recover any amount owed to us (including
          commissions, penalties, or chargeback costs) from current or future payouts due to a venue
          lister, coach, or expert
        </li>
        <li>
          Commission structure and fee schedules may be updated at our sole discretion with notice
          via the Platform
        </li>
      </ul>
    </section>
  );
}
