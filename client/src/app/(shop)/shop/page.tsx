import { ShopCatalogClient } from "@/components/shop/ShopCatalogClient";
import { listProducts, type Product } from "@/lib/shop/ecommerce-api";
import type { Metadata } from "next";
import { Suspense } from "react";
import ShopWaitlist from "../../../components/shop/ShopWaitlist";

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
  const category =
    typeof params.category === "string" ? params.category : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const sortBy = typeof params.sortBy === "string" ? params.sortBy : "newest";
  const brand = typeof params.brand === "string" ? params.brand : undefined;
  const rating =
    typeof params.rating === "string" ? parseInt(params.rating) : undefined;
  const minPrice =
    typeof params.minPrice === "string" ? parseInt(params.minPrice) : undefined;
  const maxPrice =
    typeof params.maxPrice === "string" ? parseInt(params.maxPrice) : undefined;
  const condition =
    typeof params.condition === "string" ? params.condition : undefined;
  const sellerType =
    typeof params.sellerType === "string" ? params.sellerType : undefined;

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

  return (
    <Suspense
      fallback={<div className="h-screen w-full animate-pulse bg-slate-50" />}
    >
      <ShopCatalogClient products={data.products} facets={data.facets} />
    </Suspense>
  );
}
