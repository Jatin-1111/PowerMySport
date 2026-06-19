"use client";

import { motion } from "framer-motion";
import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { addShopCartItem, type ShopCartItem } from "@/lib/shop/cart";
import { addBackendCartItem } from "@/lib/shop/ecommerce-api";
import { cn } from "@/utils/cn";

export function AddToCartButton({
  item,
  className,
  compact = false,
}: {
  item: ShopCartItem;
  className?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");

  async function handleAdd() {
    if (state === "adding" || item.stock === 0) return;

    setState("adding");
    addShopCartItem(item);

    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      addBackendCartItem(item.variantId, item.quantity).catch(() => undefined);
    }

    setState("added");
    window.setTimeout(() => setState("idle"), 1200);
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={handleAdd}
      disabled={state === "adding" || item.stock === 0}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400",
        compact && "h-10 px-3",
        className,
      )}
    >
      {state === "added" ? (
        <Check className="h-4 w-4" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      {state === "added" ? "Added" : item.stock === 0 ? "Sold Out" : "Add"}
    </motion.button>
  );
}
