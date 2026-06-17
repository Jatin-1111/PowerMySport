import { ArrowLeft, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { WishlistButton } from "@/components/shop/WishlistButton";
import { ProductReviews } from "@/components/shop/ProductReviews";
import { RelatedProducts } from "@/components/shop/RelatedProducts";
import { getProductById } from "@/lib/shop/ecommerce-api";
import { formatInr, getProductPrice } from "@/lib/shop/format";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">
            Product not found
          </h1>
          <p className="mt-3 text-slate-600">
            This product is unavailable or the shop backend is not reachable.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white"
          >
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  const price = getProductPrice(product);
  const variant =
    product.variants.find((item) => item.stock > 0) ||
    product.variants[0] || {
      id: product.id,
      sku: product.sku,
      variantLabel: "Standard",
      stock: product.totalStock,
      price,
    };
  const image = product.images?.[0];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/shop"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute right-4 top-4 z-20">
            <WishlistButton productId={product.id} className="h-12 w-12 border border-slate-200" />
          </div>
          <div className="aspect-square bg-linear-to-br from-blue-50 via-white to-orange-50">
            {image ? (
              <img
                src={image}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-lg font-bold text-slate-400">
                {product.category}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">
              {product.category}
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              {product.name}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {product.description}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Price</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-4xl font-black text-slate-950">
                    {formatInr(variant.price || price)}
                  </span>
                  {product.salePrice ? (
                    <span className="text-lg font-semibold text-slate-400 line-through">
                      {formatInr(product.basePrice)}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                {variant.stock > 0 ? `${variant.stock} available` : "Sold out"}
              </span>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">
                {variant.variantLabel}
              </p>
              <p className="mt-1 text-sm text-slate-500">{variant.sku}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <AddToCartButton
                className="min-w-40"
                item={{
                  productId: product.id,
                  variantId: variant.id,
                  sku: variant.sku,
                  name: product.name,
                  category: product.category,
                  image,
                  variantLabel: variant.variantLabel,
                  unitPrice: variant.price || price,
                  quantity: 1,
                  stock: variant.stock,
                }}
              />
              <Link
                href="/shop/checkout"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Checkout
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <Truck className="h-5 w-5 text-orange-600" />
              <h2 className="mt-3 font-black text-slate-950">Fast dispatch</h2>
              <p className="mt-1 text-sm text-slate-600">
                Estimated shipping is calculated at checkout.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="mt-3 font-black text-slate-950">Secure payment</h2>
              <p className="mt-1 text-sm text-slate-600">
                Signed-in checkout creates a protected backend order.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <ProductReviews productId={product.id} />
        <RelatedProducts productId={product.id} />
      </section>
    </main>
  );
}
