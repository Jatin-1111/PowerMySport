import CartClient from "@/components/shop/CartClient";

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Your Cart</h1>
      <p className="mt-2 text-slate-600">
        Local cart interactions are live. Backend cart sync comes next.
      </p>

      <CartClient />
    </div>
  );
}
