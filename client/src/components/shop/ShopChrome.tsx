"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ReceiptText, ShoppingBag, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { getShopCartTotals, useShopCart } from "@/lib/shop/cart";
import { cn } from "@/utils/cn";

const links = [
  { href: "/shop", label: "Store", icon: ShoppingBag },
  { href: "/shop/cart", label: "Cart", icon: ShoppingCart },
  { href: "/shop/orders", label: "Orders", icon: ReceiptText },
];

export function ShopChrome() {
  const pathname = usePathname();
  const items = useShopCart();
  const totals = useMemo(() => getShopCartTotals(items), [items]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            title="Back to Home"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <Link href="/shop" className="flex items-center gap-2">
            <span className="font-title text-2xl font-extrabold tracking-tight leading-none flex items-baseline">
              <span className="text-power-orange">Power</span>
              <span className="text-slate-900">MySport</span>
              <span className="ml-1.5 text-sm font-normal text-slate-500">Shop</span>
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/shop"
                ? pathname === "/shop"
                : pathname?.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-slate-950 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
                {link.href === "/shop/cart" && totals.itemCount > 0 ? (
                  <motion.span
                    key={totals.itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff5722] px-1.5 text-[11px] font-bold text-white shadow-sm"
                  >
                    {totals.itemCount}
                  </motion.span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
