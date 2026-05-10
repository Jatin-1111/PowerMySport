"use client";

import { useEffect, useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi, PayoutSummary } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import { CheckCircle2, AlertCircle, Building2, UserCircle2, Landmark, Smartphone } from "lucide-react";

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPendingPayouts();
      if (response.success && response.data) {
        setPayouts(response.data);
      } else {
        toast.error(response.message || "Failed to load payouts");
      }
    } catch (error) {
      toast.error("Failed to fetch pending payouts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const handleMarkAsPaid = async (payout: PayoutSummary) => {
    const confirmMessage = `Are you sure you want to mark ₹${payout.totalPendingAmount} as PAID for ${payout.vendorName}?`;
    if (!window.confirm(confirmMessage)) return;

    setProcessingId(payout.vendorId);
    try {
      const response = await adminApi.markPayoutsAsPaid({
        vendorId: payout.vendorId,
        vendorRole: payout.vendorRole,
        bookingIds: payout.bookingIds,
      });

      if (response.success) {
        toast.success(response.message || "Payout marked as paid!");
        await loadPayouts();
      } else {
        toast.error(response.message || "Failed to mark as paid");
      }
    } catch (error) {
      toast.error("Failed to process payout");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading pending payouts...</div>;
  }

  const totalAmountOwed = payouts.reduce((sum, p) => sum + p.totalPendingAmount, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Finance"
        title="Pending Payouts"
        subtitle="Manage and settle pending earnings for Venue Listers and Coaches."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white p-6 border-l-4 border-l-power-orange">
          <p className="text-sm font-semibold text-slate-500">Total Pending Vendors</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{payouts.length}</p>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-l-emerald-500">
          <p className="text-sm font-semibold text-slate-500">Total Amount Owed</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">₹{totalAmountOwed.toLocaleString()}</p>
        </Card>
      </div>

      {payouts.length === 0 ? (
        <Card className="bg-white py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">All caught up!</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            There are currently no pending payouts. All completed bookings have been successfully settled.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <Card key={`${payout.vendorId}-${payout.vendorRole}`} className="bg-white overflow-hidden transition-all hover:shadow-md border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-stretch">
                
                {/* Left side: Vendor Info */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${payout.vendorRole === "COACH" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                      {payout.vendorRole === "COACH" ? <UserCircle2 size={24} /> : <Building2 size={24} />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{payout.vendorName}</h3>
                      <p className="text-sm font-semibold text-slate-500">{payout.vendorRole === "COACH" ? "Coach" : "Venue Owner"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Contact</p>
                      <p className="font-medium text-slate-900">{payout.vendorEmail}</p>
                      <p className="text-slate-600">{payout.vendorPhone}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Bookings</p>
                      <p className="font-medium text-slate-900">{payout.bookingIds.length} completed sessions</p>
                    </div>
                  </div>
                </div>

                {/* Middle: Payout Method */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-1 bg-slate-50/50">
                  <p className="text-sm font-semibold text-slate-500 mb-3">Preferred Payout Method</p>
                  
                  {!payout.payoutMethod ? (
                    <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">This user has not configured a payout method yet. They need to set it up in their dashboard.</p>
                    </div>
                  ) : payout.payoutMethod.type === "BANK_TRANSFER" ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                        <Landmark size={18} className="text-slate-500" /> Bank Transfer
                      </div>
                      <p><span className="text-slate-500">Bank:</span> {payout.payoutMethod.bankName}</p>
                      <p><span className="text-slate-500">Name:</span> {payout.payoutMethod.accountHolderName}</p>
                      <p><span className="text-slate-500">A/C No:</span> <span className="font-mono text-slate-900 font-medium">{payout.payoutMethod.accountNumber}</span></p>
                      <p><span className="text-slate-500">IFSC:</span> <span className="font-mono text-slate-900 font-medium">{payout.payoutMethod.ifscCode}</span></p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                        <Smartphone size={18} className="text-slate-500" /> UPI Transfer
                      </div>
                      <p><span className="text-slate-500">UPI ID:</span> <span className="font-mono text-slate-900 font-medium">{payout.payoutMethod.upiId}</span></p>
                    </div>
                  )}
                </div>

                {/* Right side: Action */}
                <div className="p-6 flex flex-col justify-center items-center text-center w-full md:w-64 bg-white">
                  <p className="text-sm font-semibold text-slate-500 mb-1">Amount Owed</p>
                  <p className="text-3xl font-bold text-power-orange mb-4">₹{payout.totalPendingAmount.toLocaleString()}</p>
                  
                  <button
                    onClick={() => handleMarkAsPaid(payout)}
                    disabled={!payout.payoutMethod || processingId === payout.vendorId}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingId === payout.vendorId ? "Processing..." : (
                      <>
                        <CheckCircle2 size={18} />
                        Mark as Paid
                      </>
                    )}
                  </button>
                  {!payout.payoutMethod && (
                    <p className="text-xs text-slate-500 mt-2 text-center">Cannot pay without payout details</p>
                  )}
                </div>

              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
