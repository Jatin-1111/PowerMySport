import { JsonLd } from "@/components/seo/JsonLd";
import { ShopCatalogClient } from "@/modules/shop/components/ShopCatalogClient";
import { listProducts, type Product } from "@/lib/shop/ecommerce-api";
import { itemListJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import ShopWaitlist from "@/modules/shop/components/ShopWaitlist";

export const metadata: Metadata = {
  title: "Shop — Sports Gear & Equipment",
  description:
    "Shop premium sports gear, customized equipment, and exclusive PowerMySport bundles.",
  alternates: {
    canonical: "/shop",
  },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const isShopLive = process.env.NEXT_PUBLIC_SHOP_IS_LIVE !== "false";

  if (!isShopLive) {
    return <ShopWaitlist />;
  }

  const params = await searchParams;

  const page = typeof params.page === "string" ? parseInt(params.page) : 1;
  const category = typeof params.category === "string" ? params.category : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "newest";
  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const rating = typeof params.rating === "string" ? parseInt(params.rating) : undefined;
  const minPrice = typeof params.minPrice === "string" ? parseInt(params.minPrice) : undefined;
  const maxPrice = typeof params.maxPrice === "string" ? parseInt(params.maxPrice) : undefined;
  const condition = typeof params.condition === "string" ? params.condition : undefined;
  const sellerType = typeof params.sellerType === "string" ? params.sellerType : undefined;

  const data = await listProducts({
    page,
    limit: 48,
    category: category !== "ALL" ? category : undefined,
    search,
    sortBy,
    brand,
    rating,
    minPrice,
    maxPrice,
    condition,
    sellerType,
  }).catch(() => ({
    products: [] as Product[],
    total: 0,
    page: 1,
    pages: 1,
    facets: { brands: [], minPrice: 0, maxPrice: 10000 },
  }));

  // Every filtered/paginated view canonicalises back to bare `/shop`, so the
  // ItemList is only emitted on that view — describing page 3 of a brand filter
  // as the contents of `/shop` would be a lie in schema.
  const isCanonicalView = Object.keys(params).length === 0 && data.products.length > 0;

  return (
    <Suspense fallback={<div className="h-screen w-full animate-pulse bg-slate-50" />}>
      {isCanonicalView && (
        <JsonLd
          data={itemListJsonLd({
            name: "PowerMySport Shop",
            path: "/shop",
            description:
              "Sports gear and equipment for young athletes in India, new and pre-owned.",
            items: data.products.map((product) => ({
              name: product.name,
              path: `/shop/products/${product.id}`,
            })),
          })}
        />
      )}
      <ShopCatalogClient products={data.products} facets={data.facets} />
    </Suspense>
  );
}
