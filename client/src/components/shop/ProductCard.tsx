"use client";

import { motion } from "framer-motion";
import { ArrowRight, BadgePercent, Star } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { WishlistButton } from "@/components/shop/WishlistButton";
import type { Product } from "@/lib/shop/ecommerce-api";
import { formatInr, getProductPrice } from "@/lib/shop/format";
import { cn } from "@/lib/utils";

function primaryVariant(product: Product) {
  return (
    product.variants.find((variant) => variant.stock > 0) ||
    product.variants[0] || {
      id: product.id,
      sku: product.sku,
      variantLabel: "Standard",
      stock: product.totalStock,
      price: getProductPrice(product),
    }
  );
}

export function ProductCard({ product }: { product: Product }) {
  const price = getProductPrice(product);
  const variant = primaryVariant(product);
  const image = product.images?.[0];
  const stockLevel =
    product.totalStock === 0
      ? "Sold out"
      : product.totalStock <= 8
        ? `${product.totalStock} left`
        : "In stock";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      whileHover={{ y: -8 }}
      className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-md transition-all duration-300 hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-200/50"
    >
      <Link href={`/shop/products/${product.id}`} className="block relative overflow-hidden">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50">
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent z-10" />
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400">
              {product.category}
            </div>
          )}
          {product.salePrice ? (
            <span className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#ff5722] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              <BadgePercent className="h-3.5 w-3.5" />
              Sale
            </span>
          ) : null}
          <div className="absolute right-4 top-4 z-20">
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-colors group-hover:text-[#ff5722]">
              {product.category}
            </p>
            <Link
              href={`/shop/products/${product.id}`}
              className="mt-1.5 block text-lg font-black leading-tight text-slate-900 transition-colors hover:text-[#ff5722]"
            >
              {product.name}
            </Link>
            <div className="mt-2 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-slate-700">4.8</span>
              <span className="text-xs font-medium text-slate-400">(124 reviews)</span>
            </div>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
            stockLevel === "Sold out" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          )}>
            {stockLevel}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-500">
          {product.description}
        </p>

        <div className="mt-auto pt-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-tight text-slate-900">
              {formatInr(price)}
            </div>
            {product.salePrice ? (
              <div className="mt-0.5 text-xs font-bold text-slate-400 line-through">
                {formatInr(product.basePrice)}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/shop/products/${product.id}`}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-[#ff5722] hover:bg-[#ff5722] hover:text-white hover:shadow-md"
              aria-label={`View ${product.name}`}
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
            <AddToCartButton
              compact
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
          </div>
        </div>
      </div>
    </motion.article>
  );
}
