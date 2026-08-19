export function ExpertSessions() {
  return (
            <section id="expert-sessions" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Expert Sessions
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Expert sessions are paid one-on-one sessions booked by clients
                directly with an Expert through the Platform. The following
                terms govern the expert session lifecycle in addition to the
                general booking and payment terms above.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Session Lifecycle
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  <strong>PENDING_PAYMENT:</strong> A client initiates a booking
                  and a slot hold is placed on the Expert&apos;s calendar while
                  payment is in progress. The hold expires if payment is not
                  completed within the prescribed window, automatically freeing
                  the slot
                </li>
                <li>
                  <strong>SCHEDULED:</strong> Payment has been successfully
                  captured and the Expert has accepted the booking. The session
                  is confirmed for both parties
                </li>
                <li>
                  <strong>COMPLETED:</strong> The session has concluded.
                  Completion may be triggered automatically once the scheduled
                  end time passes or manually by an admin. Clients may submit a
                  rating and review after completion
                </li>
                <li>
                  <strong>CANCELLED:</strong> The session was cancelled by the
                  client, the Expert, an admin, or the system (e.g., payment
                  hold expired or Expert declined). Refund eligibility depends
                  on who cancelled and when, as set out in our Cancellation,
                  Refund &amp; Dispute Policy
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Expert Acceptance
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  Upon a client completing payment, the Expert receives a
                  booking notification and must accept or decline within 24
                  hours
                </li>
                <li>
                  If the Expert declines, the client receives a full refund.
                  Repeated declines without valid reason may result in account
                  action
                </li>
                <li>
                  Silence beyond 24 hours may be treated as acceptance or as a
                  system-driven cancellation with refund, at PowerMySport&apos;s
                  sole discretion
                </li>
                <li>
                  Once a booking is accepted (SCHEDULED), the Expert may not
                  unilaterally alter the session time or mode without the
                  client&apos;s prior consent and PowerMySport&apos;s approval
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Expert Payouts
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  Expert payouts are released 24 hours after a session reaches
                  COMPLETED status (whether by auto-completion or admin action).
                  This window allows for post-session disputes or refund
                  requests to be raised before funds are disbursed
                </li>
                <li>
                  Payouts are credited to the Expert&apos;s default payout
                  method (bank transfer or UPI) on file at the time of release.
                  PowerMySport is not responsible for failed payouts due to
                  incorrect or outdated payout details
                </li>
                <li>
                  The applicable platform commission is deducted from the
                  session fee before payout. The net payout amount is visible to
                  the Expert in their dashboard so that they may price their
                  services accordingly
                </li>
                <li>
                  PowerMySport may withhold or offset any payout if: (a) the
                  session is under dispute; (b) the Expert has outstanding
                  amounts owed to us; (c) the session was cancelled by the
                  Expert; or (d) we have reason to suspect fraud or policy
                  violation
                </li>
                <li>
                  TDS (Tax Deducted at Source) will be applied to Expert payouts
                  as required by applicable Indian tax law. The Expert is
                  responsible for their own tax filings and compliance
                  obligations
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Reviews and Ratings
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  Clients may submit a rating (1–5 stars) and a written review
                  within a specified window after a session is marked COMPLETED.
                  Reviews are displayed publicly on the Expert&apos;s profile
                </li>
                <li>
                  Clients may choose to submit reviews anonymously; the
                  reviewer&apos;s identity will not be disclosed to the Expert
                  or other users
                </li>
                <li>
                  PowerMySport reserves the right to hide or remove reviews that
                  violate our content policies, but does not edit review
                  content. Experts may flag a review as inappropriate; flagged
                  reviews are subject to admin discretion
                </li>
                <li>
                  Experts must not solicit fake, paid, or coerced reviews, or
                  request removal of genuine negative reviews. Doing so is a
                  prohibited activity and grounds for account termination
                </li>
                <li>
                  An Expert&apos;s average rating and review count are
                  calculated on verified completed sessions only
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Session Reminders and Notifications
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  PowerMySport will send automated reminder notifications to
                  both parties before scheduled sessions. Experts are
                  responsible for monitoring their notifications and ensuring
                  session readiness
                </li>
                <li>
                  For online sessions, Experts will receive a nudge to add a
                  meeting link if one has not been provided close to the session
                  start time. Failure to act on this nudge is the Expert&apos;s
                  sole responsibility
                </li>
                <li>
                  Both parties will receive a &quot;session starting soon&quot;
                  reminder containing the meeting link (online sessions) or the
                  confirmed in-person address (in-person sessions)
                </li>
              </ul>
            </section>
  );
}
