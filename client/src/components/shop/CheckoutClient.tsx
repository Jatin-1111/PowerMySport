"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, LockKeyhole, MapPin } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { clearShopCart, getShopCartTotals, useShopCart } from "@/lib/shop/cart";
import { createOrderFromCart } from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export function CheckoutClient() {
  const items = useShopCart();
  const totals = useMemo(() => getShopCartTotals(items), [items]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<"idle" | "placing" | "placed" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const canPlace =
    items.length > 0 &&
    form.fullName.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.addressLine1.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.postalCode.trim();

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPlace || status === "placing") return;

    setStatus("placing");
    setMessage("");

    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!token) {
      window.setTimeout(() => {
        clearShopCart();
        setStatus("placed");
        setMessage(
          "Demo order placed locally. Sign in before checkout to create a backend order and payment.",
        );
      }, 650);
      return;
    }

    try {
      const result = await createOrderFromCart({
        shippingAddress: {
          ...form,
          country: "IN",
        },
        paymentMethod: "PHONEPE",
      });
      clearShopCart();

      const paymentConfig = result.paymentConfig as any;
      const paymentUrl =
        paymentConfig?.instrumentResponse?.redirectInfo?.url ||
        paymentConfig?.url ||
        paymentConfig?.data?.instrumentResponse?.redirectInfo?.url;

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        setStatus("placed");
        setMessage(
          `Order ${result.order.orderNumber} created. Please check your orders page.`,
        );
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to place order right now.",
      );
    }
  }

  if (items.length === 0 && status !== "placed") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">
            Checkout needs a cart
          </h1>
          <p className="mt-3 text-slate-600">
            Add a product first, then return here to complete the order.
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

  if (status === "placed") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-200 bg-white p-10 shadow-sm"
        >
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-3xl font-black text-slate-950">
            Order started
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">{message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white"
            >
              Continue Shopping
            </Link>
            <Link
              href="/shop/orders"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-bold text-slate-700"
            >
              View Orders
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_390px] lg:px-8">
      <form id="shop-checkout-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
            Secure Checkout
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Delivery details
          </h1>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-600">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-black text-slate-950">
              Shipping Address
            </h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["fullName", "Full name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["postalCode", "Postal code"],
              ["city", "City"],
              ["state", "State"],
            ].map(([field, label]) => (
              <input
                key={field}
                value={form[field as keyof typeof form]}
                onChange={(event) =>
                  updateField(field as keyof typeof form, event.target.value)
                }
                placeholder={label}
                className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            ))}
            <input
              value={form.addressLine1}
              onChange={(event) =>
                updateField("addressLine1", event.target.value)
              }
              placeholder="Address line 1"
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white sm:col-span-2"
            />
            <input
              value={form.addressLine2}
              onChange={(event) =>
                updateField("addressLine2", event.target.value)
              }
              placeholder="Address line 2"
              className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white sm:col-span-2"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">Payment</h2>
              <p className="text-sm text-slate-500">
                PhonePe handoff is used for signed-in backend orders.
              </p>
            </div>
          </div>
        </section>

        {message && status === "error" ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {message}
          </p>
        ) : null}
      </form>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
          <LockKeyhole className="h-4 w-4" />
          Encrypted checkout
        </div>
        <h2 className="mt-4 text-xl font-black text-slate-950">
          Order Summary
        </h2>
        <div className="mt-5 space-y-3 text-sm text-slate-600">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex items-start justify-between gap-4"
            >
              <span>
                {item.name} x {item.quantity}
              </span>
              <span className="font-semibold text-slate-950">
                {formatInr(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-3" />
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatInr(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>GST estimate</span>
            <span>{formatInr(totals.taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span>
              {totals.shippingAmount ? formatInr(totals.shippingAmount) : "Free"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-black text-slate-950">
            <span>Total</span>
            <span>{formatInr(totals.total)}</span>
          </div>
        </div>
        <button
          type="submit"
          form="shop-checkout-form"
          disabled={!canPlace || status === "placing"}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {status === "placing" ? "Placing Order..." : "Place Order"}
        </button>
        <Link
          href="/shop/cart"
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Cart
        </Link>
      </aside>
    </main>
  );
}
