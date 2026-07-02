"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminOrderDetailRecord,
  AdminOrderRecord,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { Card } from "@/modules/shared/ui/Card";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import {
  AdminDataTable,
  AdminDataTableColumn,
} from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { X } from "lucide-react";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const getCustomer = (userId: AdminOrderRecord["userId"]) =>
  userId && typeof userId === "object"
    ? { name: userId.name || null, email: userId.email || null }
    : { name: null, email: null };

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

type SortBy = "createdAt" | "totalAmount" | "orderNumber";

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading orders...</div>}>
      <AdminOrdersPageContent />
    </Suspense>
  );
}

function AdminOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const pageParam = Number(searchParams.get("page"));
  const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;

  const setPage = (newPage: number) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set("page", String(newPage));
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<AdminOrderDetailRecord | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminEcommerceApi.listOrders({
        page,
        limit: 20,
        status: status || undefined,
        search: search || undefined,
        sortBy,
        sortOrder,
      });
      setOrders(response.data?.orders || []);
      setTotalPages(response.data?.pages || 1);
      setTotal(response.data?.total || 0);
    } catch (e) {
      console.error(e);
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(loadOrders, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadOrders, search]);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const openOrderDetail = async (order: AdminOrderRecord) => {
    setSelectedOrderId(order.id);
    setDetailLoading(true);
    setOrderDetail(null);
    try {
      const response = await adminEcommerceApi.getOrderDetail(order.id);
      if (response.ok && response.data) {
        setOrderDetail(response.data.order);
      } else {
        toast.error(response.error?.message || "Failed to load order detail.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load order detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeOrderDetail = () => {
    setSelectedOrderId(null);
    setOrderDetail(null);
  };

  const handleFulfillmentStatusChange = async (nextStatus: string) => {
    if (!selectedOrderId) return;
    setStatusUpdating(true);
    try {
      const response = await adminEcommerceApi.updateOrderFulfillmentStatus(
        selectedOrderId,
        nextStatus,
      );
      if (response.ok && response.data) {
        setOrderDetail(response.data.order);
        toast.success("Fulfillment status updated.");
        await loadOrders();
      } else {
        toast.error(response.error?.message || "Failed to update status.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSortChange = (column: string) => {
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column as SortBy);
      setSortOrder("desc");
    }
  };

  const columns: AdminDataTableColumn<AdminOrderRecord>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      sortable: true,
      render: (order) => (
        <span className="font-semibold text-slate-900">
          {order.orderNumber}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (order) => {
        const customer = getCustomer(order.userId);
        return <EntityBadge name={customer.name} email={customer.email} size="sm" />;
      },
    },
    {
      key: "status",
      header: "Order Status",
      render: (order) => order.status,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      render: (order) => order.paymentStatus,
    },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      render: (order) => order.fulfillmentStatus,
    },
    {
      key: "totalAmount",
      header: "Total",
      sortable: true,
      render: (order) => formatInr(order.totalAmount),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (order) => new Date(order.createdAt).toLocaleDateString("en-IN"),
    },
  ];

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
            <p className="text-sm text-slate-500">Total orders</p>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
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

      {error ? (
        <Card className="bg-white">
          <div className="p-5 text-sm font-semibold text-red-600">{error}</div>
        </Card>
      ) : (
        <Card className="bg-white">
          <AdminDataTable
            columns={columns}
            rows={orders}
            getRowKey={(order) => order.id}
            loading={loading}
            emptyMessage="No orders found."
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by order number...",
            }}
            sort={{ column: sortBy, direction: sortOrder, onChange: handleSortChange }}
            pagination={{ page, totalPages, onPageChange: setPage, total }}
            onRowClick={openOrderDetail}
            toolbarExtra={
              <ExportCsvButton
                filename="orders.csv"
                rows={orders}
                label="Export Page CSV"
                columns={[
                  { header: "Order #", value: (o) => o.orderNumber },
                  {
                    header: "Customer Name",
                    value: (o) => getCustomer(o.userId).name,
                  },
                  {
                    header: "Customer Email",
                    value: (o) => getCustomer(o.userId).email,
                  },
                  { header: "Order Status", value: (o) => o.status },
                  { header: "Payment Status", value: (o) => o.paymentStatus },
                  {
                    header: "Fulfillment Status",
                    value: (o) => o.fulfillmentStatus,
                  },
                  {
                    header: "Total (INR)",
                    value: (o) => (o.totalAmount / 100).toFixed(2),
                  },
                  {
                    header: "Created",
                    value: (o) => new Date(o.createdAt).toISOString(),
                  },
                ]}
              />
            }
          />
        </Card>
      )}

      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeOrderDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !orderDetail ? (
              <div className="py-10 text-center text-slate-500">
                Loading order detail...
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {orderDetail.orderNumber}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Placed {new Date(orderDetail.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    onClick={closeOrderDetail}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </p>
                  <EntityBadge {...getCustomer(orderDetail.userId)} />
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Line items
                  </p>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {orderDetail.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.variantLabel} · Qty {item.quantity} · {item.fulfillmentStatus}
                          </p>
                        </div>
                        <p className="font-semibold text-slate-900">
                          {formatInr(item.lineTotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-slate-500">Subtotal</p>
                    <p className="font-semibold text-slate-900">
                      {formatInr(orderDetail.subtotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tax</p>
                    <p className="font-semibold text-slate-900">
                      {formatInr(orderDetail.taxAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Shipping</p>
                    <p className="font-semibold text-slate-900">
                      {formatInr(orderDetail.shippingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className="font-semibold text-power-orange">
                      {formatInr(orderDetail.totalAmount)}
                    </p>
                  </div>
                </div>

                {orderDetail.shippingAddress && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Shipping address
                    </p>
                    <p>{orderDetail.shippingAddress.fullName}</p>
                    <p>
                      {orderDetail.shippingAddress.addressLine1}
                      {orderDetail.shippingAddress.addressLine2
                        ? `, ${orderDetail.shippingAddress.addressLine2}`
                        : ""}
                    </p>
                    <p>
                      {orderDetail.shippingAddress.city},{" "}
                      {orderDetail.shippingAddress.state}{" "}
                      {orderDetail.shippingAddress.postalCode}
                    </p>
                    <p>{orderDetail.shippingAddress.phone}</p>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fulfillment status
                  </p>
                  <select
                    value={orderDetail.fulfillmentStatus}
                    disabled={statusUpdating}
                    onChange={(e) => handleFulfillmentStatusChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(
                      (option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
