import { JsonLd } from "@/components/seo/JsonLd";
import { AddToCartButton } from "@/modules/shop/components/AddToCartButton";
import { ProductReviews } from "@/modules/shop/components/ProductReviews";
import { RelatedProducts } from "@/modules/shop/components/RelatedProducts";
import { WishlistButton } from "@/modules/shop/components/WishlistButton";
import { getProductById } from "@/lib/shop/ecommerce-api";
import { formatInr, getProductPrice } from "@/lib/shop/format";
import { breadcrumbJsonLd, clampText, NOINDEX_METADATA, productJsonLd } from "@/lib/seo";
import { ArrowLeft, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * This route previously exported no metadata at all, so every product inherited
 * the shop layout's generic title and — because the root layout set one — a
 * canonical pointing at the homepage. Every product in the catalogue was
 * declaring itself a duplicate of `/`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);

  // Missing product, or the shop backend is down. The page renders a friendly
  // body rather than a hard 404 (an outage is not a permanent absence), so keep
  // it out of the index instead of letting Google cache an empty shell.
  if (!product) {
    return { title: "Product not found", ...NOINDEX_METADATA };
  }

  const description = clampText(
    product.description ||
      `Buy ${product.name} on the PowerMySport shop. ${product.category} gear with secure checkout and dispatch across India.`
  );

  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/products/${product.id}` },
    openGraph: {
      type: "website",
      siteName: "PowerMySport",
      url: `/shop/products/${product.id}`,
      title: product.name,
      description,
      ...(product.images?.[0] ? { images: [{ url: product.images[0] }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(product.images?.[0] ? { images: [product.images[0]] } : {}),
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">Product not found</h1>
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
  const variant = product.variants.find((item) => item.stock > 0) ||
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
      <JsonLd
        data={[
          productJsonLd({
            name: product.name,
            path: `/shop/products/${product.id}`,
            description: product.description,
            images: product.images,
            sku: product.sku,
            ...(product.brand ? { brand: product.brand } : {}),
            category: product.category,
            // The API speaks paise; schema.org wants a decimal amount in the
            // stated currency. Skipping this division advertises every item at
            // 100x its real price.
            priceInr: (variant.price || price) / 100,
            inStock: variant.stock > 0,
            ...(product.condition ? { condition: product.condition } : {}),
          }),
          breadcrumbJsonLd([
            { name: "Shop", path: "/shop" },
            { name: product.category, path: "/shop" },
            { name: product.name, path: `/shop/products/${product.id}` },
          ]),
        ]}
      />
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
          <div className="bg-linear-to-br aspect-square from-blue-50 via-white to-orange-50">
            {image ? (
              <img src={image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-lg font-bold text-slate-400">
                {product.category}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">
                {product.category}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${product.condition === "USED" ? "bg-slate-900 text-white" : "bg-emerald-50 text-emerald-700"}`}
              >
                {product.condition === "USED" ? "Pre-owned / Used" : "New Gear"}
              </span>
              {product.sellerName && (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                  Seller: {product.sellerName} ({product.sellerType || "P2P"})
                </span>
              )}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              {product.name}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">{product.description}</p>
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
              <p className="text-sm font-bold text-slate-950">{variant.variantLabel}</p>
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
