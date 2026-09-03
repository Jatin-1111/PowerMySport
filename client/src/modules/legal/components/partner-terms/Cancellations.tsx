import Link from "next/link";

export function Cancellations() {
  return (
    <section id="cancellations" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">
        Cancellations, Refunds &amp; No-Shows
      </h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        Client-facing cancellation and refund entitlements are governed by our{" "}
        <Link href="/refund-policy" className="text-orange-600 hover:underline">
          Cancellation, Refund &amp; Dispute Policy
        </Link>
        . As between you and PowerMySport:
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-600">
        <li>
          Where you cancel a confirmed Transaction, the client is refunded in full and no payout is
          due to you for that Transaction
        </li>
        <li>
          Where the client cancels, refund treatment follows the published policy; you are paid on
          any amount properly retained, less the 15% commission on that retained amount
        </li>
        <li>
          Where a client raises a service-quality complaint, we may investigate and, acting
          reasonably, issue a full or partial refund and recover the corresponding amount from your
          payout. You will be given an opportunity to respond before recovery except where the facts
          are undisputed
        </li>
        <li>
          Repeated Partner-side cancellations, no-shows, or upheld quality complaints may result in
          reduced ranking, suspension, or termination
        </li>
        <li>
          Chargebacks raised by clients are investigated case by case. If a chargeback is upheld
          against a Transaction you delivered, the disputed amount and any associated bank charge
          may be recovered from your settlements
        </li>
      </ul>
    </section>
  );
}
