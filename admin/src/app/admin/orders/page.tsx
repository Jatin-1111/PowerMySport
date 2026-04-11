"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminOrderRecord,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const STATUS_OPTIONS = [
  "",
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminEcommerceApi.listOrders({
        page: 1,
        limit: 50,
        status: status || undefined,
      });
      setOrders(response.data?.orders || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Ecommerce"
        title="Orders"
        subtitle="Monitor merchandise order and payment status in real time."
      />

      <Card className="bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-slate-500">Total visible orders</p>
            <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "ALL"} value={option}>
                  {option || "ALL"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-10 text-center">Loading orders...</div>
      ) : null}

      {error ? (
        <Card className="bg-white">
          <div className="p-5 text-sm font-semibold text-red-600">{error}</div>
        </Card>
      ) : null}

      {!loading && !error ? (
        <Card className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Order Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Fulfillment
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.status}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.paymentStatus}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.fulfillmentStatus}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatInr(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
