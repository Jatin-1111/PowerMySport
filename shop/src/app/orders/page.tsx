export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Your Orders</h1>
      <p className="mt-2 text-slate-600">
        Order history route is ready. Next step is connecting authenticated
        order list API.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-600">
        No orders yet.
      </div>
    </div>
  );
}
