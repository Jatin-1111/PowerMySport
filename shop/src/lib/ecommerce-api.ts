export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantLabel: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  basePrice: number;
  salePrice?: number;
  taxable: boolean;
  taxRate: number;
  variants: ProductVariant[];
  totalStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productVariantId: string;
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  appliedPromoCode?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Request failed");
  }

  return payload.data as T;
}

export async function listProducts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
}): Promise<{
  products: Product[];
  total: number;
  page: number;
  pages: number;
}> {
  const query = new URLSearchParams();

  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  if (params?.sortBy) query.set("sortBy", params.sortBy);

  const qs = query.toString();
  return apiFetch<{
    products: Product[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/v1/products${qs ? `?${qs}` : ""}`);
}

export async function getProductById(id: string): Promise<Product> {
  return apiFetch<Product>(`/api/v1/products/${id}`);
}

export async function getCart(token: string): Promise<Cart> {
  return apiFetch<Cart>("/api/v1/cart", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
