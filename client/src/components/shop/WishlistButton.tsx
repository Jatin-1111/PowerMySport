"use client";

import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initialIsWished = false,
  className,
}: {
  productId: string;
  initialIsWished?: boolean;
  className?: string;
}) {
  const [isWished, setIsWished] = useState(initialIsWished);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Optionally fetch initial wishlist state if not provided
  }, [productId]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating if wrapped in a Link
    e.stopPropagation();

    try {
      setIsLoading(true);
      // Optimistic update
      setIsWished(!isWished);

      const res = await api.post("/v1/wishlist/toggle", { productId });
      if (!res.data?.ok) {
        throw new Error(res.data?.error?.message || "Failed to toggle wishlist");
      }
      
      const newWished = res.data.data.isWished;
      if (newWished !== undefined) {
        setIsWished(newWished);
      }
    } catch (error: any) {
      alert(error.message || "Failed to update wishlist. Please log in.");
      setIsWished(isWished); // Revert
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      disabled={isLoading}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-md transition-all hover:scale-110 active:scale-95 disabled:opacity-50",
        className
      )}
      aria-label="Toggle wishlist"
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          isWished ? "fill-red-500 text-red-500" : "text-slate-500 hover:text-red-500"
        )}
      />
    </button>
  );
}
