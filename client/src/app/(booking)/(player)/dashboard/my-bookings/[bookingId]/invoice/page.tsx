"use client";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { toast } from "@/lib/toast";
import { bookingApi } from "@/modules/booking/services/booking";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Booking, Coach, Venue } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const formatCurrency = (value?: number) => {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const asVenue = (value: Booking["venueId"]): Venue | null => {
  if (value && typeof value === "object") {
    return value as Venue;
  }
  return null;
};

const asCoach = (value: Booking["coachId"]): Coach | null => {
  if (value && typeof value === "object") {
    return value as Coach;
  }
  return null;
};

const asUser = (
  value?: Booking["userId"],
): { name?: string; email?: string; phone?: string } | null => {
  if (value && typeof value === "object") {
    return value as { name?: string; email?: string; phone?: string };
  }
  return null;
};

const canViewInvoice = (status: Booking["status"]): boolean => {
  return ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status);
};

export default function BookingInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = (params?.bookingId as string) || "";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        setLoading(true);
        const response = await bookingApi.getBooking(bookingId);
        if (!response.success || !response.data) {
          throw new Error(response.message || "Invoice data not available");
        }
        setBooking(response.data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load invoice";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const venue = useMemo(() => asVenue(booking?.venueId), [booking?.venueId]);
  const coach = useMemo(() => asCoach(booking?.coachId), [booking?.coachId]);
  const customer = useMemo(() => asUser(booking?.userId), [booking?.userId]);

  const invoiceNumber = useMemo(() => {
    if (!booking?.id) return "-";
    const datePart = booking?.date
      ? new Date(booking.date).toISOString().slice(0, 10).replace(/-/g, "")
      : new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = booking.id.slice(-6).toUpperCase();
    return `INV-${datePart}-${suffix}`;
  }, [booking?.date, booking?.id]);

  const issueDate = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  if (loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading invoice...</p>
      </Card>
    );
  }

  if (!booking) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Invoice not found.</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.back()}
        >
          Go back
        </Button>
      </Card>
    );
  }

  const subtotal =
    booking.totalAmount -
    (booking.serviceFee || 0) -
    (booking.taxAmount || 0) +
    (booking.discountAmount || 0);
  const discount = booking.discountAmount || 0;
  const serviceFee = booking.serviceFee || 0;
  const taxAmount = booking.taxAmount || 0;

  const providerName =
    venue?.name ||
    (coach ? `${coach.sports?.[0] || "Coach"} Coach` : "Provider");
  const providerAddress =
    venue?.address || coach?.ownVenueDetails?.address || "-";
  const providerGst =
    (venue as any)?.gstNumber || (coach as any)?.gstNumber || "-";
  const isInvoiceAvailable = canViewInvoice(booking.status);

  if (!isInvoiceAvailable) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Bookings", href: "/dashboard/my-bookings" },
            { label: "Invoice" },
          ]}
        />

        <PlayerPageHeader
          badge="Pending"
          title="Invoice not available yet"
          subtitle="Your booking is pending coach confirmation. Invoice will be generated once the booking is confirmed."
          action={
            <Link href="/dashboard/my-bookings">
              <Button variant="outline">Back to bookings</Button>
            </Link>
          }
        />

        <Card className="bg-white p-6">
          <p className="text-sm text-slate-700">
            Current booking status:{" "}
            <span className="font-semibold">
              {booking.status.replace(/_/g, " ")}
            </span>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Bookings", href: "/dashboard/my-bookings" },
          { label: "Invoice" },
        ]}
      />

      <PlayerPageHeader
        badge="Invoice"
        title="Booking Invoice"
        subtitle="Download or print your invoice for this booking."
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const pdfBlob = await bookingApi.downloadInvoicePdf(
                    booking.id,
                  );
                  const url = window.URL.createObjectURL(pdfBlob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${invoiceNumber}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Unable to download invoice";
                  toast.error(message);
                }
              }}
            >
              Download PDF
            </Button>
            <Link href="/dashboard/my-bookings">
              <Button variant="outline">Back to bookings</Button>
            </Link>
          </div>
        }
      />

      <Card className="bg-white p-6 sm:p-8 print:shadow-none print:border-none">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Invoice
            </p>
            <h1 className="text-2xl font-bold text-slate-900">PowerMySport</h1>
            <p className="mt-2 text-sm text-slate-600">
              Thank you for booking with PowerMySport.
            </p>
          </div>
          <div className="text-sm text-slate-700">
            <p className="font-semibold">Invoice Number</p>
            <p className="text-slate-900">{invoiceNumber}</p>
            <p className="mt-2 font-semibold">Issue Date</p>
            <p className="text-slate-900">{issueDate}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billed To
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {customer?.name || "Customer"}
            </p>
            <p className="text-sm text-slate-600">{customer?.email || "-"}</p>
            <p className="text-sm text-slate-600">{customer?.phone || "-"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Provider
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {providerName}
            </p>
            <p className="text-sm text-slate-600">{providerAddress}</p>
            <p className="text-sm text-slate-600">GST: {providerGst}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Booking Summary
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Date</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatDate(booking.date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Time</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sport</p>
              <p className="text-sm font-semibold text-slate-900">
                {booking.sport}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Participant</p>
              <p className="text-sm font-semibold text-slate-900">
                {booking.participantName || customer?.name || "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pricing
          </p>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Platform Fee</span>
              <span>{formatCurrency(serviceFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Taxes</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <span>
                {discount > 0
                  ? `-${formatCurrency(discount)}`
                  : formatCurrency(0)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total Paid</span>
              <span>{formatCurrency(booking.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          This is a system generated invoice. For support, reach out to the
          PowerMySport team.
        </div>
      </Card>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body {
            background: #ffffff;
          }
        }
      `,
        }}
      />
    </div>
  );
}
