"use client";

import {
  createSellerProduct,
  deleteSellerProduct,
  listSellerOrders,
  listSellerProducts,
  updateSellerOrderItemFulfillment,
  updateSellerProduct,
} from "@/lib/shop/ecommerce-api";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/utils/cn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SellerListingsTable } from "./SellerListingsTable";
import { SellerListingForm } from "./SellerListingForm";
import { SellerOrdersList } from "./SellerOrdersList";

export function SellerDashboardView() {
  const queryClient = useQueryClient();
  const [sellingTab, setSellingTab] = useState<"listings" | "sell" | "orders">("listings");
  const [isMutating, setIsMutating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit Listing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  // Item Fulfillment State
  const [fulfillmentUpdating, setFulfillmentUpdating] = useState<string | null>(null);
  const [itemStatuses, setItemStatuses] = useState<
    Record<string, { status: string; tracking: string }>
  >({});

  const productsQuery = useQuery({
    queryKey: queryKeys.sellerDashboard.products,
    queryFn: listSellerProducts,
  });
  const ordersQuery = useQuery({
    queryKey: queryKeys.sellerDashboard.orders,
    queryFn: listSellerOrders,
  });

  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const loading = isMutating || productsQuery.isFetching || ordersQuery.isFetching;

  useEffect(() => {
    if (productsQuery.isError || ordersQuery.isError) {
      toast.error("Failed to load seller dashboard details");
    }
  }, [productsQuery.isError, ordersQuery.isError]);

  // Fulfillment status/tracking inputs are seeded from the server on every
  // successful orders fetch — same as the previous single fetchData() did,
  // including the "in-progress edit on a different row gets clobbered by an
  // unrelated refetch" quirk, which this preserves rather than fixes.
  useEffect(() => {
    if (!ordersQuery.data) return;
    const statuses: Record<string, { status: string; tracking: string }> = {};
    ordersQuery.data.forEach((o) => {
      o.items.forEach((item) => {
        const key = `${o.id}_${item.productVariantId}`;
        statuses[key] = {
          status: item.fulfillmentStatus || "PENDING",
          tracking: item.trackingNumber || "",
        };
      });
    });
    setItemStatuses(statuses);
  }, [ordersQuery.data]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
  };

  const handleCreateProduct = async (fields: {
    name: string;
    description: string;
    category: string;
    brand: string;
    basePrice: string;
    condition: "NEW" | "USED";
    stock: string;
    imageUrl: string;
  }): Promise<boolean> => {
    setIsMutating(true);

    try {
      const images = fields.imageUrl.trim() ? [fields.imageUrl.trim()] : [];
      await createSellerProduct({
        name: fields.name,
        description: fields.description,
        category: fields.category,
        brand: fields.brand,
        basePrice: Number(fields.basePrice) * 100,
        stock: Number(fields.stock),
        condition: fields.condition,
        images,
      });

      toast.success("Gear listed on the marketplace.");
      setSellingTab("listings");
      refreshAll();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to list product. Please verify fields.");
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateProduct = async (productId: string) => {
    setIsMutating(true);

    try {
      await updateSellerProduct(productId, {
        basePrice: Number(editPrice) * 100,
        stock: Number(editStock),
      });
      toast.success("Listing updated.");
      setEditingId(null);
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update listing.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setIsMutating(true);

    try {
      await deleteSellerProduct(productId);
      toast.success("Listing removed.");
      setDeleteConfirmId(null);
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete listing.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateFulfillment = async (orderId: string, variantId: string) => {
    const key = `${orderId}_${variantId}`;
    const statusData = itemStatuses[key];
    if (!statusData) return;

    setFulfillmentUpdating(key);

    try {
      await updateSellerOrderItemFulfillment(
        orderId,
        variantId,
        statusData.status,
        statusData.tracking
      );
      toast.success("Fulfillment updated.");
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update fulfillment.");
    } finally {
      setFulfillmentUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Seller Dashboard</h2>
          <p className="text-sm text-slate-500">
            Sell your pre-owned or brand new sports gear to other players.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshAll}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setSellingTab("sell")}
            className="flex items-center gap-2 rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 transition hover:bg-[#e64a19] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            List Gear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setSellingTab("listings")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-bold transition-all",
            sellingTab === "listings"
              ? "border-[#ff5722] text-[#ff5722]"
              : "border-transparent text-slate-500 hover:text-slate-950"
          )}
        >
          My Listings ({products.length})
        </button>
        <button
          onClick={() => setSellingTab("orders")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-bold transition-all",
            sellingTab === "orders"
              ? "border-[#ff5722] text-[#ff5722]"
              : "border-transparent text-slate-500 hover:text-slate-950"
          )}
        >
          Received Orders ({orders.length})
        </button>
      </div>

      {sellingTab === "listings" && (
        <SellerListingsTable
          products={products}
          editingId={editingId}
          editPrice={editPrice}
          setEditPrice={setEditPrice}
          editStock={editStock}
          setEditStock={setEditStock}
          onStartEdit={(p) => {
            setEditingId(p.id);
            setEditPrice(String(p.basePrice / 100));
            setEditStock(String(p.totalStock));
          }}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={handleUpdateProduct}
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          onDelete={handleDeleteProduct}
          onCreateListing={() => setSellingTab("sell")}
        />
      )}

      {sellingTab === "sell" && (
        <SellerListingForm
          loading={loading}
          onSubmit={handleCreateProduct}
          onCancel={() => setSellingTab("listings")}
        />
      )}

      {sellingTab === "orders" && (
        <SellerOrdersList
          orders={orders}
          itemStatuses={itemStatuses}
          setItemStatuses={setItemStatuses}
          fulfillmentUpdating={fulfillmentUpdating}
          onUpdateFulfillment={handleUpdateFulfillment}
        />
      )}
    </div>
  );
}
