import { Metadata } from "next";
import { WishlistClient } from "./WishlistClient";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Wishlist | PowerMySport",
  description: "View your saved performance gear.",
};

export default async function WishlistPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let wishlistProducts = [];

  if (token) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/v1/shop/wishlist`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const data = await res.json();
      if (data.ok) {
        wishlistProducts = data.data.map((item: any) => ({
          ...item.productId,
          addedAt: item.addedAt,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch wishlist", error);
    }
  }

  return (
    <WishlistClient
      initialProducts={wishlistProducts}
      isAuthenticated={!!token}
    />
  );
}
