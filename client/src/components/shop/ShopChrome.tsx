"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Search, User, ShoppingCart, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { getShopCartTotals, useShopCart } from "@/lib/shop/cart";
import { cn } from "@/utils/cn";

const collections = ["Running", "Training", "Basketball", "Football", "Yoga", "Accessories"];

export function ShopChrome() {
  const pathname = usePathname();
  const items = useShopCart();
  const totals = useMemo(() => getShopCartTotals(items), [items]);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-7xl rounded-full border border-slate-200/70 bg-white/90 backdrop-blur-xl transition-all duration-300 shadow-md">
      <div className="flex flex-col gap-3 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Left Section */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            title="Back to Home"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <Link href="/shop" className="flex items-center gap-2">
            <span className="font-title text-2xl font-extrabold tracking-tight leading-none flex items-baseline">
              <span className="text-power-orange">Power</span>
              <span className="text-slate-900">MySport</span>
            </span>
          </Link>
          
          <div className="relative ml-4 hidden lg:block group">
            {/* Added a taller trigger area (py-4) to create an invisible bridge to the dropdown menu */}
            <button className="flex items-center gap-2 text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors py-4">
              Collections
              <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
            </button>
            <div className="absolute top-full left-0 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl opacity-0 invisible translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
              {collections.map(c => (
                <Link
                  key={c}
                  href={`/shop?category=${c}`}
                  className="block rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block mr-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="What are you looking for?"
              className="h-10 w-64 rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722]"
            />
          </div>
          
          <Link
            href="/shop/account"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <User className="h-5 w-5" />
          </Link>
          
          <Link
            href="/shop/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ShoppingCart className="h-5 w-5" />
            {totals.itemCount > 0 && (
              <motion.span
                key={totals.itemCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff5722] px-1.5 text-[11px] font-bold text-white shadow-sm"
              >
                {totals.itemCount}
              </motion.span>
            )}
          </Link>
        </div>

      </div>
    </header>
  );
}
