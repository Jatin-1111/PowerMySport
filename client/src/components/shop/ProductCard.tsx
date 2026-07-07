"use client";

import { motion } from "framer-motion";
import { BadgePercent } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const hoverImage = product.images?.[1] || image;
  const stockLevel =
    product.totalStock === 0
      ? "Sold out"
      : product.totalStock <= 8
        ? `${product.totalStock} left`
        : "In stock";

  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50"
    >
      <div className="relative">
        <Link
          href={`/shop/products/${product.id}`}
          className="block relative [perspective:1000px]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <motion.div
            className="relative aspect-[4/3] w-full [transform-style:preserve-3d] will-change-transform"
            animate={{
              rotateY: isHovered ? 180 : 0,
              scale: isHovered ? 1.02 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 90,
              damping: 15,
              mass: 0.8,
            }}
          >
            {image ? (
              <>
                <div className="absolute inset-0 [backface-visibility:hidden] bg-slate-50 overflow-hidden">
                  <img
                    src={image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                </div>
                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-slate-50 overflow-hidden">
                  <img
                    src={hoverImage}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 [backface-visibility:hidden] bg-slate-50 flex h-full items-center justify-center px-6 text-center text-sm font-bold text-slate-400">
                {product.category}
              </div>
            )}
          </motion.div>
        </Link>
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-2 pointer-events-none">
          {product.salePrice ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff5722] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              <BadgePercent className="h-3.5 w-3.5" />
              Sale
            </span>
          ) : null}
          {product.condition === "USED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
              Used
            </span>
          ) : null}
        </div>
        <div className="absolute right-4 top-4 z-20">
          <WishlistButton productId={product.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <Link
          href={`/shop/products/${product.id}`}
          className="block text-lg font-black leading-tight text-slate-900 transition-colors hover:text-[#ff5722] mb-1"
        >
          {product.name}
        </Link>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {product.category}{" "}
          {product.sellerName ? `• Sold by: ${product.sellerName}` : ""}
        </p>

        <div className="mt-auto pt-5 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
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
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                stockLevel === "Sold out"
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-600",
              )}
            >
              {stockLevel}
            </span>
          </div>

          <div className="w-full">
            <AddToCartButton
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
