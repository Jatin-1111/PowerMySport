export function Commission() {
  return (
    <section id="commission" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Commission — 15% of Partner Fee</h2>
      <div className="border-power-orange not-prose mb-5 rounded-r-lg border-l-4 bg-orange-50 p-4">
        <p className="text-sm font-semibold text-slate-800">
          PowerMySport charges a platform commission of 15% (fifteen percent) of the Partner Fee on
          every Completed Transaction booked through the Platform. The commission is deducted from
          the amount collected from the client before your payout is released.
        </p>
      </div>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          The 15% commission applies uniformly to Expert sessions, academy trial classes, batch
          enrolments, packages, and subscription plans transacted through the Platform
        </li>
        <li>
          Commission is calculated on the Partner Fee <strong>excluding</strong> GST and excluding
          any convenience or service charge shown separately to the client
        </li>
        <li>
          GST is charged on the commission at the rate then in force (currently 18%) and is
          recovered along with the commission. A tax invoice for the commission and GST is issued to
          you
        </li>
        <li>
          Payment gateway charges levied by our payment partners are non-refundable and, where they
          are not already borne by PowerMySport, may be recovered from settlement. Any such charge
          is itemised in your earnings statement
        </li>
        <li>
          No commission is charged on a Transaction that is cancelled and fully refunded to the
          client. Where a partial refund is issued, commission is recomputed on the retained amount
          and the difference is adjusted in your next settlement
        </li>
        <li>
          There is no joining fee, listing fee, or monthly subscription charge for onboarding as a
          Partner. Commission is the only standing charge
        </li>
      </ul>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Worked Example</h3>
      <div className="not-prose mb-6 rounded-lg bg-slate-50 p-4">
        <p className="mb-3 text-sm text-slate-700">
          For a session or programme with a Partner Fee of <strong>&#8377;1,000</strong>:
        </p>
        <ul className="space-y-1.5 text-sm text-slate-700">
          <li>Partner Fee (base): &#8377;1,000.00</li>
          <li>Platform commission @ 15%: &#8722; &#8377;150.00</li>
          <li>GST @ 18% on commission: &#8722; &#8377;27.00</li>
          <li className="border-t border-slate-200 pt-1.5 font-semibold">
            Net payable to Partner: &#8377;823.00
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Illustrative only. TDS, if applicable, is deducted from the net amount, and any GST
          payable by you on your own services is handled per the Taxes section below. Actual figures
          for each Transaction are shown in your earnings dashboard before payout.
        </p>
      </div>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Changes to the Commission Rate</h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        We may revise the commission rate. Any increase takes effect no earlier than thirty (30)
        days after we notify you by email and in-platform notice, and applies only to Transactions
        booked on or after the effective date — bookings already confirmed at the old rate are
        settled at the old rate. If you do not accept a revised rate, you may terminate under the
        Exit section, subject to honouring your confirmed bookings.
      </p>
      <p className="leading-relaxed text-slate-600">
        We may run promotional or introductory periods at a reduced or zero commission rate for
        specific Partners, sports, or cities. Such concessions are discretionary, time-bound,
        communicated in writing, and revert to the standard 15% on expiry.
      </p>
    </section>
  );
}
