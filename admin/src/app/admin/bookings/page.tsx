"use client";

import { toast } from "@/lib/toast";
import { adminApi, type AdminPhonePeRefundStatus } from "@/modules/admin/services/admin";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { BookingTimeline } from "@/modules/admin/components/BookingTimeline";
import { statsApi } from "@/modules/analytics/services/stats";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { DetailDrawer, DetailRow, DetailSection } from "@/modules/shared/ui/DetailDrawer";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { Booking } from "@/types";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/modules/shared/ui/States";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type BookingActionType = "REFUND" | "DISPUTE";
type BookingTabType = "ALL" | "VENUE" | "Coach" | "ACADEMY";
const REFUND_ACTIONS_ENABLED = true;
const DISPUTE_ACTIONS_ENABLED = false;

const getBookingId = (booking: Booking): string => {
  const fallback = booking as Booking & { _id?: string };
  return booking.id || fallback._id || "";
};

/**
 * The server now stores providerType on every booking and derives it from the
 * ids on write, so this is the one place that needs to know the precedence —
 * and only as a fallback for documents that predate the field.
 *
 * Previously this page decided the bucket with `!!booking.coachId`, which
 * silently counted every academy booking as a venue booking.
 */
type ProviderType = NonNullable<Booking["providerType"]>;

const providerTypeOf = (booking: Booking): ProviderType => {
  if (booking.providerType) return booking.providerType;
  if (booking.academyId) return "ACADEMY";
  if (booking.coachId) return "COACH";
  return "VENUE";
};

const PROVIDER_LABEL: Record<ProviderType, string> = {
  VENUE: "VENUE",
  COACH: "Coach",
  ACADEMY: "Academy",
  EXPERT: "Expert",
};

const PROVIDER_TONE: Record<ProviderType, "purple" | "blue" | "green" | "orange"> = {
  VENUE: "purple",
  COACH: "blue",
  ACADEMY: "green",
  EXPERT: "orange",
};

/** Whichever party the booking is actually against. */
const partyNameOf = (booking: Booking): string => {
  const type = providerTypeOf(booking);
  if (type === "COACH") return booking.coachName || "Unknown coach";
  if (type === "ACADEMY") return booking.academyName || "Unknown academy";
  if (type === "EXPERT") return booking.expertName || "Unknown expert";
  return booking.venueName || "Unknown venue";
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<BookingTabType>("ALL");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionType, setActionType] = useState<BookingActionType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refundType, setRefundType] = useState<"FULL" | "PARTIAL">("FULL");
  const [disputeType, setDisputeType] = useState<
    "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER"
  >("OTHER");
  const [resolution, setResolution] = useState<"FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND">(
    "NO_REFUND"
  );
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [refundStatusByBookingId, setRefundStatusByBookingId] = useState<
    Record<string, AdminPhonePeRefundStatus>
  >({});
  const [refundStatusLoadingByBookingId, setRefundStatusLoadingByBookingId] = useState<
    Record<string, boolean>
  >({});
  const PAGE_SIZE = 10;

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getAllBookings({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setBookings(response.data);
        if (response.pagination) setPagination(response.pagination);
        return;
      }
      setError(response.message || "Failed to load bookings.");
    } catch (loadError) {
      console.error("Failed to load bookings:", loadError);
      setError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setActionType(null);
    setReason("");
    setEvidence("");
    setRefundType("FULL");
    setDisputeType("OTHER");
    setResolution("NO_REFUND");
  };

  const closeBooking = () => {
    setSelectedBooking(null);
    setActionType(null);
  };

  const beginAction = (type: BookingActionType) => {
    if (type === "REFUND" && !REFUND_ACTIONS_ENABLED) {
      toast.error("Refund actions are not available yet.");
      return;
    }
    if (type === "DISPUTE" && !DISPUTE_ACTIONS_ENABLED) {
      toast.error("Dispute actions are not available yet.");
      return;
    }
    setActionType(type);
    setReason("");
    setEvidence("");
  };

  const checkPhonePeRefundStatus = useCallback(async (bookingId: string, silent = false) => {
    setRefundStatusLoadingByBookingId((previous) => ({
      ...previous,
      [bookingId]: true,
    }));
    try {
      const response = await adminApi.getPhonePeRefundStatus(bookingId);
      const refundStatus = response.data;
      if (!response.success || !refundStatus) {
        throw new Error(response.message || "Failed to load refund status.");
      }
      setRefundStatusByBookingId((previous) => ({
        ...previous,
        [bookingId]: refundStatus,
      }));
      if (!silent) toast.success("PhonePe refund status updated.");
    } catch (statusError) {
      if (!silent) {
        toast.error(
          statusError instanceof Error
            ? statusError.message
            : "Failed to load PhonePe refund status."
        );
      }
    } finally {
      setRefundStatusLoadingByBookingId((previous) => ({
        ...previous,
        [bookingId]: false,
      }));
    }
  }, []);

  const submitAction = async () => {
    if (!selectedBooking || !actionType) return;
    const bookingId = getBookingId(selectedBooking);
    if (!bookingId) {
      toast.error("Booking ID not found.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }

    setActionLoading(true);
    try {
      if (actionType === "REFUND") {
        await adminApi.processRefund(bookingId, {
          refundType,
          reason: reason.trim(),
        });
        toast.success("Refund request submitted.");
        await checkPhonePeRefundStatus(bookingId, true);
      } else {
        await adminApi.handleDispute(bookingId, {
          disputeType,
          resolution,
          evidence: evidence.trim() || undefined,
        });
        toast.success("Dispute request submitted.");
      }
      setActionType(null);
      await loadBookings();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : "Failed to submit booking action."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (activeTab === "ALL") return true;
        if (activeTab === "Coach") return providerTypeOf(booking) === "COACH";
        if (activeTab === "ACADEMY") return providerTypeOf(booking) === "ACADEMY";
        return providerTypeOf(booking) === "VENUE";
      }),
    [bookings, activeTab]
  );

  const bookingCounts = useMemo(
    () => ({
      all: bookings.length,
      coach: bookings.filter((b) => providerTypeOf(b) === "COACH").length,
      venue: bookings.filter((b) => providerTypeOf(b) === "VENUE").length,
      academy: bookings.filter((b) => providerTypeOf(b) === "ACADEMY").length,
    }),
    [bookings]
  );

  const columns: AdminDataTableColumn<Booking>[] = [
    {
      key: "id",
      header: "Booking",
      render: (b) => (
        <span className="font-mono text-slate-700">#{getBookingId(b).slice(-6) || "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (b) => (
        <StatusBadge
          status={PROVIDER_LABEL[providerTypeOf(b)]}
          tone={PROVIDER_TONE[providerTypeOf(b)]}
          dot={false}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "datetime",
      header: "Date & Time",
      render: (b) => (
        <div>
          <p className="text-slate-800">{formatDate(b.date)}</p>
          <p className="text-xs text-slate-500">
            {formatTime(b.startTime)} – {formatTime(b.endTime)}
          </p>
        </div>
      ),
    },
    {
      key: "party",
      header: "Provider",
      render: (b) => (
        <div>
          <p className="text-slate-800">{partyNameOf(b)}</p>
          {b.sport && <p className="text-xs text-slate-500">{b.sport}</p>}
        </div>
      ),
    },
    {
      key: "player",
      header: "Player",
      render: (b) => <span className="text-slate-700">{b.playerName || "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (b) => (
        <span className="font-semibold text-slate-900">{formatCurrency(b.totalAmount)}</span>
      ),
    },
  ];

  const selectedBookingId = selectedBooking ? getBookingId(selectedBooking) : "";
  const selectedRefundStatus = selectedBookingId
    ? refundStatusByBookingId[selectedBookingId]
    : undefined;

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Commerce"
          title="Bookings"
          subtitle="Every booking across venues, coaches and academies. Open one to refund or review its history."
        />
        <ErrorNotice message={error} onRetry={loadBookings} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Commerce"
        title="Bookings"
        subtitle="Every booking across venues, coaches and academies. Open one to refund or review its history."
      />

      <Tabs
        label="Booking type"
        value={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setCurrentPage(1);
        }}
        tabs={[
          { id: "ALL" as const, label: "All", count: bookingCounts.all },
          { id: "VENUE" as const, label: "Venues", count: bookingCounts.venue },
          { id: "Coach" as const, label: "Coaches", count: bookingCounts.coach },
          { id: "ACADEMY" as const, label: "Academies", count: bookingCounts.academy },
        ]}
      />

      {!DISPUTE_ACTIONS_ENABLED && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Disputes can&apos;t be started from here yet. They switch on once the payment gateway
          integration is live.
        </div>
      )}

      <AdminDataTable<Booking>
        columns={columns}
        rows={filteredBookings}
        getRowKey={(b) => getBookingId(b)}
        loading={loading}
        emptyMessage={
          activeTab === "ALL"
            ? "Bookings will appear here once players start booking."
            : activeTab === "VENUE"
              ? "Venue bookings will appear here once players book venues."
              : activeTab === "ACADEMY"
                ? "Academy bookings will appear here once players book academies."
                : "Coach bookings will appear here once players book coaches."
        }
        onRowClick={openBooking}
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          total: pagination.total,
          onPageChange: setCurrentPage,
        }}
        toolbarExtra={
          <ExportCsvButton
            filename="bookings.csv"
            rows={filteredBookings}
            label="Export this page (CSV)"
            columns={[
              { header: "Booking ID", value: (b) => getBookingId(b) },
              { header: "Status", value: (b) => b.status },
              {
                header: "Type",
                value: (b) => PROVIDER_LABEL[providerTypeOf(b)],
              },
              { header: "Date", value: (b) => b.date },
              { header: "Start Time", value: (b) => b.startTime },
              { header: "End Time", value: (b) => b.endTime },
              { header: "Provider", value: (b) => partyNameOf(b) },
              { header: "Player", value: (b) => b.playerName || "" },
              { header: "Total Amount (INR)", value: (b) => b.totalAmount },
            ]}
          />
        }
      />

      <DetailDrawer
        open={Boolean(selectedBooking)}
        onClose={closeBooking}
        title={selectedBooking ? `Booking #${getBookingId(selectedBooking).slice(-6)}` : "Booking"}
        subtitle={
          selectedBooking
            ? `${formatDate(selectedBooking.date)} · ${formatTime(selectedBooking.startTime)} – ${formatTime(selectedBooking.endTime)}`
            : undefined
        }
        headerExtra={selectedBooking ? <StatusBadge status={selectedBooking.status} /> : null}
        widthClass="max-w-xl"
        footer={
          selectedBooking && !actionType ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => beginAction("DISPUTE")}
                disabled={!DISPUTE_ACTIONS_ENABLED}
                className={btn("outline")}
              >
                Open dispute
              </button>
              <button
                type="button"
                onClick={() => beginAction("REFUND")}
                disabled={!REFUND_ACTIONS_ENABLED}
                className={btn("primary")}
              >
                Refund booking
              </button>
            </div>
          ) : null
        }
      >
        {selectedBooking && (
          <>
            <DetailSection title="Session">
              <DetailRow
                label="Type"
                value={
                  <StatusBadge
                    status={PROVIDER_LABEL[providerTypeOf(selectedBooking)]}
                    tone={PROVIDER_TONE[providerTypeOf(selectedBooking)]}
                    dot={false}
                  />
                }
              />
              <DetailRow
                label={
                  PROVIDER_LABEL[providerTypeOf(selectedBooking)] === "VENUE"
                    ? "Venue"
                    : PROVIDER_LABEL[providerTypeOf(selectedBooking)]
                }
                value={partyNameOf(selectedBooking)}
              />
              <DetailRow label="Player" value={selectedBooking.playerName || "—"} />
              <DetailRow label="Sport" value={selectedBooking.sport || "—"} />
              <DetailRow label="Date" value={formatDate(selectedBooking.date)} />
              <DetailRow
                label="Time"
                value={`${formatTime(selectedBooking.startTime)} – ${formatTime(selectedBooking.endTime)}`}
              />
              {selectedBooking.checkInCode && (
                <DetailRow
                  label="Check-in code"
                  value={<span className="font-mono">{selectedBooking.checkInCode}</span>}
                />
              )}
              <DetailRow label="Created" value={formatDate(selectedBooking.createdAt)} />
            </DetailSection>

            <DetailSection title="History">
              <BookingTimeline subjectId={getBookingId(selectedBooking)} />
            </DetailSection>

            <DetailSection title="Payment">
              <DetailRow
                label="Total amount"
                value={
                  <span className="text-base font-semibold text-slate-900">
                    {formatCurrency(selectedBooking.totalAmount)}
                  </span>
                }
              />
              {selectedBooking.serviceFee != null && (
                <DetailRow label="Service fee" value={formatCurrency(selectedBooking.serviceFee)} />
              )}
              {selectedBooking.taxAmount != null && (
                <DetailRow label="Tax" value={formatCurrency(selectedBooking.taxAmount)} />
              )}
            </DetailSection>

            {selectedBooking.payments && selectedBooking.payments.length > 0 && (
              <DetailSection title="Payout splits">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">Payee</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBooking.payments.map((payment, index) => (
                        <tr key={`${payment.userType}-${index}`}>
                          <td className="px-3 py-2 text-slate-700">
                            {payment.userType.replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <StatusBadge status={payment.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DetailSection>
            )}

            {actionType && (
              <DetailSection title={actionType === "REFUND" ? "Process refund" : "Handle dispute"}>
                {actionType === "REFUND" ? (
                  <select
                    value={refundType}
                    onChange={(event) => setRefundType(event.target.value as "FULL" | "PARTIAL")}
                    className={fieldClass}
                  >
                    <option value="FULL">Full refund</option>
                    <option value="PARTIAL">Partial refund</option>
                  </select>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={disputeType}
                      onChange={(event) =>
                        setDisputeType(
                          event.target.value as
                            "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER"
                        )
                      }
                      className={fieldClass}
                    >
                      <option value="NO_SHOW">No show</option>
                      <option value="POOR_QUALITY">Poor quality</option>
                      <option value="PAYMENT_ISSUE">Payment issue</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <select
                      value={resolution}
                      onChange={(event) =>
                        setResolution(
                          event.target.value as "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND"
                        )
                      }
                      className={fieldClass}
                    >
                      <option value="FULL_REFUND">Full refund</option>
                      <option value="PARTIAL_REFUND">Partial refund</option>
                      <option value="NO_REFUND">No refund</option>
                    </select>
                  </div>
                )}

                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason (required)"
                  className={fieldClass}
                />

                {actionType === "DISPUTE" && (
                  <textarea
                    rows={3}
                    value={evidence}
                    onChange={(event) => setEvidence(event.target.value)}
                    placeholder="Evidence / details (optional)"
                    className={fieldClass}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitAction}
                    disabled={actionLoading || !reason.trim()}
                    className={btn(actionType === "REFUND" ? "danger" : "primary")}
                  >
                    {actionLoading
                      ? "Submitting…"
                      : actionType === "REFUND"
                        ? "Issue refund"
                        : "Submit dispute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    disabled={actionLoading}
                    className={btn("outline")}
                  >
                    Cancel
                  </button>
                  {actionType === "REFUND" && (
                    <button
                      onClick={() => checkPhonePeRefundStatus(selectedBookingId)}
                      disabled={
                        actionLoading || Boolean(refundStatusLoadingByBookingId[selectedBookingId])
                      }
                      className={btn("outline")}
                    >
                      {refundStatusLoadingByBookingId[selectedBookingId]
                        ? "Checking…"
                        : "Check PhonePe status"}
                    </button>
                  )}
                </div>
              </DetailSection>
            )}

            {selectedRefundStatus && (
              <DetailSection title="PhonePe refund snapshot">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={selectedRefundStatus.refundStatus} />
                  <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    Amount: {formatCurrency(selectedRefundStatus.refundAmount)}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedRefundStatus.transactions.map((transaction) => (
                    <div
                      key={transaction.merchantRefundId}
                      className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
                    >
                      <p>Merchant Refund ID: {transaction.merchantRefundId}</p>
                      <p>State: {transaction.state || "PENDING"}</p>
                      <p>Amount: {formatCurrency(transaction.amount)}</p>
                      {transaction.refundId && <p>Refund ID: {transaction.refundId}</p>}
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
