export function Commission() {
  return (
            <section id="commission" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Commission — 15% of Partner Fee
              </h2>
              <div className="bg-orange-50 border-l-4 border-power-orange p-4 mb-5 rounded-r-lg not-prose">
                <p className="text-slate-800 text-sm font-semibold">
                  PowerMySport charges a platform commission of 15% (fifteen
                  percent) of the Partner Fee on every Completed Transaction
                  booked through the Platform. The commission is deducted from
                  the amount collected from the client before your payout is
                  released.
                </p>
              </div>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  The 15% commission applies uniformly to Expert sessions,
                  academy trial classes, batch enrolments, packages, and
                  subscription plans transacted through the Platform
                </li>
                <li>
                  Commission is calculated on the Partner Fee{" "}
                  <strong>excluding</strong> GST and excluding any convenience
                  or service charge shown separately to the client
                </li>
                <li>
                  GST is charged on the commission at the rate then in force
                  (currently 18%) and is recovered along with the commission. A
                  tax invoice for the commission and GST is issued to you
                </li>
                <li>
                  Payment gateway charges levied by our payment partners are
                  non-refundable and, where they are not already borne by
                  PowerMySport, may be recovered from settlement. Any such
                  charge is itemised in your earnings statement
                </li>
                <li>
                  No commission is charged on a Transaction that is cancelled
                  and fully refunded to the client. Where a partial refund is
                  issued, commission is recomputed on the retained amount and
                  the difference is adjusted in your next settlement
                </li>
                <li>
                  There is no joining fee, listing fee, or monthly subscription
                  charge for onboarding as a Partner. Commission is the only
                  standing charge
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Worked Example
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg not-prose mb-6">
                <p className="text-slate-700 text-sm mb-3">
                  For a session or programme with a Partner Fee of{" "}
                  <strong>&#8377;1,000</strong>:
                </p>
                <ul className="text-slate-700 text-sm space-y-1.5">
                  <li>Partner Fee (base): &#8377;1,000.00</li>
                  <li>Platform commission @ 15%: &#8722; &#8377;150.00</li>
                  <li>GST @ 18% on commission: &#8722; &#8377;27.00</li>
                  <li className="font-semibold pt-1.5 border-t border-slate-200">
                    Net payable to Partner: &#8377;823.00
                  </li>
                </ul>
                <p className="text-slate-500 text-xs mt-3">
                  Illustrative only. TDS, if applicable, is deducted from the
                  net amount, and any GST payable by you on your own services is
                  handled per the Taxes section below. Actual figures for each
                  Transaction are shown in your earnings dashboard before
                  payout.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Changes to the Commission Rate
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                We may revise the commission rate. Any increase takes effect no
                earlier than thirty (30) days after we notify you by email and
                in-platform notice, and applies only to Transactions booked on
                or after the effective date — bookings already confirmed at the
                old rate are settled at the old rate. If you do not accept a
                revised rate, you may terminate under the Exit section, subject
                to honouring your confirmed bookings.
              </p>
              <p className="text-slate-600 leading-relaxed">
                We may run promotional or introductory periods at a reduced or
                zero commission rate for specific Partners, sports, or cities.
                Such concessions are discretionary, time-bound, communicated in
                writing, and revert to the standard 15% on expiry.
              </p>
            </section>
  );
}
