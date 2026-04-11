import Link from "next/link";
import type { Product } from "@/lib/ecommerce-api";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function ProductCard({ product }: { product: Product }) {
  const price = product.salePrice ?? product.basePrice;

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-4/3 bg-[radial-gradient(circle_at_30%_20%,#d5e8ff_0%,#f2f7ff_40%,#f7f3ea_100%)]" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-slate-900">
            {product.name}
          </h3>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
            {product.category}
          </span>
        </div>

        <p className="line-clamp-2 text-sm text-slate-600">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">
              {formatInr(price)}
            </span>
            {product.salePrice ? (
              <span className="text-sm text-slate-500 line-through">
                {formatInr(product.basePrice)}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-slate-500">
            {product.totalStock} left
          </span>
        </div>

        <Link
          href={`/products/${product.id}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
