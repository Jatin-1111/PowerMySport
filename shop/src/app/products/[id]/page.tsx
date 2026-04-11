import Link from "next/link";
import AddToCartButton from "@/components/shop/AddToCartButton";
import { getProductById } from "@/lib/ecommerce-api";

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProductById(id).catch(() => null);

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Product Not Found</h1>
        <p className="mt-3 text-slate-600">
          This product does not exist yet or backend is not reachable.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
        >
          Back to Products
        </Link>
      </div>
    );
  }

  const livePrice = product.salePrice ?? product.basePrice;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/50 bg-[radial-gradient(circle_at_20%_15%,#d5e8ff_0%,#f2f7ff_40%,#f7f3ea_100%)] p-8 shadow-sm">
          <div className="aspect-square rounded-2xl border border-white/70 bg-white/30" />
        </section>

        <section className="space-y-6">
          <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium tracking-wide text-white">
            {product.category}
          </p>

          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            {product.name}
          </h1>

          <p className="text-base leading-7 text-slate-600">
            {product.description}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">
              {formatInr(livePrice)}
            </span>
            {product.salePrice ? (
              <span className="text-lg text-slate-500 line-through">
                {formatInr(product.basePrice)}
              </span>
            ) : null}
          </div>

          <p className="text-sm text-slate-600">
            {product.totalStock} units in stock
          </p>

          <div className="flex flex-wrap gap-3">
            <AddToCartButton
              productId={product.id}
              name={product.name}
              unitPrice={livePrice}
            />
            <Link
              href="/checkout"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Buy Now
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
            Variants: {product.variants.length}. Live cart integration is next
            in Phase 3.
          </div>
        </section>
      </div>
    </div>
  );
}
