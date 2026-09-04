"use client";

import { ProductCard } from "@/modules/shop/components/ProductCard";
import { useWishlistStore } from "@/lib/shop/wishlistStore";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Heart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function SavedItemsView() {
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
