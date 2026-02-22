import React from "react";
import { IPayment } from "@/types";

interface PaymentBreakdownProps {
  payments: IPayment[];
  totalAmount: number;
}

export default function PaymentBreakdown({
  payments,
  totalAmount,
}: PaymentBreakdownProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-deep-slate">
        Payment Breakdown
      </h3>

      <div className="space-y-3">
        {payments.map((payment, index) => (
          <div
            key={index}
            className="flex justify-between items-center pb-3 border-b border-border last:border-0"
          >
            <div>
              <p className="font-medium text-foreground">
                {payment.userType === "VENUE_LISTER"
                  ? "Venue Fee"
                  : "Coach Fee"}
              </p>
              <p className="text-sm text-muted-foreground">
                Status:{" "}
                <span
                  className={
                    payment.status === "PAID"
                      ? "text-green-600"
                      : "text-orange-600"
                  }
                >
                  {payment.status}
                </span>
              </p>
            </div>
            <p className="text-lg font-bold text-power-orange">
              ₹{payment.amount}
            </p>
          </div>
        ))}

        <div className="flex justify-between items-center pt-3 border-t-2 border-deep-slate">
          <p className="text-lg font-bold text-deep-slate">Total</p>
          <p className="text-xl font-bold text-power-orange">₹{totalAmount}</p>
        </div>
      </div>
    </div>
  );
}
