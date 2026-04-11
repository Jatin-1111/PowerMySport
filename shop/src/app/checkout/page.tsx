import Link from "next/link";
import CheckoutClient from "@/components/shop/CheckoutClient";

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
      <p className="mt-2 text-slate-600">
        Shipping form and order summary are live. API-backed order placement is
        next.
      </p>

      <CheckoutClient />

      <div className="mt-6 flex gap-3">
        <Link
          href="/cart"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900"
        >
          Back to Cart
        </Link>
      </div>
    </div>
  );
}
