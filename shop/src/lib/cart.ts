export interface LocalCartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const CART_KEY = "powermysport_shop_cart";

export function readLocalCart(): LocalCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as LocalCartItem[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        typeof item.productId === "string" &&
        typeof item.name === "string" &&
        typeof item.unitPrice === "number" &&
        typeof item.quantity === "number" &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function writeLocalCart(items: LocalCartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToLocalCart(item: LocalCartItem): void {
  const current = readLocalCart();
  const existing = current.find((i) => i.productId === item.productId);

  if (existing) {
    existing.quantity += item.quantity;
  } else {
    current.push(item);
  }

  writeLocalCart(current);
}

export function updateLocalCartQuantity(
  productId: string,
  quantity: number,
): void {
  const current = readLocalCart();

  if (quantity <= 0) {
    writeLocalCart(current.filter((item) => item.productId !== productId));
    return;
  }

  const next = current.map((item) =>
    item.productId === productId ? { ...item, quantity } : item,
  );
  writeLocalCart(next);
}

export function clearLocalCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_KEY);
}
