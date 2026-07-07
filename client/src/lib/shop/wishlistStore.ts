import api from "@/lib/api/client";
import { create } from "zustand";

interface WishlistStore {
  wishlistProductIds: string[];
  wishlistProducts: any[];
  isLoading: boolean;
  isLoaded: boolean;
  fetchWishlist: (force?: boolean) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<boolean>;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  wishlistProductIds: [],
  wishlistProducts: [],
  isLoading: false,
  isLoaded: false,
  fetchWishlist: async (force = false) => {
    if (get().isLoaded && !force) return;
    try {
      set({ isLoading: true });
      const res = await api.get("/v1/wishlist");
      if (res.data?.ok) {
        const items = res.data.data || [];
        const products = items
          .map((item: any) => item.productId)
          .filter(Boolean);
        const ids = products.map((p: any) => p.id || p._id);
        set({
          wishlistProductIds: ids,
          wishlistProducts: products,
          isLoaded: true,
        });
      }
    } catch (err) {
      console.error("Failed to load wishlist", err);
    } finally {
      set({ isLoading: false });
    }
  },
  toggleWishlist: async (productId: string) => {
    const currentIds = get().wishlistProductIds;
    const currentProducts = get().wishlistProducts;
    const isWished = currentIds.includes(productId);

    // Optimistic update
    const newIds = isWished
      ? currentIds.filter((id) => id !== productId)
      : [...currentIds, productId];
    set({ wishlistProductIds: newIds });

    try {
      const res = await api.post("/v1/wishlist/toggle", { productId });
      if (res.data?.ok) {
        const items = res.data.data || [];
        const products = items
          .map((item: any) => item.productId)
          .filter(Boolean);
        const ids = products.map((p: any) => p.id || p._id);
        set({
          wishlistProductIds: ids,
          wishlistProducts: products,
          isLoaded: true,
        });
        return ids.includes(productId);
      }
      set({
        wishlistProductIds: currentIds,
        wishlistProducts: currentProducts,
      });
      return isWished;
    } catch (err) {
      console.error("Toggle wishlist error", err);
      set({
        wishlistProductIds: currentIds,
        wishlistProducts: currentProducts,
      });
      throw err;
    }
  },
  clearWishlist: () => {
    set({ wishlistProductIds: [], wishlistProducts: [], isLoaded: false });
  },
}));
