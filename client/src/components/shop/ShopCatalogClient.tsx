"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, Sparkles, ShoppingCart, ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
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
  facets = { categories: [], brands: [], minPrice: 0, maxPrice: 10000 }
}: {
  products: Product[];
  facets?: { categories?: string[]; brands: string[]; minPrice: number; maxPrice: number; };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "ALL");
  const [sort, setSort] = useState(searchParams.get("sortBy") || "featured");
  
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [rating, setRating] = useState(searchParams.get("rating") ? Number(searchParams.get("rating")) : 0);
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : facets.maxPrice);
  const [condition, setCondition] = useState(searchParams.get("condition") || "");
  const [sellerType, setSellerType] = useState(searchParams.get("sellerType") || "");

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setCategory(searchParams.get("category") || "ALL");
    setSort(searchParams.get("sortBy") || "featured");
    setBrand(searchParams.get("brand") || "");
    setRating(searchParams.get("rating") ? Number(searchParams.get("rating")) : 0);
    setMaxPrice(searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : facets.maxPrice);
    setCondition(searchParams.get("condition") || "");
    setSellerType(searchParams.get("sellerType") || "");
  }, [searchParams, facets.maxPrice]);

  const cartItems = useShopCart();
  const totals = useMemo(() => getShopCartTotals(cartItems), [cartItems]);

  // Category list comes from the catalog-wide facet (not the filtered result
  // set) so the shopper can always switch categories. Fall back to whatever is
  // present in the current products if the facet is unavailable.
  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(
        new Set([
          ...(facets.categories || []),
          ...products.map((item) => item.category),
        ]),
      ).filter(Boolean),
    ],
    [facets.categories, products],
  );

  // Sync state to URL and refetch. Accepts overrides so a single filter click
  // applies immediately without waiting for async state updates.
  const applyFilters = (
    overrides: Partial<{
      search: string;
      category: string;
      sort: string;
      brand: string;
      rating: number;
      maxPrice: number;
      condition: string;
      sellerType: string;
    }> = {},
  ) => {
    const next = {
      search,
      category,
      sort,
      brand,
      rating,
      maxPrice,
      condition,
      sellerType,
      ...overrides,
    };

    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.category !== "ALL") params.set("category", next.category);
    if (next.sort !== "featured") params.set("sortBy", next.sort);
    if (next.brand) params.set("brand", next.brand);
    if (next.rating > 0) params.set("rating", String(next.rating));
    if (next.maxPrice < (facets.maxPrice || 10000))
      params.set("maxPrice", String(next.maxPrice));
    if (next.condition) params.set("condition", next.condition);
    if (next.sellerType) params.set("sellerType", next.sellerType);

    router.push(`/shop?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("ALL");
    setSort("featured");
    setBrand("");
    setRating(0);
    setMaxPrice(facets.maxPrice || 10000);
    setCondition("");
    setSellerType("");
    router.push("/shop");
  };

  const filteredProducts = products;
  const [activeTab, setActiveTab] = useState("All Products");
  
  const displayProducts = useMemo(() => {
    if (activeTab === "Best Sellers") return [...filteredProducts].sort(() => 0.5 - Math.random());
    if (activeTab === "New Arrivals") return [...filteredProducts].reverse();
    return filteredProducts;
  }, [filteredProducts, activeTab]);

  const heroProduct = products.find((product) => product.images?.[0]) || products[0];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative flex flex-col lg:flex-row items-center justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 to-white p-8 border border-slate-200/50 shadow-sm sm:p-10"
        >
          {/* Decorative background blur */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ff5722] opacity-10 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-blue-500 opacity-10 blur-[100px]" />

          <div className="relative z-10 w-full lg:w-1/2">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#ff5722]/20 bg-[#ff5722]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#ff5722]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pro-Level Gear
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 max-w-xl text-5xl font-black tracking-tight leading-[1.1] sm:text-6xl text-slate-900"
            >
              Elevate Your <span className="text-[#ff5722]">Performance</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600"
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
                Shop Now <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
              <a
                href="#catalog"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              >
                Explore Marketplace
              </a>
            </motion.div>
          </div>

          {/* Hero Image Section */}
          <div className="relative z-10 w-full lg:w-1/2 mt-10 lg:mt-0 flex justify-end">
            <div className="relative w-full max-w-md aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80" 
                alt="Pro Gear" 
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* TABS & TOGGLES */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-2 relative">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "group flex items-center gap-3 rounded-full bg-slate-50 border px-4 py-2 text-sm font-bold transition-all shadow-sm cursor-pointer hover:border-slate-300",
              showFilters ? "border-[#ff5722]/40 bg-[#ff5722]/5 text-[#ff5722]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span>Filters</span>
            </div>
            
            <div className="h-4 w-px bg-slate-300/80" />
            
            <div
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out p-[2px] items-center",
                showFilters ? "bg-[#ff5722]" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                  showFilters ? "translate-x-4" : "translate-x-0"
                )}
              />
            </div>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {["All Products", "Best Sellers", "New Arrivals"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "whitespace-nowrap px-2 py-3 text-sm font-bold transition-all relative",
                  activeTab === tab ? "text-[#ff5722]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="activeTabIndicator" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#ff5722]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <span className="text-sm font-bold text-slate-400">Sort:</span>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); applyFilters({ sort: e.target.value }); }}
              className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-sm font-bold outline-none shadow-sm transition focus:border-[#ff5722]"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      <section id="catalog" className={cn("mt-12 grid grid-cols-1 items-start gap-8", showFilters && "lg:grid-cols-[280px_1fr]")}>
        
        {/* VERTICAL LEFT SIDEBAR */}
        {showFilters && (
          <aside className="sticky top-28 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-slate-900" />
                <h2 className="text-lg font-black text-slate-900">Filters</h2>
              </div>
            {(search || category !== "ALL" || brand || rating > 0 || maxPrice < (facets.maxPrice || 10000) || condition || sellerType) && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-[#ff5722] hover:underline transition-all"
              >
                Clear all
              </button>
            )}
          </div>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Search
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4">
              <div className="relative">
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
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Category
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => { setCategory(item); applyFilters({ category: item }); }}
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
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Brands
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => { setBrand(""); applyFilters({ brand: "" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", brand === "" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                All Brands
              </button>
              {facets.brands.map((b) => (
                <button
                  key={b}
                  onClick={() => { setBrand(b); applyFilters({ brand: b }); }}
                  className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", brand === b ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
                >
                  {b}
                </button>
              ))}
            </div>
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Price Range
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={facets.maxPrice || 10000}
                step={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#ff5722]"
              />
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>{formatInr(0)}</span>
                <span>{formatInr(maxPrice)}</span>
              </div>
            </div>
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Rating
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => { const nextRating = r === rating ? 0 : r; setRating(nextRating); applyFilters({ rating: nextRating }); }}
                  className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", rating === r ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
                >
                  {r} Stars & Up
                </button>
              ))}
            </div>
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Gear Condition
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => { setCondition(""); applyFilters({ condition: "" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", condition === "" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                All Gear
              </button>
              <button
                onClick={() => { setCondition("NEW"); applyFilters({ condition: "NEW" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", condition === "NEW" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                New Gear
              </button>
              <button
                onClick={() => { setCondition("USED"); applyFilters({ condition: "USED" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", condition === "USED" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                Used / Pre-owned
              </button>
            </div>
          </details>

          <details className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-sm text-slate-900 outline-none transition-colors group-hover:text-[#ff5722] [&::-webkit-details-marker]:hidden">
              Seller Type
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => { setSellerType(""); applyFilters({ sellerType: "" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", sellerType === "" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                All Sellers
              </button>
              <button
                onClick={() => { setSellerType("SYSTEM"); applyFilters({ sellerType: "SYSTEM" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", sellerType === "SYSTEM" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                PowerMySport Store
              </button>
              <button
                onClick={() => { setSellerType("PARENT"); applyFilters({ sellerType: "PARENT" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", sellerType === "PARENT" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                Parents
              </button>
              <button
                onClick={() => { setSellerType("PLAYER"); applyFilters({ sellerType: "PLAYER" }); }}
                className={cn("text-left px-3 py-2 rounded-lg text-sm font-bold transition-all", sellerType === "PLAYER" ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20" : "text-slate-600 hover:bg-slate-100")}
              >
                Players (P2P)
              </button>
            </div>
          </details>

          <button
            onClick={() => applyFilters()}
            className="w-full rounded-xl bg-[#ff5722] py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#e64a19] active:scale-95"
          >
            Apply Filters
          </button>
        </aside>
        )}

        <div className="w-full overflow-hidden">

          {displayProducts.length === 0 ? (
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
                onClick={clearFilters}
                className="mt-6 font-bold text-[#ff5722] hover:underline"
              >
                Clear all filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 w-full"
            >
              <AnimatePresence mode="popLayout">
                {displayProducts.map((product) => (
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
