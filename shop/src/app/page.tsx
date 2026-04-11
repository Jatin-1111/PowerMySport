import Link from "next/link";
import ProductCard from "@/components/shop/ProductCard";
import { listProducts } from "@/lib/ecommerce-api";

export default async function Home() {
  const featured = await listProducts({
    page: 1,
    limit: 4,
    sortBy: "newest",
  }).catch(() => ({ products: [], total: 0, page: 1, pages: 1 }));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f8fbff_0%,#e5f1ff_38%,#fff4e2_100%)] px-6 py-14 shadow-sm sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
            New Season Drop
          </p>
          <h1 className="mt-4 font-title text-4xl leading-[1.05] text-slate-900 sm:text-6xl">
            Performance Gear For Every Sport Routine
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
            Apparel, accessories, and on-court essentials curated for players,
            coaches, and venue teams.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Shop Collection
            </Link>
            <Link
              href="/orders"
              className="rounded-xl border border-slate-300 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Track Orders
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-title text-3xl text-slate-900">
            Featured Products
          </h2>
          <Link
            href="/products"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            View all
          </Link>
        </div>

        {featured.products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-600">
            No products available yet. Add products from admin to populate this
            section.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
