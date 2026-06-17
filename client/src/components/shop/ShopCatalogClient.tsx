"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, Sparkles, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/shop/ecommerce-api";
import { getShopCartTotals, useShopCart } from "@/lib/shop/cart";
import { formatInr } from "@/lib/shop/format";
import { cn } from "@/utils/cn";
import { useRouter, useSearchParams } from "next/navigation";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price low" },
  { value: "price_desc", label: "Price high" },
  { value: "newest", label: "Newest" },
];

export function ShopCatalogClient({ 
  products,
  facets = { brands: [], minPrice: 0, maxPrice: 10000 }
}: { 
  products: Product[];
  facets?: { brands: string[]; minPrice: number; maxPrice: number; };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "ALL");
  const [sort, setSort] = useState(searchParams.get("sortBy") || "featured");
  
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [rating, setRating] = useState(searchParams.get("rating") ? Number(searchParams.get("rating")) : 0);
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : facets.maxPrice);

  const cartItems = useShopCart();
  const totals = useMemo(() => getShopCartTotals(cartItems), [cartItems]);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(products.map((item) => item.category)))],
    [products],
  );

  // Sync state to URL and fetch
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category !== "ALL") params.set("category", category);
    if (sort !== "featured") params.set("sortBy", sort);
    if (brand) params.set("brand", brand);
    if (rating > 0) params.set("rating", rating.toString());
    if (maxPrice < facets.maxPrice) params.set("maxPrice", maxPrice.toString());

    router.push(`/shop?${params.toString()}`);
  };

  const filteredProducts = products;

  const heroProduct = products.find((product) => product.images?.[0]) || products[0];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.5fr_0.7fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 text-white shadow-xl sm:p-12"
        >
          {/* Decorative background blur */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ff5722] opacity-20 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-blue-500 opacity-20 blur-[100px]" />

          <div className="relative z-10 max-w-2xl">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#ffccbc] backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pro-Level Gear
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 max-w-xl text-5xl font-black tracking-tight leading-[1.1] sm:text-6xl"
            >
              Elevate Your <span className="text-[#ff5722]">Performance</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-lg text-lg leading- relaxed text-slate-300"
            >
              Discover premium equipment, exclusive apparel, and advanced
              training essentials curated for dedicated athletes.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <a
                href="#catalog"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ff5722] px-8 text-sm font-bold text-white shadow-lg shadow-[#ff5722]/20 transition-all hover:bg-[#e64a19] hover:shadow-xl hover:shadow-[#ff5722]/30 active:scale-95"
              >
                Explore Marketplace
              </a>
              <Link
                href="/shop/cart"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 active:scale-95"
              >
                <ShoppingCart className="h-4 w-4" />
                {totals.itemCount ? `${totals.itemCount} Items` : "View Cart"}
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col justify-between rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-xl shadow-slate-200/40"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                Cart Summary
              </p>
              {totals.itemCount > 0 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff5722]/10 text-xs font-bold text-[#ff5722]">
                  {totals.itemCount}
                </span>
              )}
            </div>
            <div className="mt-6 grid gap-4">
              <div className="group relative overflow-hidden rounded-2xl bg-slate-50 p-5 transition-colors hover:bg-slate-100">
                <p className="text-sm font-medium text-slate-500">Total Items</p>
                <p className="mt-1 text-4xl font-black text-slate-900">{totals.itemCount}</p>
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-200/50 blur-xl transition-all group-hover:scale-150" />
              </div>
              <div className="group relative overflow-hidden rounded-2xl bg-[#ff5722]/5 p-5 transition-colors hover:bg-[#ff5722]/10">
                <p className="text-sm font-medium text-[#e64a19]">Subtotal</p>
                <p className="mt-1 text-3xl font-black text-[#ff5722]">
                  {formatInr(totals.total)}
                </p>
                <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-[#ff5722]/20 blur-xl transition-all group-hover:scale-150" />
              </div>
            </div>
          </div>
          <Link
            href="/shop/checkout"
            className={cn(
              "mt-8 flex h-14 w-full items-center justify-center rounded-xl text-base font-bold shadow-lg transition-all active:scale-95",
              totals.itemCount
                ? "bg-slate-950 text-white hover:bg-slate-800 shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5"
                : "bg-slate-100 text-slate-400 shadow-none",
            )}
          >
            Proceed to Checkout
          </Link>
        </motion.aside>
      </section>

      <section id="catalog" className="mt-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-[280px_1fr]">
        
        {/* PREMIUM STICKY SIDEBAR */}
        <aside className="sticky top-24 hidden flex-col gap-6 rounded-[2rem] border border-slate-200/60 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl lg:flex">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Search</h3>
            <div className="mt-3 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Search..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722]"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Category</h3>
            <div className="mt-3 flex flex-col gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => { setCategory(item); setTimeout(applyFilters, 0); }}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold transition-all",
                    category === item
                      ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {item === "ALL" ? "All Categories" : item}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Brand</h3>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => { setBrand(""); setTimeout(applyFilters, 0); }}
                className={cn("text-left text-sm font-bold transition-all", brand === "" ? "text-[#ff5722]" : "text-slate-600 hover:text-slate-900")}
              >
                All Brands
              </button>
              {facets.brands.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBrand(b); setTimeout(applyFilters, 0); }}
                  className={cn("text-left text-sm font-bold transition-all", brand === b ? "text-[#ff5722]" : "text-slate-600 hover:text-slate-900")}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Price Range</h3>
            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={facets.maxPrice || 10000}
                step={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                onMouseUp={applyFilters}
                className="w-full accent-[#ff5722]"
              />
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>{formatInr(0)}</span>
                <span>{formatInr(maxPrice)}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Minimum Rating</h3>
            <div className="mt-3 flex flex-col gap-2">
              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => { setRating(r === rating ? 0 : r); setTimeout(applyFilters, 0); }}
                  className={cn("text-left text-sm font-bold transition-all flex items-center gap-2", rating === r ? "text-[#ff5722]" : "text-slate-600 hover:text-slate-900")}
                >
                  {r} Stars & Up
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={applyFilters}
            className="mt-4 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
          >
            Apply Filters
          </button>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm lg:hidden">
             {/* Mobile Filter Toggle / Sort */}
             <div className="flex w-full items-center justify-between">
                <span className="text-sm font-bold text-slate-600">{filteredProducts.length} Results</span>
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 0); }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold outline-none"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
             </div>
          </div>
          
          <div className="mb-6 hidden items-center justify-between lg:flex">
             <span className="text-sm font-bold text-slate-600">Showing {filteredProducts.length} Results</span>
             <div className="flex items-center gap-3">
               <span className="text-sm font-bold text-slate-400">Sort by:</span>
               <select
                 value={sort}
                 onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 0); }}
                 className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold outline-none shadow-sm transition focus:border-[#ff5722]"
               >
                 {sortOptions.map((o) => (
                   <option key={o.value} value={o.value}>{o.label}</option>
                 ))}
               </select>
             </div>
          </div>

          {filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                <Search className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No products found</h3>
              <p className="mt-2 text-slate-500">We couldn't find anything matching your current filters.</p>
              <button
                onClick={() => { router.push("/shop"); }}
                className="mt-6 font-bold text-[#ff5722] hover:underline"
              >
                Clear all filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
}
