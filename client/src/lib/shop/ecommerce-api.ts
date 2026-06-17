import axios from "@/lib/api/axios";

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantLabel: string;
  attributes: Record<string, string>;
  price?: number;
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

export interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productVariantId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  estimatedDeliveryDate?: string;
  trackingNumber?: string;
  createdAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}

const serverBase =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";
const apiBase = (
  process.env.NEXT_PUBLIC_API_URL || `${serverBase.replace(/\/$/, "")}/api`
).replace(/\/$/, "");

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    message?: string;
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Request failed");
  }

  return payload.data;
}

function toQuery(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export async function listProducts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
  brand?: string;
  rating?: number;
  minPrice?: number;
  maxPrice?: number;
}): Promise<{
  products: Product[];
  total: number;
  page: number;
  pages: number;
  facets?: {
    brands: string[];
    minPrice: number;
    maxPrice: number;
  };
}> {
  return apiFetch(`/v1/products${toQuery(params)}`);
}

export async function getProductById(id: string): Promise<Product> {
  return apiFetch<Product>(`/v1/products/${id}`);
}

export async function getRelatedProducts(id: string, limit?: number): Promise<Product[]> {
  const query = limit ? `?limit=${limit}` : "";
  return apiFetch<Product[]>(`/v1/products/${id}/related${query}`);
}

export async function addBackendCartItem(
  productVariantId: string,
  quantity: number,
): Promise<Cart> {
  const response = await axios.post<ApiEnvelope<Cart>>(
    "/v1/cart/add-item",
    { productVariantId, quantity },
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  );
  return response.data.data;
}

export async function createOrderFromCart(payload: {
  shippingAddress: ShippingAddress;
  paymentMethod: "PHONEPE" | "RAZORPAY" | "COD";
}) {
  const response = await axios.post<
    ApiEnvelope<{
      order: Order;
      paymentConfig?: Record<string, unknown>;
    }>
  >("/v1/orders/create-from-cart", payload, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  return response.data.data;
}

export async function listOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<OrdersResponse> {
  const response = await axios.get<ApiEnvelope<OrdersResponse>>(
    `/v1/orders${toQuery(params)}`,
  );
  return response.data.data;
}

export async function getOrderById(id: string): Promise<Order> {
  const response = await axios.get<ApiEnvelope<Order>>(`/v1/orders/${id}`);
  return response.data.data;
}
