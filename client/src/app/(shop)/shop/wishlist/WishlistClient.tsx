"use client";

import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/shop/ecommerce-api";
import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";

export function WishlistClient({
  initialProducts,
  isAuthenticated,
}: {
  initialProducts: Product[];
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-xl">
          <Heart className="h-16 w-16 text-slate-300" />
          <h1 className="mt-6 text-3xl font-black text-slate-900">
            Sign in to view your Wishlist
          </h1>
          <p className="mt-4 max-w-md text-slate-500">
            Save your favorite gear and track price drops by creating an
            account.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 rounded-xl bg-[#ff5722] px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-[#e64a19] hover:shadow-xl active:scale-95"
          >
            Sign In / Register
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500">
          <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Your Wishlist
          </h1>
          <p className="text-sm font-medium text-slate-500">
            {initialProducts.length} saved items
          </p>
        </div>
      </div>

      {initialProducts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            <Heart className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="mt-6 text-xl font-black text-slate-900">
            Your wishlist is empty
          </h3>
          <p className="mt-2 text-slate-500">
            Browse our catalog and tap the heart icon to save gear for later.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl active:scale-95"
          >
            <ShoppingBag className="h-5 w-5" />
            Explore Gear
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {initialProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
