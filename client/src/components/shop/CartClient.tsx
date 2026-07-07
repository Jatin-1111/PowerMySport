"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  clearShopCart,
  getShopCartTotals,
  updateShopCartQuantity,
  useShopCart,
} from "@/lib/shop/cart";
import { formatInr } from "@/lib/shop/format";

export function CartClient() {
  const items = useShopCart();
  const totals = getShopCartTotals(items);

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">
            Your cart is empty
          </h1>
          <p className="mt-3 text-slate-600">
            Add training gear to see live totals and checkout details here.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
              Shopping Cart
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Review your kit
            </h1>
          </div>
          <button
            type="button"
            onClick={clearShopCart}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.article
                key={item.variantId}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[96px_1fr_auto]"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-linear-to-br from-blue-50 to-orange-50">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {item.category || "Gear"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    {item.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.variantLabel || "Standard"} ·{" "}
                    {formatInr(item.unitPrice)} each
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() =>
                        updateShopCartQuantity(
                          item.variantId,
                          item.quantity - 1,
                        )
                      }
                      className="grid h-10 w-10 place-items-center text-slate-600 hover:text-slate-950"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-9 text-center text-sm font-black">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateShopCartQuantity(
                          item.variantId,
                          item.quantity + 1,
                        )
                      }
                      className="grid h-10 w-10 place-items-center text-slate-600 hover:text-slate-950"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-lg font-black text-slate-950">
                    {formatInr(item.unitPrice * item.quantity)}
                  </p>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Order Summary</h2>
        <div className="mt-5 space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatInr(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Estimated GST</span>
            <span>{formatInr(totals.taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span>
              {totals.shippingAmount
                ? formatInr(totals.shippingAmount)
                : "Free"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-black text-slate-950">
            <span>Total</span>
            <span>{formatInr(totals.total)}</span>
          </div>
        </div>
        <Link
          href="/shop/checkout"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-power-orange text-sm font-bold text-white transition hover:bg-orange-600"
        >
          Continue to Checkout
        </Link>
        <Link
          href="/shop"
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Keep Shopping
        </Link>
      </aside>
    </main>
  );
}
