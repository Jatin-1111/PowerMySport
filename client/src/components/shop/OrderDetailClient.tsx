"use client";

import {
  downloadOrderInvoice,
  getOrderById,
  syncOrderPayment,
  type Order,
} from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [syncingPayment, setSyncingPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // After the PhonePe redirect the order can still read PENDING_PAYMENT until
    // the gateway settles (and webhooks may lag or not reach local dev). Poll
    // our sync endpoint a few times so the status updates without a manual step.
    async function reconcilePendingPayment() {
      setSyncingPayment(true);
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const updated = await syncOrderPayment(orderId);
          if (cancelled) return;
          setOrder(updated);
          if (updated.status !== "PENDING_PAYMENT") break;
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      } catch {
        // Non-fatal — the shopper can refresh the page to retry.
      } finally {
        if (!cancelled) setSyncingPayment(false);
      }
    }

    async function load() {
      try {
        const data = await getOrderById(orderId);
        if (cancelled) return;
        setOrder(data);
        setStatus("ready");
        if (data.status === "PENDING_PAYMENT") {
          void reconcilePendingPayment();
        }
      } catch (err: any) {
        if (cancelled) return;
        setMessage(err.message || "Failed to load order.");
        setStatus("error");
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Backend marks captured payments as "CAPTURED"; treat legacy "PAID" the same.
  const isPaid =
    order?.paymentStatus === "PAID" || order?.paymentStatus === "CAPTURED";

  const handleDownloadInvoice = async () => {
    if (!order) return;

    setDownloadingInvoice(true);
    try {
      const blob = await downloadOrderInvoice(orderId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Invoice downloaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to download invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200"></div>
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-slate-200"></div>
      </div>
    );
  }

  if (status === "error" || !order) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 flex items-center gap-3">
          <AlertCircle className="h-6 w-6" />
          {message}
        </div>
        <Link
          href="/shop/orders"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </div>
    );
  }

  // Determine Stepper State
  const steps = [
    {
      id: "placed",
      name: "Order Placed",
      description: new Date(order.createdAt).toLocaleString("en-IN"),
      icon: Package,
      status: "complete" as const,
    },
    {
      id: "payment",
      name: "Payment Confirmed",
      description: isPaid
        ? "Payment received successfully"
        : syncingPayment
          ? "Confirming your payment…"
          : "Pending or failed",
      icon: CheckCircle2,
      status: isPaid ? ("complete" as const) : ("current" as const),
    },
    {
      id: "shipped",
      name: "Shipped",
      description: order.trackingNumber
        ? `Tracking: ${order.trackingNumber}`
        : "Waiting to be shipped",
      icon: Truck,
      status:
        order.fulfillmentStatus === "SHIPPED" ||
        order.fulfillmentStatus === "DELIVERED"
          ? ("complete" as const)
          : order.fulfillmentStatus === "PROCESSING" && isPaid
            ? ("current" as const)
            : ("upcoming" as const),
    },
    {
      id: "delivered",
      name: "Delivered",
      description: order.estimatedDeliveryDate
        ? `Estimated: ${new Date(order.estimatedDeliveryDate).toLocaleDateString("en-IN")}`
        : "Pending schedule",
      icon: MapPin,
      status:
        order.fulfillmentStatus === "DELIVERED"
          ? ("complete" as const)
          : ("upcoming" as const),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/shop/orders"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Order #{order.orderNumber}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Placed on{" "}
            {new Date(order.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold tracking-wider text-slate-700 uppercase">
            {order.status}
          </span>
          <button
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice || !isPaid}
            title={
              !isPaid ? "Invoice is available once payment is confirmed" : ""
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />{" "}
            {downloadingInvoice ? "Downloading..." : "Invoice"}
          </button>
        </div>
      </div>

      {syncingPayment && !isPaid && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          <Clock className="h-4 w-4 animate-pulse" />
          Confirming your payment with the gateway…
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        {/* Left Column: Tracking & Items */}
        <div className="space-y-10">
          {/* Tracking Stepper */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">
              Tracking Status
            </h2>
            <div className="mt-8 flow-root">
              <ul role="list" className="-mb-8">
                {steps.map((step, stepIdx) => (
                  <li key={step.id}>
                    <div className="relative pb-8">
                      {stepIdx !== steps.length - 1 ? (
                        <span
                          className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-slate-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex items-start gap-4">
                        <span
                          className={cn(
                            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                            step.status === "complete"
                              ? "border-[#ff5722] bg-[#ff5722]"
                              : step.status === "current"
                                ? "border-[#ff5722] bg-white"
                                : "border-slate-200 bg-white",
                          )}
                        >
                          <step.icon
                            className={cn(
                              "h-5 w-5",
                              step.status === "complete"
                                ? "text-white"
                                : step.status === "current"
                                  ? "text-[#ff5722]"
                                  : "text-slate-400",
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">
                            {step.name}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Line Items */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="text-xl font-black text-slate-950">
                Items Ordered
              </h2>
            </div>
            <ul role="list" className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <li key={item.id} className="flex p-6 sm:p-8">
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">
                          {item.productName}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.variantLabel}
                        </p>
                      </div>
                      <p className="text-lg font-black text-slate-900">
                        {formatInr(item.lineTotal)}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <p className="text-slate-600">Qty {item.quantity}</p>
                      <p className="font-medium text-slate-500">
                        {formatInr(item.unitPrice)} each
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right Column: Order Summary & Info */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Order Summary</h2>
            <dl className="mt-6 flex flex-col gap-y-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-slate-900">
                  {formatInr(order.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Shipping</dt>
                <dd className="font-medium text-slate-900">
                  {formatInr(order.shippingAmount)}
                </dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Tax</dt>
                <dd className="font-medium text-slate-900">
                  {formatInr(order.taxAmount)}
                </dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount</dt>
                  <dd className="font-medium">
                    -{formatInr(order.discountAmount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-4 text-base font-black text-slate-950">
                <dt>Total</dt>
                <dd>{formatInr(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              Shipping Address
            </h2>
            <div className="mt-4 text-sm text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">
                {order.shippingAddress.fullName}
              </p>
              <p>{order.shippingAddress.addressLine1}</p>
              {order.shippingAddress.addressLine2 && (
                <p>{order.shippingAddress.addressLine2}</p>
              )}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              <p className="pt-2">Phone: {order.shippingAddress.phone}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              Payment Information
            </h2>
            <div className="mt-4 text-sm text-slate-600 space-y-1">
              <p className="flex justify-between">
                <span className="font-medium">Method:</span>{" "}
                {order.paymentMethod}
              </p>
              <p className="flex justify-between">
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={
                    isPaid
                      ? "text-emerald-600 font-bold"
                      : "text-amber-600 font-bold"
                  }
                >
                  {isPaid ? "PAID" : order.paymentStatus}
                </span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
