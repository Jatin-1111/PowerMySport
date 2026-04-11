import axiosInstance from "@/lib/api/axios";

export interface AdminProductRecord {
  _id: string;
  sku: string;
  name: string;
  category: string;
  basePrice: number;
  salePrice?: number;
  totalStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminOrderRecord {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  createdAt: string;
}

interface ApiResponse<T> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  message?: string;
}

export const adminEcommerceApi = {
  async listProducts(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const response = await axiosInstance.get<
      ApiResponse<{
        products: AdminProductRecord[];
        total: number;
        page: number;
        pages: number;
      }>
    >(`/v1/admin/products${query.toString() ? `?${query.toString()}` : ""}`);

    return response.data;
  },

  async createProduct(payload: {
    sku: string;
    name: string;
    description: string;
    category: string;
    basePrice: number;
    salePrice?: number;
    weight: number;
    dimensions: { length: number; width: number; height: number };
    taxable: boolean;
    taxRate: number;
    isActive: boolean;
    images: string[];
    variants: Array<{
      sku: string;
      attributes: Record<string, string>;
      price: number;
      stock: number;
      reorderLevel?: number;
    }>;
  }) {
    const response = await axiosInstance.post<
      ApiResponse<{ product: AdminProductRecord }>
    >("/v1/admin/products", payload);

    return response.data;
  },

  async listOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);

    const response = await axiosInstance.get<
      ApiResponse<{
        orders: AdminOrderRecord[];
        total: number;
        page: number;
        pages: number;
      }>
    >(`/v1/admin/orders${query.toString() ? `?${query.toString()}` : ""}`);

    return response.data;
  },
};
