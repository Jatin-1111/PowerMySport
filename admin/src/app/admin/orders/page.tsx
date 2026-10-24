"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  AdminOrderDetailRecord,
  AdminOrderRecord,
  adminEcommerceApi,
} from "@/modules/admin/services/ecommerce";
import { fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { EntityBadge } from "@/modules/shared/ui/EntityBadge";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { toast } from "@/lib/toast";
import { X } from "lucide-react";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

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
    <Suspense fallback={<SkeletonBlock rows={6} label="Loading orders" />}>
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
  const [orderDetail, setOrderDetail] = useState<AdminOrderDetailRecord | null>(null);
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

  const [pendingCancel, setPendingCancel] = useState(false);

  const handleFulfillmentStatusChange = async (nextStatus: string) => {
    if (!selectedOrderId) return;
    setStatusUpdating(true);
    try {
      const response = await adminEcommerceApi.updateOrderFulfillmentStatus(
        selectedOrderId,
        nextStatus
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
      render: (order) => <span className="font-semibold text-slate-900">{order.orderNumber}</span>,
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
      render: (order) => <StatusBadge status={order.paymentStatus} size="sm" />,
    },
    {
      key: "fulfillmentStatus",
      header: "Fulfillment",
      render: (order) => <StatusBadge status={order.fulfillmentStatus} size="sm" />,
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
        badge="Commerce"
        title="Orders"
        subtitle="Merchandise orders, their payment status and where each one is in fulfilment."
      />

      <div className="flex items-center gap-2">
        <label htmlFor="order-status" className="text-sm text-slate-600">
          Status
        </label>
        <select
          id="order-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`${fieldClass} !w-auto`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option || "ALL"} value={option}>
              {option
                ? option
                    .replace(/_/g, " ")
                    .toLowerCase()
                    .replace(/^./, (c) => c.toUpperCase())
                : "All orders"}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorNotice message={error} />
      ) : (
        <>
          <AdminDataTable
            columns={columns}
            rows={orders}
            getRowKey={(order) => order.id}
            loading={loading}
            emptyMessage="No orders match"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by order number",
            }}
            sort={{
              column: sortBy,
              direction: sortOrder,
              onChange: handleSortChange,
            }}
            pagination={{ page, totalPages, onPageChange: setPage, total }}
            onRowClick={openOrderDetail}
            toolbarExtra={
              <ExportCsvButton
                filename="orders.csv"
                rows={orders}
                label="Export this page (CSV)"
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
        </>
      )}

      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={closeOrderDetail}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Order detail"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !orderDetail ? (
              <SkeletonBlock rows={6} label="Loading order detail" />
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {orderDetail.orderNumber}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Placed {new Date(orderDetail.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeOrderDetail}
                    aria-label="Close"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <p className="mb-1 text-sm text-slate-500">Customer</p>
                  <EntityBadge {...getCustomer(orderDetail.userId)} />
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-sm text-slate-500">Line items</p>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {orderDetail.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{item.productName}</p>
                          <p className="text-xs text-slate-500">
                            {item.variantLabel} · Qty {item.quantity} · {item.fulfillmentStatus}
                          </p>
                        </div>
                        <p className="font-semibold text-slate-900">{formatInr(item.lineTotal)}</p>
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
                    <p className="font-semibold text-slate-900">
                      {formatInr(orderDetail.totalAmount)}
                    </p>
                  </div>
                </div>

                {orderDetail.shippingAddress && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                    <p className="mb-1 text-sm text-slate-500">Shipping address</p>
                    <p>{orderDetail.shippingAddress.fullName}</p>
                    <p>
                      {orderDetail.shippingAddress.addressLine1}
                      {orderDetail.shippingAddress.addressLine2
                        ? `, ${orderDetail.shippingAddress.addressLine2}`
                        : ""}
                    </p>
                    <p>
                      {orderDetail.shippingAddress.city}, {orderDetail.shippingAddress.state}{" "}
                      {orderDetail.shippingAddress.postalCode}
                    </p>
                    <p>{orderDetail.shippingAddress.phone}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="fulfilment-status" className={labelClass}>
                    Fulfilment status
                  </label>
                  <select
                    id="fulfilment-status"
                    value={orderDetail.fulfillmentStatus}
                    disabled={statusUpdating}
                    onChange={(e) => {
                      // Cancelling is the one status change that ends the order, so it asks first.
                      if (e.target.value === "CANCELLED") setPendingCancel(true);
                      else handleFulfillmentStatusChange(e.target.value);
                    }}
                    className={fieldClass}
                  >
                    {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(
                      (option) => (
                        <option key={option} value={option}>
                          {option.charAt(0) + option.slice(1).toLowerCase()}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={pendingCancel}
        variant="danger"
        title="Cancel this order?"
        description="The order will be marked as cancelled."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        loading={statusUpdating}
        onConfirm={async () => {
          await handleFulfillmentStatusChange("CANCELLED");
          setPendingCancel(false);
        }}
        onCancel={() => setPendingCancel(false)}
      />
    </div>
  );
}
