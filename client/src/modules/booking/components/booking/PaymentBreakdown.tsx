import { IPayment } from "@/types";

interface PaymentBreakdownProps {
  payments: IPayment[];
  totalAmount: number;
}

export default function PaymentBreakdown({ payments, totalAmount }: PaymentBreakdownProps) {
  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <h3 className="text-deep-slate mb-4 text-lg font-semibold">Payment Breakdown</h3>

      <div className="space-y-3">
        {payments.map((payment, index) => (
          <div
            key={index}
            className="border-border flex items-center justify-between border-b pb-3 last:border-0"
          >
            <div>
              <p className="text-foreground font-medium">
                {payment.userType === "VenueLister"
                  ? "Venue Fee"
                  : payment.userType === "Academy"
                    ? "Academy Fee"
                    : "Coach Fee"}
              </p>
              <p className="text-muted-foreground text-sm">
                Status:{" "}
                <span
                  className={payment.status === "PAID" ? "text-emerald-600" : "text-orange-600"}
                >
                  {payment.status}
                </span>
              </p>
            </div>
            <p className="text-power-orange text-lg font-bold">₹{payment.amount}</p>
          </div>
        ))}

        <div className="border-deep-slate flex items-center justify-between border-t-2 pt-3">
          <p className="text-deep-slate text-lg font-bold">Total</p>
          <p className="text-power-orange text-xl font-bold">₹{totalAmount}</p>
        </div>
      </div>
    </div>
  );
}
