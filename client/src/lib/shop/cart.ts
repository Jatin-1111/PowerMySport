"use client";

import { useSyncExternalStore } from "react";

export interface ShopCartItem {
  productId: string;
  variantId: string;
  sku?: string;
  name: string;
  category?: string;
  image?: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  stock?: number;
}

const CART_KEY = "powermysport_shop_cart";
const CART_EVENT = "powermysport_shop_cart_changed";

function emitCartChange() {
  window.dispatchEvent(new Event(CART_EVENT));
}

function sanitizeCart(items: ShopCartItem[]): ShopCartItem[] {
  return items
    .filter(
      (item) =>
        item &&
        typeof item.productId === "string" &&
        typeof item.variantId === "string" &&
        typeof item.name === "string" &&
        typeof item.unitPrice === "number" &&
        Number.isFinite(item.unitPrice) &&
        typeof item.quantity === "number" &&
        item.quantity > 0,
    )
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(item.quantity)),
    }));
}

const EMPTY_CART: ShopCartItem[] = [];
let cachedCartString: string | null = null;
let cachedCartItems: ShopCartItem[] = EMPTY_CART;

export function readShopCart(): ShopCartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;

  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) {
      cachedCartString = null;
      return EMPTY_CART;
    }

    if (raw === cachedCartString) {
      return cachedCartItems;
    }

    const parsed = JSON.parse(raw) as ShopCartItem[];
    if (!Array.isArray(parsed)) return EMPTY_CART;

    cachedCartString = raw;
    cachedCartItems = sanitizeCart(parsed);
    return cachedCartItems;
  } catch {
    return EMPTY_CART;
  }
}

export function writeShopCart(items: ShopCartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(sanitizeCart(items)));
  emitCartChange();
}

export function addShopCartItem(item: ShopCartItem): ShopCartItem[] {
  const current = [...readShopCart()];
  const existing = current.find((entry) => entry.variantId === item.variantId);

  if (existing) {
    existing.quantity = Math.min(
      item.stock ?? Number.MAX_SAFE_INTEGER,
      existing.quantity + item.quantity,
    );
  } else {
    current.push({
      ...item,
      quantity: Math.min(item.stock ?? Number.MAX_SAFE_INTEGER, item.quantity),
    });
  }

  writeShopCart(current);
  return readShopCart();
}

export function updateShopCartQuantity(
  variantId: string,
  quantity: number,
): ShopCartItem[] {
  const current = readShopCart();

  if (quantity <= 0) {
    writeShopCart(current.filter((item) => item.variantId !== variantId));
    return readShopCart();
  }

  writeShopCart(
    current.map((item) =>
      item.variantId === variantId
        ? {
            ...item,
            quantity: Math.min(
              item.stock ?? Number.MAX_SAFE_INTEGER,
              Math.max(1, Math.floor(quantity)),
            ),
          }
        : item,
    ),
  );
  return readShopCart();
}

export function clearShopCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_KEY);
  emitCartChange();
}

export function getShopCartTotals(items: ShopCartItem[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const taxAmount = Math.round(subtotal * 0.18);
  const shippingAmount = subtotal > 0 && subtotal < 500000 ? 4900 : 0;

  return {
    subtotal,
    taxAmount,
    shippingAmount,
    total: subtotal + taxAmount + shippingAmount,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useShopCart() {
  return useSyncExternalStore(subscribe, readShopCart, () => EMPTY_CART);
}
