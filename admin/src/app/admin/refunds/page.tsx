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
  ChevronLeft,
  ChevronRight,
  Clock,
  Landmark,
  Loader2,
  RefreshCw,
  Smartphone,
  TrendingDown,
  User,
  XCircle,
} from "lucide-react";
import { PaginationMetadata } from "@/types";

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
  const [failedRefunds, setFailedRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("ORIGINAL_CARD");
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
  });

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    totalPages: 1,
  });

  const [stats, setStats] = useState({
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalAmount: 0,
  });

  // Track booking IDs submitted to PhonePe this session (to prevent double-processing)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const loadRefunds = async () => {
    try {
      setLoading(true);
      const [pendingResponse, failedResponse] = await Promise.all([
        adminApi.getPendingRefundBookings({ page: currentPage, limit: PAGE_SIZE }),
        adminApi.getFailedRefundBookings(),
      ]);

      if (pendingResponse.success && Array.isArray(pendingResponse.data)) {
        if (pendingResponse.data.length === 0 && currentPage > 1) {
          setCurrentPage((prev) => prev - 1);
          return;
        }
        setRefunds(pendingResponse.data as RefundRequest[]);
        if (pendingResponse.stats) setStats(pendingResponse.stats);
        if (pendingResponse.pagination) {
          setPagination({
            total: pendingResponse.pagination.total || 0,
            page: pendingResponse.pagination.page || 1,
            totalPages: pendingResponse.pagination.totalPages || 1,
          });
        }
      } else {
        setRefunds([]);
      }

      if (failedResponse.success && Array.isArray(failedResponse.data)) {
        setFailedRefunds(failedResponse.data as RefundRequest[]);
      } else {
        setFailedRefunds([]);
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
  }, [currentPage]);

  const handleProcessRefund = async () => {
    if (!selectedRefund) return;

    if (refundMethod === "BANK_TRANSFER" && !bankDetails.accountHolderName) {
      toast.error("Bank details are required for bank transfer refunds");
      return;
    }

    setProcessing(selectedRefund.id);
    try {
      const response = await adminApi.processRefund(selectedRefund.bookingId, {
        refundType: "FULL",
        reason: `Admin-initiated refund via ${refundMethod.replace("_", " ").toLowerCase()}`,
      });

      const refundStatus = (response?.data as any)?.refundStatus;

      if (refundStatus === "PENDING") {
        // PhonePe accepted the refund — remove from list so admin can't re-submit
        const bookingId = selectedRefund.bookingId;
        setRefunds((prev) => prev.filter((r) => r.bookingId !== bookingId));
        setSubmittedIds((prev) => new Set([...prev, bookingId]));
        toast.success("Refund submitted to PhonePe — will be confirmed within 5–7 business days.");
      } else {
        toast.success("Refund processed successfully!");
        await loadRefunds();
      }

      setSelectedRefund(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process refund");
    } finally {
      setProcessing(null);
    }
  };

  const handlePolling = async (refundId: string) => {
    try {
      const response = await adminApi.getPhonePeRefundStatus(refundId);
      if (response.success && response.data) {
        const { refundStatus, refundAmount } = response.data;
        toast.info(`Refund status: ${refundStatus} — ₹${refundAmount}`);
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
          <Loader2 className="mb-3 h-10 w-10 animate-spin" />
          <p className="text-sm">Loading refund requests...</p>
        </div>
      </div>
    );
  }

  const pendingRefunds = refunds.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Finance"
        title="Refund Processing"
        subtitle="Handle and track player refunds from completed bookings."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{stats.pendingCount}</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.completedCount}</p>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">Failed</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{stats.failedCount}</p>
        </Card>
        <Card className="border-l-power-orange border-l-4 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">Total Amount</p>
          <p className="text-power-orange mt-2 text-3xl font-bold">
            ₹{stats.totalAmount.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Refund Details Modal */}
      {selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white">
            <div className="sticky top-0 border-b border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Process Refund</h2>
                <button
                  onClick={() => setSelectedRefund(null)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              {/* Booking Info */}
              <div>
                <h3 className="mb-3 font-semibold text-slate-900">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Booking ID:</span>
                    <span className="font-medium">{selectedRefund.bookingId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Refund Amount:</span>
                    <span className="font-medium text-emerald-600">₹{selectedRefund.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Original Payment:</span>
                    <span className="font-medium">{selectedRefund.originalPaymentMethod}</span>
                  </div>
                </div>
              </div>

              {/* Player Info */}
              <div>
                <h3 className="mb-3 font-semibold text-slate-900">Player Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-medium">{selectedRefund.playerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-medium text-slate-700">{selectedRefund.playerEmail}</span>
                  </div>
                </div>
              </div>

              {/* Refund Method Selection */}
              <div>
                <h3 className="mb-3 font-semibold text-slate-900">Refund Method</h3>
                <div className="space-y-3">
                  {/* Original Card */}
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors"
                    style={{
                      borderColor: refundMethod === "ORIGINAL_CARD" ? "#f59e0b" : "#e2e8f0",
                      backgroundColor: refundMethod === "ORIGINAL_CARD" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="ORIGINAL_CARD"
                      checked={refundMethod === "ORIGINAL_CARD"}
                      onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">Return to Original Source</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Refund will be reversed via PhonePe to the original payment method (UPI,
                        Card, etc.).
                        <br />
                        <span className="text-xs text-slate-500">
                          Processing time: 3-5 business days
                        </span>
                      </p>
                    </div>
                  </label>

                  {/* Bank Transfer */}
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors"
                    style={{
                      borderColor: refundMethod === "BANK_TRANSFER" ? "#f59e0b" : "#e2e8f0",
                      backgroundColor: refundMethod === "BANK_TRANSFER" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="BANK_TRANSFER"
                      checked={refundMethod === "BANK_TRANSFER"}
                      onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Bank Transfer</p>
                      <p className="mt-1 text-sm text-slate-600">
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
                    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  {/* Store Credit */}
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors"
                    style={{
                      borderColor: refundMethod === "STORE_CREDIT" ? "#f59e0b" : "#e2e8f0",
                      backgroundColor: refundMethod === "STORE_CREDIT" ? "#fef3c7" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="refund-method"
                      value="STORE_CREDIT"
                      checked={refundMethod === "STORE_CREDIT"}
                      onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">Store Credit</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Instant credit to player's wallet for future bookings.
                        <br />
                        <span className="text-xs text-slate-500">Processing time: Instant</span>
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-slate-200 pt-4">
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

      {/* Pending Refunds List */}
      {pendingRefunds.length === 0 && failedRefunds.length === 0 ? (
        <Card className="bg-white py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h3 className="text-lg font-semibold text-slate-900">All set!</h3>
          <p className="mx-auto mt-2 max-w-md text-slate-500">
            No pending refunds at the moment. All refund requests have been processed.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {pendingRefunds.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
                Pending ({pendingRefunds.length})
              </h2>
              {pendingRefunds.map((refund) => (
                <Card
                  key={refund.id}
                  className="overflow-hidden border border-slate-200 bg-white transition-all hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="rounded-lg bg-amber-100 p-2">
                          <Clock size={18} className="text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{refund.playerName}</h3>
                          <p className="text-xs text-slate-500">Booking ID: {refund.bookingId}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{refund.playerEmail}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">₹{refund.amount}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(refund.requestedAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {submittedIds.has(refund.bookingId) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">
                          <Clock size={12} />
                          Awaiting PhonePe
                        </span>
                      ) : (
                        <Button
                          onClick={() => setSelectedRefund(refund)}
                          variant="primary"
                          size="md"
                        >
                          Process
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {failedRefunds.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wider text-red-500 uppercase">
                Failed — Retry Required ({failedRefunds.length})
              </h2>
              {failedRefunds.map((refund) => (
                <Card key={refund.id} className="overflow-hidden border border-red-200 bg-white">
                  <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="rounded-lg bg-red-100 p-2">
                          <XCircle size={18} className="text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{refund.playerName}</h3>
                          <p className="text-xs text-slate-500">Booking ID: {refund.bookingId}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{refund.playerEmail}</p>
                      <p className="mt-1 text-xs font-medium text-red-500">
                        Previous refund attempt failed — choose a method below to retry.
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">₹{refund.amount}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(refund.requestedAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setRefundMethod("ORIGINAL_CARD");
                        }}
                        variant="outline"
                        size="md"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900">
              {Math.min(currentPage * PAGE_SIZE, pagination.total)}
            </span>{" "}
            of <span className="font-medium text-slate-900">{pagination.total}</span> refund
            requests
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2"
            >
              <ChevronLeft size={16} />
            </Button>

            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-9 px-0"
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
              className="px-2"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
