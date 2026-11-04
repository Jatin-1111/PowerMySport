"use client";

import { type Order } from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { cn } from "@/utils/cn";
import { Truck } from "lucide-react";

interface SellerOrdersListProps {
  orders: Order[];
  itemStatuses: Record<string, { status: string; tracking: string }>;
  setItemStatuses: (
    updater: (
      prev: Record<string, { status: string; tracking: string }>
    ) => Record<string, { status: string; tracking: string }>
  ) => void;
  fulfillmentUpdating: string | null;
  onUpdateFulfillment: (orderId: string, variantId: string) => void;
}

export function SellerOrdersList({
  orders,
  itemStatuses,
  setItemStatuses,
  fulfillmentUpdating,
  onUpdateFulfillment,
}: SellerOrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
        <Truck className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-base font-bold text-slate-900">No marketplace orders</h3>
        <p className="mt-1 text-sm text-slate-500">
          Orders for your items will appear here after users checkout.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orders.map((o) => (
        <div
          key={o.id}
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-lg font-black text-slate-900">Order #{o.orderNumber}</h4>
              <p className="text-xs text-slate-400">
                Placed on {new Date(o.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                o.status === "DELIVERED"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700"
              )}
            >
              {o.status.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>

          {/* Buyer Details */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Buyer Details
              </p>
              <p className="mt-1 font-bold text-slate-800">{o.shippingAddress.fullName}</p>
              <p className="text-slate-600">
                {o.shippingAddress.phone} | {o.shippingAddress.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Shipping Address
              </p>
              <p className="mt-1 leading-relaxed text-slate-600">
                {o.shippingAddress.addressLine1}, {o.shippingAddress.addressLine2 || ""}
                <br />
                {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.postalCode}
              </p>
            </div>
          </div>

          {/* Seller's Items */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Items Ordered
            </p>
            {o.items.map((item) => {
              const key = `${o.id}_${item.productVariantId}`;
              const currentStatus = itemStatuses[key]?.status || "PENDING";
              const currentTracking = itemStatuses[key]?.tracking || "";
              const isFulfillmentUpdating = fulfillmentUpdating === key;

              return (
                <div
                  key={item.productVariantId}
                  className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-100 p-4 md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{item.productName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Qty: {item.quantity} | Condition: {item.condition || "USED"} | Price:{" "}
                      {formatInr(item.unitPrice)}
                    </p>
                    <p className="mt-1 text-xs font-black text-[#ff5722]">
                      Total: {formatInr(item.lineTotal)}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </label>
                      <select
                        value={currentStatus}
                        onChange={(e) => {
                          setItemStatuses((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              status: e.target.value,
                            },
                          }));
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-[#ff5722]"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <div className="flex-1 md:flex-none">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Tracking #
                      </label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={currentTracking}
                        onChange={(e) => {
                          setItemStatuses((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              tracking: e.target.value,
                            },
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-[#ff5722] md:w-32"
                      />
                    </div>
                    <button
                      onClick={() => onUpdateFulfillment(o.id, item.productVariantId)}
                      disabled={isFulfillmentUpdating}
                      className="mt-4 flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 md:mt-0"
                    >
                      {isFulfillmentUpdating ? "Saving..." : "Update"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
