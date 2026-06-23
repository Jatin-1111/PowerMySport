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
  _id?: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand?: string;
  images: string[];
  basePrice: number;
  salePrice?: number;
  taxable: boolean;
  taxRate: number;
  variants: ProductVariant[];
  totalStock: number;
  isActive: boolean;
  seller?: string;
  sellerName?: string;
  sellerType?: "MERCHANT" | "PARENT" | "PLAYER" | "COACH" | "ACADEMY" | "SYSTEM";
  condition?: "NEW" | "USED";
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
  sellerId?: string;
  condition?: "NEW" | "USED";
  fulfillmentStatus?: string;
  trackingNumber?: string;
}

export interface Order {
  id: string;
  _id?: string;
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

const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod_1",
    sku: "RUN-SHOE-001",
    name: "AeroGlide Pro Running Shoes",
    description: "Ultra-lightweight running shoes with responsive cushioning.",
    category: "Running",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 12999,
    salePrice: 9999,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 50,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod_2",
    sku: "BBALL-001",
    name: "Elite Grip Basketball",
    description: "Official size indoor/outdoor composite leather basketball.",
    category: "Basketball",
    images: [
      "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1494199505258-5f95387f933c?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 2499,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 100,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod_3",
    sku: "YOGA-MAT-001",
    name: "Zenith Pro Yoga Mat",
    description: "Extra thick, non-slip premium yoga mat for serious practitioners.",
    category: "Yoga",
    images: [
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1599443015574-be5fe8a05783?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 3499,
    salePrice: 2999,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 200,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod_4",
    sku: "GYM-BAG-001",
    name: "Titanium Duffel Bag",
    description: "Spacious, water-resistant gym bag with shoe compartment.",
    category: "Accessories",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1547949007-5350520cb955?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 4599,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 30,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod_5",
    sku: "TRACK-PANT-001",
    name: "Velocity Track Pants",
    description: "Breathable, sweat-wicking track pants for ultimate mobility.",
    category: "Training",
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 2199,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 75,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "prod_6",
    sku: "DUMBBELL-001",
    name: "Hex Iron Dumbbells (Pair)",
    description: "Premium rubber-coated hex dumbbells for strength training.",
    category: "Training",
    images: [
      "https://images.unsplash.com/photo-1586401700864-76ce0730d5fa?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80"
    ],
    basePrice: 5999,
    salePrice: 4999,
    taxable: true,
    taxRate: 18,
    variants: [],
    totalStock: 15,
    isActive: true,
    createdAt: new Date().toISOString(),
  }
];

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
  condition?: string;
  sellerType?: string;
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
  try {
    return await apiFetch(`/v1/products${toQuery(params)}`);
  } catch (error) {
    // Return demo data if backend API fails or is not implemented
    let filtered = [...DEMO_PRODUCTS];
    if (params?.category && params.category !== "ALL") {
      filtered = filtered.filter(p => p.category === params.category);
    }
    if (params?.search) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(params.search!.toLowerCase()));
    }
    
    return {
      products: filtered,
      total: filtered.length,
      page: 1,
      pages: 1,
      facets: {
        brands: ["Nike", "Adidas", "Puma", "Under Armour"],
        minPrice: 0,
        maxPrice: 20000
      }
    };
  }
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

export async function listSellerProducts(): Promise<Product[]> {
  const response = await axios.get<ApiEnvelope<Product[]>>("/v1/seller/products");
  return response.data.data;
}

export async function createSellerProduct(data: Partial<Product> & { stock?: number; condition?: string }): Promise<Product> {
  const response = await axios.post<ApiEnvelope<Product>>("/v1/seller/products", data);
  return response.data.data;
}

export async function updateSellerProduct(productId: string, data: Partial<Product> & { stock?: number }): Promise<Product> {
  const response = await axios.patch<ApiEnvelope<Product>>(`/v1/seller/products/${productId}`, data);
  return response.data.data;
}

export async function deleteSellerProduct(productId: string): Promise<void> {
  await axios.delete<ApiEnvelope<unknown>>(`/v1/seller/products/${productId}`);
}

export async function listSellerOrders(): Promise<Order[]> {
  const response = await axios.get<ApiEnvelope<Order[]>>("/v1/seller/orders");
  return response.data.data;
}

export async function updateSellerOrderItemFulfillment(
  orderId: string,
  productVariantId: string,
  fulfillmentStatus: string,
  trackingNumber?: string
): Promise<Order> {
  const response = await axios.patch<ApiEnvelope<Order>>(
    `/v1/seller/orders/${orderId}/items/${productVariantId}/fulfillment`,
    { fulfillmentStatus, trackingNumber }
  );
  return response.data.data;
}
