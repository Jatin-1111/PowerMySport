export function Payouts() {
  return (
    <section id="payouts" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Payouts &amp; Settlement</h2>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          <strong>Collection:</strong> Client payments are collected by PowerMySport through
          authorised payment partners. You have no right to collect payment directly for a
          Transaction initiated on the Platform
        </li>
        <li>
          <strong>Expert sessions:</strong> Payout is released 24 hours after the session reaches
          COMPLETED status. This window allows post-session disputes and refund requests to be
          raised before funds are disbursed
        </li>
        <li>
          <strong>Academy programmes:</strong> Payouts are settled on the cycle shown in your
          earnings dashboard, calculated on Transactions that completed within the cycle. For
          multi-month subscriptions, settlement follows the collection schedule, not the full
          programme value upfront
        </li>
        <li>
          <strong>Payout method:</strong> Funds are credited to the default bank account or UPI
          handle on file at the time of release. We are not liable for failed or misdirected payouts
          caused by incorrect or outdated details you provided
        </li>
        <li>
          <strong>Statements:</strong> A per-Transaction breakdown — gross amount, 15% commission,
          GST, any gateway charge, TDS, and net payout — is available in your dashboard
        </li>
        <li>
          <strong>Withholding and offset:</strong> We may withhold or set off any payout where (a)
          the Transaction is under dispute or chargeback; (b) a refund is pending; (c) you owe us
          commission, penalties, or recovery amounts; (d) the Transaction was cancelled by you; or
          (e) we have reasonable grounds to suspect fraud or policy violation. Withheld amounts are
          released once the matter is resolved in your favour
        </li>
        <li>
          <strong>Disputed statements:</strong> Raise any payout discrepancy in writing within
          thirty (30) days of the statement date. Statements not disputed within that period are
          deemed accepted
        </li>
      </ul>
    </section>
  );
}
