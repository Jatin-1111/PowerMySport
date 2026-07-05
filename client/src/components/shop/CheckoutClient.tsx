"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  MapPin,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState, useEffect } from "react";
import { clearShopCart, getShopCartTotals, useShopCart } from "@/lib/shop/cart";
import {
  addUserAddress,
  createOrderFromCart,
  getUserAddresses,
  lookupPincode,
  type ShippingAddress,
  type UserAddress,
} from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { INDIAN_STATES } from "@/lib/shop/indianStates";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/utils/cn";

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
  const { user } = useAuthStore();
  const [form, setForm] = useState(initialForm);

  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addingNew, setAddingNew] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const [status, setStatus] = useState<"idle" | "placing" | "placed" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  // Resolve auth client-side only (avoids SSR/hydration mismatch).
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    setIsAuthed(!!localStorage.getItem("token"));
  }, []);

  // Load the shopper's saved addresses and preselect their default.
  useEffect(() => {
    let cancelled = false;

    async function loadAddresses() {
      if (!isAuthed) {
        setAddingNew(true);
        return;
      }
      try {
        const data = await getUserAddresses();
        if (cancelled) return;
        setSavedAddresses(data);
        if (data.length > 0) {
          const preferred = data.find((a) => a.isDefault) || data[0];
          setSelectedAddressId(preferred?._id || null);
          setAddingNew(false);
        } else {
          setAddingNew(true);
        }
      } catch {
        if (!cancelled) setAddingNew(true);
      }
    }

    loadAddresses();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  // Prefill the new-address form from the user's profile when it is shown.
  useEffect(() => {
    if (!addingNew) return;
    if (user && user.shippingAddress) {
      setForm({
        fullName: user.shippingAddress.fullName || user.name || "",
        email: user.shippingAddress.email || user.email || "",
        phone: user.shippingAddress.phone || user.phone || "",
        addressLine1: user.shippingAddress.addressLine1 || "",
        addressLine2: user.shippingAddress.addressLine2 || "",
        city: user.shippingAddress.city || "",
        state: user.shippingAddress.state || "",
        postalCode: user.shippingAddress.postalCode || "",
      });
    } else if (user) {
      setForm((current) => ({
        ...current,
        fullName: current.fullName || user.name || "",
        email: current.email || user.email || "",
        phone: current.phone || user.phone || "",
      }));
    }
  }, [addingNew, user]);

  const selectedAddress = useMemo(
    () => savedAddresses.find((a) => a._id === selectedAddressId) || null,
    [savedAddresses, selectedAddressId],
  );

  const formComplete =
    !!form.fullName.trim() &&
    !!form.email.trim() &&
    !!form.phone.trim() &&
    !!form.addressLine1.trim() &&
    !!form.city.trim() &&
    !!form.state.trim() &&
    !!form.postalCode.trim();

  const canPlace =
    items.length > 0 && (addingNew ? formComplete : !!selectedAddress);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // Tier 1: auto-fill city + state from the pincode (free India Post lookup).
  async function handlePostalChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setForm((current) => ({ ...current, postalCode: digits }));
    if (digits.length !== 6) return;

    setPincodeLoading(true);
    try {
      const location = await lookupPincode(digits);
      if (location) {
        setForm((current) => ({
          ...current,
          city: location.city || current.city,
          state: location.state || current.state,
        }));
      }
    } finally {
      setPincodeLoading(false);
    }
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

    // Resolve the shipping address from the selected saved address or the form.
    const shippingAddress: ShippingAddress =
      !addingNew && selectedAddress
        ? {
            fullName: selectedAddress.fullName,
            email: selectedAddress.email,
            phone: selectedAddress.phone,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2 || "",
            city: selectedAddress.city,
            state: selectedAddress.state,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country || "IN",
          }
        : { ...form, country: "IN" };

    try {
      // Optionally persist a brand-new address to the shopper's address book.
      if (addingNew && saveNewAddress) {
        await addUserAddress({ ...form, country: "IN" }).catch(() => undefined);
      }

      const result = await createOrderFromCart({
        shippingAddress,
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
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-600">
                <MapPin className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-black text-slate-950">
                Shipping Address
              </h2>
            </div>
            {isAuthed && (
              <Link
                href="/shop/account?tab=address"
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                Manage addresses
              </Link>
            )}
          </div>

          {/* Saved address picker */}
          {savedAddresses.length > 0 && !addingNew && (
            <div className="mt-5 space-y-3">
              {savedAddresses.map((address) => {
                const selected = selectedAddressId === address._id;
                return (
                  <button
                    type="button"
                    key={address._id}
                    onClick={() => setSelectedAddressId(address._id || null)}
                    className={cn(
                      "w-full rounded-xl border-2 p-4 text-left transition-all",
                      selected
                        ? "border-power-orange bg-orange-50/40"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {address.fullName}
                        </span>
                        {address.isDefault && (
                          <span className="rounded-full bg-power-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Default
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full border-2",
                          selected
                            ? "border-power-orange bg-power-orange"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p className="text-sm text-slate-500">
                      {address.phone} • {address.email}
                    </p>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setAddingNew(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Use a new address
              </button>
            </div>
          )}

          {/* New address form */}
          {addingNew && (
            <div className="mt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    updateField("fullName", event.target.value)
                  }
                  placeholder="Full name"
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="Email"
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="Phone"
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <div>
                  <input
                    value={form.postalCode}
                    onChange={(event) => handlePostalChange(event.target.value)}
                    placeholder="Postal code"
                    inputMode="numeric"
                    maxLength={6}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                  {pincodeLoading && (
                    <p className="mt-1 text-xs text-slate-400">
                      Looking up city & state…
                    </p>
                  )}
                </div>
                <input
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="City"
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <select
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">Select state</option>
                  {form.state && !INDIAN_STATES.includes(form.state) && (
                    <option value={form.state}>{form.state}</option>
                  )}
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  placeholder="Address line 2 (optional)"
                  className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white sm:col-span-2"
                />
              </div>

              {isAuthed && (
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={saveNewAddress}
                    onChange={(event) => setSaveNewAddress(event.target.checked)}
                    className="h-4 w-4 accent-orange-500"
                  />
                  Save this address to my address book
                </label>
              )}

              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddingNew(false)}
                  className="mt-4 text-sm font-bold text-slate-600 hover:underline"
                >
                  ← Use a saved address
                </button>
              )}
            </div>
          )}
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
        <h2 className="mt-4 text-xl font-black text-slate-950">Order Summary</h2>
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
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-power-orange text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
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
