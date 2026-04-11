"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clearLocalCart, readLocalCart } from "@/lib/cart";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function CheckoutClient() {
  const [items, setItems] = useState(() => readLocalCart());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );
  const taxAmount = Math.round(subtotal * 0.18);
  const total = subtotal + taxAmount;

  const canPlace =
    items.length > 0 &&
    name.trim() &&
    email.trim() &&
    phone.trim() &&
    address.trim() &&
    city.trim() &&
    state.trim() &&
    postalCode.trim();

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/75 p-10 text-center">
        <p className="text-slate-600">
          Your cart is empty. Add products to continue checkout.
        </p>
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
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Shipping Details
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="Postal Code"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address Line 1"
            className="sm:col-span-2 min-h-24 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white/95 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-start justify-between gap-3"
            >
              <span>
                {item.name} x {item.quantity}
              </span>
              <span>{formatInr(item.unitPrice * item.quantity)}</span>
            </div>
          ))}

          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span>Subtotal</span>
            <span>{formatInr(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax (18%)</span>
            <span>{formatInr(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!canPlace}
          onClick={() => {
            clearLocalCart();
            setItems([]);
          }}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {canPlace ? "Place Order (Demo)" : "Fill Details to Continue"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Demo checkout UX is live. Next step is wiring create-from-cart and
          gateway verification.
        </p>
      </aside>
    </div>
  );
}
