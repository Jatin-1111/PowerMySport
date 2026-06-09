"use client";

import { useEffect, useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  RefreshCw,
  Smartphone,
  TrendingDown,
  User,
} from "lucide-react";

type RefundMethod = "ORIGINAL_CARD" | "BANK_TRANSFER" | "STORE_CREDIT";

interface RefundRequest {
  id: string;
  bookingId: string;
  playerId: string;
  playerName: string;
  playerEmail: string;
  amount: number;
  originalPaymentMethod: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  refundMethod?: RefundMethod;
  requestedAt: string;
  completedAt?: string;
}

interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(
    null,
  );
  const [refundMethod, setRefundMethod] =
    useState<RefundMethod>("ORIGINAL_CARD");
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
  });

  const loadRefunds = async () => {
    try {
      setLoading(true);
      // Fetch bookings that have been refunded or have pending refunds
      // via the PhonePe refund status endpoint for each recent booking
      // The refunds page aggregates from the booking list filtered by refund state
      const response = await adminApi.getPendingRefundBookings();
      if (response.success && Array.isArray(response.data)) {
        setRefunds(response.data as RefundRequest[]);
      } else {
        setRefunds([]);
      }
    } catch (error) {
      toast.error("Failed to load refund requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
  }, []);

  const handleProcessRefund = async () => {
    if (!selectedRefund) return;

    if (refundMethod === "BANK_TRANSFER" && !bankDetails.accountHolderName) {
      toast.error("Bank details are required for bank transfer refunds");
      return;
    }

    setProcessing(selectedRefund.id);
    try {
      await adminApi.processRefund(selectedRefund.bookingId, {
        refundType: "FULL",
        reason: `Admin-initiated refund via ${refundMethod.replace("_", " ").toLowerCase()}`,
      });

      toast.success("Refund processed successfully!");
      setSelectedRefund(null);
      await loadRefunds();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process refund",
      );
    } finally {
      setProcessing(null);
    }
  };

  const handlePolling = async (refundId: string) => {
    try {
      const response = await adminApi.getPhonePeRefundStatus(refundId);
      if (response.success && response.data) {
        const { refundStatus, refundAmount } = response.data;
        toast.info(
          `Refund status: ${refundStatus} — ₹${refundAmount}`,
        );
      } else {
        toast.info("Refund status updated");
      }
      await loadRefunds();
    } catch (error) {
      toast.error("Failed to check refund status");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Finance"
          title="Refund Processing"
          subtitle="Handle and track player refunds from completed bookings."
        />
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-3" />
          <p className="text-sm">Loading refund requests...</p>
        </div>
      </div>
    );
  }

  const pendingRefunds = refunds.filter((r) => r.status === "PENDING");
  const completedRefunds = refunds.filter((r) => r.status === "COMPLETED");
  const failedRefunds = refunds.filter((r) => r.status === "FAILED");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Finance"
        title="Refund Processing"
        subtitle="Handle and track player refunds from completed bookings."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white p-6 border-l-4 border-l-amber-500">
          <p className="text-sm font-semibold text-slate-500">Pending</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            {pendingRefunds.length}
          </p>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-l-emerald-500">
          <p className="text-sm font-semibold text-slate-500">Completed</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {completedRefunds.length}
          </p>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-l-red-500">
          <p className="text-sm font-semibold text-slate-500">Failed</p>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {failedRefunds.length}
          </p>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-l-power-orange">
          <p className="text-sm font-semibold text-slate-500">Total Amount</p>
          <p className="text-3xl font-bold text-power-orange mt-2">
            ₹{refunds.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Refund Details Modal */}
      {selectedRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Process Refund
                </h2>
                <button
                  onClick={() => setSelectedRefund(null)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Booking Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Booking Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Booking ID:</span>
                    <span className="font-medium">
                      {selectedRefund.bookingId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Refund Amount:</span>
                    <span className="font-medium text-emerald-600">
                      ₹{selectedRefund.amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Original Payment:</span>
                    <span className="font-medium">
                      {selectedRefund.originalPaymentMethod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Player Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Player Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">
                      {selectedRefund.playerName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium text-slate-700">
                      {selectedRefund.playerEmail}
                    </span>
                  </div>
                </div>
              </div>

              {/* Refund Method Selection */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Refund Method
                </h3>
                <div className="space-y-3">
                  {/* Original Card */}
                  <label
                    className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor:
                        refundMethod === "ORIGINAL_CARD"
                          ? "#f59e0b"
                          : "#e2e8f0",
                      backgroundColor:
                        refundMethod === "ORIGINAL_CARD" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="ORIGINAL_CARD"
                      checked={refundMethod === "ORIGINAL_CARD"}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as RefundMethod)
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Return to Original Card
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Refund will be reversed via PhonePe to the original
                        card.
                        <br />
                        <span className="text-xs text-slate-500">
                          Processing time: 3-5 business days
                        </span>
                      </p>
                    </div>
                  </label>

                  {/* Bank Transfer */}
                  <label
                    className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor:
                        refundMethod === "BANK_TRANSFER"
                          ? "#f59e0b"
                          : "#e2e8f0",
                      backgroundColor:
                        refundMethod === "BANK_TRANSFER" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="BANK_TRANSFER"
                      checked={refundMethod === "BANK_TRANSFER"}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as RefundMethod)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Bank Transfer
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Manually transfer refund to player's bank account.
                        <br />
                        <span className="text-xs text-slate-500">
                          Processing time: 2-3 business days (manual)
                        </span>
                      </p>
                    </div>
                  </label>

                  {/* Bank Details Form */}
                  {refundMethod === "BANK_TRANSFER" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <input
                        type="text"
                        placeholder="Account Holder Name"
                        value={bankDetails.accountHolderName}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            accountHolderName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Account Number"
                        value={bankDetails.accountNumber}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            accountNumber: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="IFSC Code"
                        value={bankDetails.ifscCode}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            ifscCode: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        maxLength={11}
                      />
                      <input
                        type="text"
                        placeholder="Bank Name (Optional)"
                        value={bankDetails.bankName}
                        onChange={(e) =>
                          setBankDetails({
                            ...bankDetails,
                            bankName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  )}

                  {/* Store Credit */}
                  <label
                    className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors"
                    style={{
                      borderColor:
                        refundMethod === "STORE_CREDIT" ? "#f59e0b" : "#e2e8f0",
                      backgroundColor:
                        refundMethod === "STORE_CREDIT" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="STORE_CREDIT"
                      checked={refundMethod === "STORE_CREDIT"}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as RefundMethod)
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Store Credit
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Instant credit to player's wallet for future bookings.
                        <br />
                        <span className="text-xs text-slate-500">
                          Processing time: Instant
                        </span>
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button
                  onClick={handleProcessRefund}
                  variant="primary"
                  disabled={processing === selectedRefund.id}
                  className="flex-1"
                >
                  {processing === selectedRefund.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Process Refund
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedRefund(null)}
                  variant="outline"
                  disabled={processing === selectedRefund.id}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Refunds List */}
      {refunds.length === 0 ? (
        <Card className="bg-white py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">All set!</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            No pending refunds at the moment. All refund requests have been
            processed.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingRefunds.map((refund) => (
            <Card
              key={refund.id}
              className="bg-white overflow-hidden hover:shadow-md transition-all border border-slate-200"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4 p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {refund.playerName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Booking ID: {refund.bookingId}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {refund.playerEmail}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">
                      ₹{refund.amount}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(refund.requestedAt).toLocaleDateString(
                        "en-IN",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>

                  <Button
                    onClick={() => setSelectedRefund(refund)}
                    variant="primary"
                    size="md"
                  >
                    Process
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Refunds */}
      {completedRefunds.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Completed Refunds
          </h3>
          <div className="space-y-2">
            {completedRefunds.map((refund) => (
              <Card
                key={refund.id}
                className="bg-emerald-50 p-4 border border-emerald-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-emerald-900">
                      {refund.playerName}
                    </p>
                    <p className="text-sm text-emerald-700">₹{refund.amount}</p>
                  </div>
                  <CheckCircle2 className="text-emerald-600" size={20} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
