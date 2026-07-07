"use client";

import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { useWishlistStore } from "@/lib/shop/wishlistStore";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function WishlistButton({
  productId,
  initialIsWished,
  className,
}: {
  productId: string;
  initialIsWished?: boolean;
  className?: string;
}) {
  const { user } = useAuthStore();
  const { wishlistProductIds, fetchWishlist, toggleWishlist } =
    useWishlistStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user, fetchWishlist]);

  const isWished = user ? wishlistProductIds.includes(productId) : false;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating if wrapped in a Link
    e.stopPropagation();

    if (!user) {
      toast.error("Please log in to save items to your wishlist.");
      return;
    }

    try {
      setIsLoading(true);
      const newWishedState = await toggleWishlist(productId);
      if (newWishedState) {
        toast.success("Item saved to your wishlist!");
      } else {
        toast.success("Item removed from your wishlist.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update wishlist.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-md transition-all hover:scale-110 active:scale-95 disabled:opacity-50",
        className,
      )}
      aria-label="Toggle wishlist"
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          isWished
            ? "fill-red-500 text-red-500"
            : "text-slate-500 hover:text-red-500",
        )}
      />
    </button>
  );
}
