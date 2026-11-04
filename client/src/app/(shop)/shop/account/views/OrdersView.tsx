"use client";

import { listOrders, type Order } from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { cn } from "@/utils/cn";
import { Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await listOrders();
        setOrders(response.orders || []);
      } catch (err: any) {
        setError(err.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#ff5722]" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">Recent Orders</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-base font-bold text-slate-900">No orders found</h3>
          <p className="mt-1 text-sm text-slate-500">You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div
              key={o.id || o._id}
              className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 p-6 transition-all hover:border-[#ff5722]/30 hover:shadow-md sm:flex-row"
            >
              <div className="flex w-full items-center gap-6 sm:w-auto">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Order #{o.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    Placed on {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                  <span
                    className={cn(
                      "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ring-1 ring-inset",
                      o.status === "DELIVERED"
                        ? "bg-emerald-50 text-emerald-700 ring-green-600/20"
                        : o.status === "CANCELLED"
                          ? "bg-red-50 text-red-700 ring-red-600/20"
                          : "bg-indigo-50 text-indigo-700 ring-blue-600/20"
                    )}
                  >
                    {o.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex w-full flex-row items-center justify-between gap-2 sm:mt-0 sm:w-auto sm:flex-col sm:items-end">
                <p className="text-lg font-black text-slate-900">{formatInr(o.totalAmount)}</p>
                <Link
                  href={`/shop/orders/${o.id || o._id}`}
                  className="text-sm font-bold text-[#ff5722] hover:underline"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
