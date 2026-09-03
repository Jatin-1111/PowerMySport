"use client";

import { AddressManagement } from "@/modules/shop/components/AddressManagement";
import { ProductCard } from "@/modules/shop/components/ProductCard";
import {
  createSellerProduct,
  deleteSellerProduct,
  listOrders,
  listSellerOrders,
  listSellerProducts,
  updateSellerOrderItemFulfillment,
  updateSellerProduct,
  type Order,
  type Product,
} from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { useWishlistStore } from "@/lib/shop/wishlistStore";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { walletApi, type Wallet as WalletType } from "@/modules/wallet/services/wallet";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  CreditCard,
  Edit2,
  Heart,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Truck,
  UserSquare,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const tabs = [
  { id: "orders", name: "Orders", icon: Package },
  { id: "balance", name: "Balance Amount", icon: Wallet },
  { id: "saved", name: "Saved Items", icon: Heart },
  { id: "address", name: "Address", icon: MapPin },
  { id: "contact", name: "Contact Details", icon: UserSquare },
  { id: "selling", name: "Seller Dashboard", icon: CreditCard },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && tabs.some((t) => t.id === tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tabId);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">My Account</h1>
        <p className="mt-2 text-slate-500">Manage your orders, balance, and personal details.</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-72">
          <nav className="flex flex-col gap-2 rounded-[2rem] border border-slate-200/60 bg-white p-4 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-2xl px-4 py-4 text-sm font-bold transition-all",
                    isActive
                      ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform group-hover:scale-110",
                        isActive ? "text-white" : "text-slate-400"
                      )}
                    />
                    {tab.name}
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isActive ? "text-white/80" : "text-slate-300 group-hover:translate-x-1"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-h-[500px] flex-1 rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "orders" && <OrdersView />}
              {activeTab === "balance" && <BalanceView />}
              {activeTab === "saved" && <SavedItemsView />}
              {activeTab === "address" && <AddressManagement />}
              {activeTab === "contact" && <ContactView />}
              {activeTab === "selling" && <SellerDashboardView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function OrdersView() {
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

function BalanceView() {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch (err: any) {
      setError(err.message || "Failed to load wallet details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleAddFunds = () => {
    window.location.href = "/dashboard/wallet";
  };

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

  const balance = wallet ? wallet.balance : 0;
  const transactions = wallet ? wallet.transactions : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">PowerMySport Wallet</h2>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff5722] opacity-20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Available Balance
            </p>
            <p className="mt-2 text-5xl font-black text-white">{formatInr(balance)}</p>
          </div>
          <button
            onClick={handleAddFunds}
            className="flex items-center gap-2 rounded-xl bg-[#ff5722] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#ff5722]/30 transition-all hover:bg-[#e64a19] active:scale-95"
          >
            <CreditCard className="h-4 w-4" />
            Add Funds
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
            No transactions recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full font-bold",
                      t.type === "CREDIT"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-red-100 text-red-600"
                    )}
                  >
                    {t.type === "CREDIT" ? "+" : "-"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {t.reason || (t.type === "CREDIT" ? "Wallet Topup" : "Purchase")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "font-bold",
                    t.type === "CREDIT" ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {t.type === "CREDIT" ? "+" : "-"} {formatInr(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedItemsView() {
  const { wishlistProducts, isLoading, fetchWishlist } = useWishlistStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      fetchWishlist(true);
    }
  }, [user, fetchWishlist]);

  if (!user) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
        Please log in to view your saved items.
      </div>
    );
  }

  if (isLoading && wishlistProducts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#ff5722]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Saved Items</h2>
          <p className="text-sm text-slate-500">Your curated collection of gear on Powermysport</p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
          {wishlistProducts.length} Items
        </span>
      </div>

      {wishlistProducts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <Heart className="mx-auto h-12 w-12 animate-pulse text-slate-300" />
          <h3 className="mt-4 text-base font-bold text-slate-900">No saved items</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add sports gear to your wishlist while browsing the marketplace.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#ff5722] px-5 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 transition-all hover:bg-[#e64a19] active:scale-95"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {wishlistProducts.map((product) => (
            <ProductCard key={product.id || product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactView() {
  const { user } = useAuthStore();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Contact Details</h2>
        <Link
          href="/dashboard/my-profile"
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900"
        >
          <Edit2 className="h-4 w-4" /> Edit Profile
        </Link>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="flex items-center gap-6 border-b border-slate-100 pb-8">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <UserSquare className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
            <p className="text-sm text-slate-500">Member since 2024</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</p>
            <p className="mt-1 font-semibold text-slate-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Email Address
            </p>
            <p className="mt-1 font-semibold text-slate-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Phone Number
            </p>
            <p className="mt-1 font-semibold text-slate-900">{user.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Preferred Sport
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {user.playerProfile?.sportsFocus?.join(", ") || "None specified"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellerDashboardView() {
  const [sellingTab, setSellingTab] = useState<"listings" | "sell" | "orders">("listings");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit Listing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  // Create Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("EQUIPMENT");
  const [brand, setBrand] = useState("GENERIC");
  const [basePrice, setBasePrice] = useState("");
  const [condition, setCondition] = useState<"NEW" | "USED">("USED");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");

  // Item Fulfillment State
  const [fulfillmentUpdating, setFulfillmentUpdating] = useState<string | null>(null);
  const [itemStatuses, setItemStatuses] = useState<
    Record<string, { status: string; tracking: string }>
  >({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetchedProducts = await listSellerProducts();
      setProducts(fetchedProducts);
      const fetchedOrders = await listSellerOrders();
      setOrders(fetchedOrders);

      // Initialize status inputs for orders
      const statuses: Record<string, { status: string; tracking: string }> = {};
      fetchedOrders.forEach((o) => {
        o.items.forEach((item) => {
          const key = `${o.id}_${item.productVariantId}`;
          statuses[key] = {
            status: item.fulfillmentStatus || "PENDING",
            tracking: item.trackingNumber || "",
          };
        });
      });
      setItemStatuses(statuses);
    } catch (err: any) {
      toast.error(err.message || "Failed to load seller dashboard details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const images = imageUrl.trim() ? [imageUrl.trim()] : [];
      await createSellerProduct({
        name,
        description,
        category,
        brand,
        basePrice: Number(basePrice) * 100,
        stock: Number(stock),
        condition,
        images,
      });

      toast.success("Gear listed on the marketplace.");
      // Reset form
      setName("");
      setDescription("");
      setBasePrice("");
      setStock("1");
      setImageUrl("");
      setCondition("USED");
      setBrand("GENERIC");

      // Go back to listings
      setSellingTab("listings");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to list product. Please verify fields.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (productId: string) => {
    setLoading(true);

    try {
      await updateSellerProduct(productId, {
        basePrice: Number(editPrice) * 100,
        stock: Number(editStock),
      });
      toast.success("Listing updated.");
      setEditingId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update listing.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setLoading(true);

    try {
      await deleteSellerProduct(productId);
      toast.success("Listing removed.");
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete listing.");
    } finally {
      setLoading(false);
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
      await fetchData();
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
            onClick={fetchData}
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
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No active listings</h3>
              <p className="mt-1 text-sm text-slate-500">
                Put your unused sports items for sale right now.
              </p>
              <button
                onClick={() => setSellingTab("sell")}
                className="mt-4 text-sm font-bold text-[#ff5722] hover:underline"
              >
                Create Listing &rarr;
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-500">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Condition</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Stock</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {products.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {p.images?.[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
                                  No Img
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-400">SKU: {p.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {p.category}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                                p.condition === "USED"
                                  ? "bg-slate-900 text-white"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              {p.condition}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-bold text-slate-900">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-28 rounded-lg border border-slate-300 p-1 text-sm text-slate-900"
                              />
                            ) : (
                              formatInr(p.basePrice)
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editStock}
                                onChange={(e) => setEditStock(e.target.value)}
                                className="w-16 rounded-lg border border-slate-300 p-1 text-sm text-slate-900"
                              />
                            ) : (
                              p.totalStock
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateProduct(p.id)}
                                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="rounded p-1 text-slate-500 hover:bg-slate-50"
                                    title="Cancel"
                                  >
                                    &times;
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingId(p.id);
                                      setEditPrice(String(p.basePrice / 100));
                                      setEditStock(String(p.totalStock));
                                    }}
                                    className="rounded p-1 text-[#ff5722] hover:bg-[#ff5722]/5"
                                    title="Edit Price/Stock"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  {deleteConfirmId === p.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(p.id)}
                                      className="rounded p-1 text-red-600 hover:bg-red-50"
                                      title="Deactivate Listing"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {sellingTab === "sell" && (
        <form
          onSubmit={handleCreateProduct}
          className="max-w-2xl space-y-6 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-6 sm:p-8"
        >
          <h3 className="text-lg font-black text-slate-900">Gear Listing Form</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Product Name
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Kookaburra English Willow Bat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe details like use time, scratches, dimensions, size..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              >
                <option value="EQUIPMENT">Equipment</option>
                <option value="APPAREL">Apparel</option>
                <option value="FOOTWEAR">Footwear</option>
                <option value="ACCESSORIES">Accessories</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Brand
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              >
                <option value="GENERIC">Generic</option>
                <option value="NIKE">Nike</option>
                <option value="ADIDAS">Adidas</option>
                <option value="PUMA">Puma</option>
                <option value="SG">SG</option>
                <option value="SS">SS</option>
                <option value="MRF">MRF</option>
                <option value="CEAT">CEAT</option>
                <option value="KOOKABURRA">Kookaburra</option>
                <option value="UNDER_ARMOUR">Under Armour</option>
                <option value="ASICS">Asics</option>
                <option value="WILSON">Wilson</option>
                <option value="YONEX">Yonex</option>
                <option value="BABOLAT">Babolat</option>
                <option value="HEAD">Head</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              >
                <option value="USED">Pre-owned / Used</option>
                <option value="NEW">Brand New / Unused</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Price (INR)
              </label>
              <input
                required
                type="number"
                min="1"
                placeholder="₹ Amount"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Stock quantity
              </label>
              <input
                required
                type="number"
                min="1"
                placeholder="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Gear Image URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/gear.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#ff5722]"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[#ff5722] py-3 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 transition hover:bg-[#e64a19] disabled:opacity-50"
            >
              List Item
            </button>
            <button
              type="button"
              onClick={() => setSellingTab("listings")}
              className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sellingTab === "orders" && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
              <Truck className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No marketplace orders</h3>
              <p className="mt-1 text-sm text-slate-500">
                Orders for your items will appear here after users checkout.
              </p>
            </div>
          ) : (
            orders.map((o) => (
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
                      {o.shippingAddress.city}, {o.shippingAddress.state} -{" "}
                      {o.shippingAddress.postalCode}
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
                                setItemStatuses({
                                  ...itemStatuses,
                                  [key]: {
                                    ...itemStatuses[key],
                                    status: e.target.value,
                                  },
                                });
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
                                setItemStatuses({
                                  ...itemStatuses,
                                  [key]: {
                                    ...itemStatuses[key],
                                    tracking: e.target.value,
                                  },
                                });
                              }}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-[#ff5722] md:w-32"
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateFulfillment(o.id, item.productVariantId)}
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
