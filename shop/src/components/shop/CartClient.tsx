"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clearLocalCart,
  readLocalCart,
  updateLocalCartQuantity,
  type LocalCartItem,
} from "@/lib/cart";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function CartClient() {
  const [items, setItems] = useState<LocalCartItem[]>(() => readLocalCart());

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );

  const taxAmount = Math.round(subtotal * 0.18);
  const total = subtotal + taxAmount;

  const refresh = () => setItems(readLocalCart());

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
        <p className="text-slate-600">No items in cart yet.</p>
        <Link
          href="/products"
          className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-6">
        {items.map((item) => (
          <div
            key={item.productId}
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {item.name}
              </h3>
              <p className="text-sm text-slate-500">
                {formatInr(item.unitPrice)} each
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  updateLocalCartQuantity(item.productId, item.quantity - 1);
                  refresh();
                }}
                className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-semibold">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => {
                  updateLocalCartQuantity(item.productId, item.quantity + 1);
                  refresh();
                }}
                className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white/90 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatInr(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax (18%)</span>
            <span>{formatInr(taxAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>
        </div>

        <Link
          href="/checkout"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
        >
          Continue to Checkout
        </Link>
        <button
          type="button"
          onClick={() => {
            clearLocalCart();
            refresh();
          }}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800"
        >
          Clear Cart
        </button>
      </aside>
    </div>
  );
}
