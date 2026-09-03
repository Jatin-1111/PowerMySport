import { Card } from "@/modules/shared/ui/Card";
import { Wallet } from "lucide-react";

export function RefundProcessing() {
  return (
    <section id="refund-processing" className="mb-8">
      <h2 className="mt-8 mb-4 text-2xl font-semibold">3. Refund Processing</h2>

      <h3 className="mt-6 mb-3 text-xl font-semibold">3.1 Refund Timeline</h3>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Approval:</strong> Within 2-5 business days after a complete cancellation or
          dispute request is submitted
        </li>
        <li>
          <strong>Processing:</strong> 5-10 business days for bank refunds after approval
        </li>
        <li>
          <strong>Wallet Credits:</strong> Where PowerMySport elects to issue a wallet credit
          instead of a cash refund, it is credited promptly but is non-withdrawable and usable only
          for future bookings
        </li>
      </ul>
      <p className="mt-4">
        PowerMySport reserves the right, at its sole discretion, to issue any approved refund as
        platform wallet credit rather than a cash refund to the original payment method.
      </p>

      <h3 className="mt-6 mb-3 text-xl font-semibold">3.2 Refund Method</h3>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Card Payments:</strong> Refunded to the original card within 5-10 business days of
          approval
        </li>
        <li>
          <strong>UPI/Bank Transfer:</strong> Credited to the original account within 5-10 business
          days of approval
        </li>
        <li>
          <strong>Wallet:</strong> Credited to your PowerMySport wallet (usable only for future
          bookings, non-transferable and non-withdrawable as cash)
        </li>
        <li>
          <strong>Combination Payments:</strong> Refunded proportionally across original payment
          methods, at PowerMySport&apos;s discretion as to allocation
        </li>
      </ul>
      <p className="mt-4">
        Payment gateway and processing fees are non-refundable in all circumstances and will be
        deducted from any refund. PowerMySport is not responsible for delays caused by banks,
        payment processors, or other third parties.
      </p>
    </section>
  );
}
