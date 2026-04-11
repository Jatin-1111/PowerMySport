"use client";

import { useState } from "react";
import { addToLocalCart } from "@/lib/cart";

export default function AddToCartButton({
  productId,
  name,
  unitPrice,
}: {
  productId: string;
  name: string;
  unitPrice: number;
}) {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addToLocalCart({ productId, name, unitPrice, quantity: 1 });
        setAdded(true);
        setTimeout(() => setAdded(false), 1400);
      }}
      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
    >
      {added ? "Added" : "Add to Cart"}
    </button>
  );
}
