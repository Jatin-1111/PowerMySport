"use client";

import React, { useState, useEffect } from "react";
import { Package, Wallet, MapPin, UserSquare, ChevronRight, CreditCard, Edit2, Plus, Trash2, Check, RefreshCw, ShoppingBag, Truck, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import { 
  listSellerProducts, 
  createSellerProduct, 
  updateSellerProduct, 
  deleteSellerProduct, 
  listSellerOrders, 
  updateSellerOrderItemFulfillment,
  listOrders,
  type Product,
  type Order,
} from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { walletApi, type Wallet as WalletType } from "@/modules/wallet/services/wallet";
import { toast } from "sonner";
import Link from "next/link";
import { useWishlistStore } from "@/lib/shop/wishlistStore";
import { ProductCard } from "@/components/shop/ProductCard";
import { AddressManagement } from "@/components/shop/AddressManagement";

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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
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
                    <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400")} />
                    {tab.name}
                  </div>
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isActive ? "text-white/80" : "text-slate-300 group-hover:translate-x-1")} />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 rounded-[2rem] border border-slate-200/60 bg-white p-6 sm:p-10 shadow-sm min-h-[500px]">
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
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">Recent Orders</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-base font-bold text-slate-900">No orders found</h3>
          <p className="mt-1 text-sm text-slate-500">You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id || o._id} className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 p-6 transition-all hover:border-[#ff5722]/30 hover:shadow-md">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Order #{o.orderNumber}</p>
                  <p className="text-sm text-slate-500">Placed on {new Date(o.createdAt).toLocaleDateString()}</p>
                  <span className={cn(
                    "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset capitalize",
                    o.status === "DELIVERED"
                      ? "bg-green-50 text-green-700 ring-green-600/20"
                      : o.status === "CANCELLED"
                      ? "bg-red-50 text-red-700 ring-red-600/20"
                      : "bg-blue-50 text-blue-700 ring-blue-600/20"
                  )}>
                    {o.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="mt-2 sm:mt-0 flex w-full sm:w-auto flex-row sm:flex-col items-center sm:items-end justify-between gap-2">
                <p className="font-black text-lg text-slate-900">{formatInr(o.totalAmount)}</p>
                <Link href={`/shop/orders/${o.id || o._id}`} className="text-sm font-bold text-[#ff5722] hover:underline">
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
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const balance = wallet ? wallet.balance : 0;
  const transactions = wallet ? wallet.transactions : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">PowerMySport Wallet</h2>
      
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff5722] opacity-20 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Available Balance</p>
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
        <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">No transactions recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl p-4 bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                    t.type === "CREDIT" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {t.type === "CREDIT" ? "+" : "-"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t.reason || (t.type === "CREDIT" ? "Wallet Topup" : "Purchase")}</p>
                    <p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className={cn("font-bold", t.type === "CREDIT" ? "text-green-600" : "text-red-600")}>
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
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50">
          <Heart className="mx-auto h-12 w-12 text-slate-300 animate-pulse" />
          <h3 className="mt-4 text-base font-bold text-slate-900">No saved items</h3>
          <p className="mt-1 text-sm text-slate-500">Add sports gear to your wishlist while browsing the marketplace.</p>
          <Link href="/shop" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#ff5722] hover:bg-[#e64a19] text-white px-5 text-sm font-bold transition-all active:scale-95 shadow-md shadow-[#ff5722]/15">
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
        <Link href="/dashboard/my-profile" className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900">
          <Edit2 className="h-4 w-4" /> Edit Profile
        </Link>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</p>
            <p className="mt-1 font-semibold text-slate-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</p>
            <p className="mt-1 font-semibold text-slate-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</p>
            <p className="mt-1 font-semibold text-slate-900">{user.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferred Sport</p>
            <p className="mt-1 font-semibold text-slate-900">{user.playerProfile?.sports?.join(", ") || "None specified"}</p>
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
  const [itemStatuses, setItemStatuses] = useState<Record<string, { status: string; tracking: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetchedProducts = await listSellerProducts();
      setProducts(fetchedProducts);
      const fetchedOrders = await listSellerOrders();
      setOrders(fetchedOrders);

      // Initialize status inputs for orders
      const statuses: Record<string, { status: string; tracking: string }> = {};
      fetchedOrders.forEach(o => {
        o.items.forEach(item => {
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

      toast.success("Your gear has been listed on the marketplace!");
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
      toast.success("Listing updated successfully!");
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
      toast.success("Listing removed successfully!");
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
      toast.success("Order fulfillment details updated successfully!");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update fulfillment.");
    } finally {
      setFulfillmentUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Seller Dashboard</h2>
          <p className="text-sm text-slate-500">Sell your pre-owned or brand new sports gear to other players.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData} 
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setSellingTab("sell")}
            className="flex items-center gap-2 rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 hover:bg-[#e64a19] transition active:scale-95"
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
            "px-4 py-2.5 text-sm font-bold border-b-2 transition-all",
            sellingTab === "listings" ? "border-[#ff5722] text-[#ff5722]" : "border-transparent text-slate-500 hover:text-slate-950"
          )}
        >
          My Listings ({products.length})
        </button>
        <button
          onClick={() => setSellingTab("orders")}
          className={cn(
            "px-4 py-2.5 text-sm font-bold border-b-2 transition-all",
            sellingTab === "orders" ? "border-[#ff5722] text-[#ff5722]" : "border-transparent text-slate-500 hover:text-slate-950"
          )}
        >
          Received Orders ({orders.length})
        </button>
      </div>

      {sellingTab === "listings" && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50">
              <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No active listings</h3>
              <p className="mt-1 text-sm text-slate-500">Put your unused sports items for sale right now.</p>
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
                                <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                  No Img
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-400">SKU: {p.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">{p.category}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                              p.condition === "USED" ? "bg-slate-900 text-white" : "bg-emerald-50 text-emerald-700"
                            )}>
                              {p.condition}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
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
                            <div className="flex justify-end gap-2 items-center">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateProduct(p.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 text-slate-500 hover:bg-slate-50 rounded"
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
                                    className="p-1 text-[#ff5722] hover:bg-[#ff5722]/5 rounded"
                                    title="Edit Price/Stock"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  {deleteConfirmId === p.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:bg-red-50 border border-red-200 px-2 py-1 rounded-lg"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(p.id)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
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
        <form onSubmit={handleCreateProduct} className="space-y-6 max-w-2xl bg-slate-50/50 p-6 sm:p-8 rounded-3xl border border-slate-200/60">
          <h3 className="text-lg font-black text-slate-900">Gear Listing Form</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Product Name</label>
              <input
                required
                type="text"
                placeholder="e.g. Kookaburra English Willow Bat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
              <textarea
                required
                rows={3}
                placeholder="Describe details like use time, scratches, dimensions, size..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              >
                <option value="EQUIPMENT">Equipment</option>
                <option value="APPAREL">Apparel</option>
                <option value="FOOTWEAR">Footwear</option>
                <option value="ACCESSORIES">Accessories</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              >
                <option value="USED">Pre-owned / Used</option>
                <option value="NEW">Brand New / Unused</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Price (INR)</label>
              <input
                required
                type="number"
                min="1"
                placeholder="₹ Amount"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Stock quantity</label>
              <input
                required
                type="number"
                min="1"
                placeholder="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Gear Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/gear.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-[#ff5722] transition shadow-sm"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[#ff5722] py-3 text-sm font-bold text-white shadow-md shadow-[#ff5722]/15 hover:bg-[#e64a19] transition disabled:opacity-50"
            >
              List Item
            </button>
            <button
              type="button"
              onClick={() => setSellingTab("listings")}
              className="px-6 py-3 border border-slate-200 hover:bg-slate-100 transition rounded-xl text-sm font-bold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sellingTab === "orders" && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-slate-50/50">
              <Truck className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No marketplace orders</h3>
              <p className="mt-1 text-sm text-slate-500">Orders for your items will appear here after users checkout.</p>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-3xl border border-slate-200 p-6 bg-white space-y-4 shadow-sm hover:shadow-md transition">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="font-black text-slate-900 text-lg">Order #{o.orderNumber}</h4>
                    <p className="text-xs text-slate-400">Placed on {new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                    o.status === "DELIVERED" ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                  )}>
                    {o.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>

                {/* Buyer Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Buyer Details</p>
                    <p className="font-bold text-slate-800 mt-1">{o.shippingAddress.fullName}</p>
                    <p className="text-slate-600">{o.shippingAddress.phone} | {o.shippingAddress.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping Address</p>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      {o.shippingAddress.addressLine1}, {o.shippingAddress.addressLine2 || ""}<br />
                      {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.postalCode}
                    </p>
                  </div>
                </div>

                {/* Seller's Items */}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Items Ordered</p>
                  {o.items.map((item) => {
                    const key = `${o.id}_${item.productVariantId}`;
                    const currentStatus = itemStatuses[key]?.status || "PENDING";
                    const currentTracking = itemStatuses[key]?.tracking || "";
                    const isFulfillmentUpdating = fulfillmentUpdating === key;

                    return (
                      <div key={item.productVariantId} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 border border-slate-100 rounded-2xl">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity} | Condition: {item.condition || "USED"} | Price: {formatInr(item.unitPrice)}</p>
                          <p className="text-xs font-black text-[#ff5722] mt-1">Total: {formatInr(item.lineTotal)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</label>
                            <select
                              value={currentStatus}
                              onChange={(e) => {
                                setItemStatuses({
                                  ...itemStatuses,
                                  [key]: { ...itemStatuses[key], status: e.target.value }
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
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tracking #</label>
                            <input
                              type="text"
                              placeholder="Optional"
                              value={currentTracking}
                              onChange={(e) => {
                                setItemStatuses({
                                  ...itemStatuses,
                                  [key]: { ...itemStatuses[key], tracking: e.target.value }
                                });
                              }}
                              className="w-full md:w-32 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-[#ff5722]"
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateFulfillment(o.id, item.productVariantId)}
                            disabled={isFulfillmentUpdating}
                            className="mt-4 md:mt-0 flex h-8 items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 text-xs font-bold transition disabled:opacity-50"
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
