import axiosInstance from "@/lib/api/axios";

export interface AdminProductRecord {
  id: string;
  sku: string;
  name: string;
  shortDescription?: string;
  description?: string;
  category: string;
  basePrice: number;
  salePrice?: number;
  totalStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductEditableFields {
  name?: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  basePrice?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface AdminOrderRecord {
  id: string;
  orderNumber: string;
  userId?: string | { _id?: string; id?: string; name?: string; email?: string };
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  createdAt: string;
}

export interface AdminOrderItemRecord {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  fulfillmentStatus: string;
  trackingNumber?: string;
}

export interface AdminOrderDetailRecord extends AdminOrderRecord {
  items: AdminOrderItemRecord[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

interface ApiResponse<T> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  message?: string;
  error?: { code?: string; message?: string };
}

export const adminEcommerceApi = {
  async listProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    sortBy?: "name" | "basePrice" | "totalStock" | "createdAt";
    sortOrder?: "asc" | "desc";
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (typeof params?.isActive === "boolean")
      query.set("isActive", String(params.isActive));
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

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

  async updateProduct(productId: string, payload: ProductEditableFields) {
    const response = await axiosInstance.patch<
      ApiResponse<{ product: AdminProductRecord }>
    >(`/v1/admin/products/${productId}`, payload);
    return response.data;
  },

  async createProduct(payload: {
    sku: string;
    name: string;
    shortDescription?: string;
    description: string;
    brand?: string;
    material?: string;
    warranty?: string;
    tags?: string[];
    ageGroup?: string;
    skillLevel?: string;
    gender?: string;
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

  async generateProductImageUploadUrl(fileName: string, contentType: string) {
    const response = await axiosInstance.post<
      ApiResponse<{ uploadUrl: string; downloadUrl: string; fileName: string; key: string }>
    >("/v1/admin/products/upload-url", { fileName, contentType });

    return response.data;
  },

  async listOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: "createdAt" | "totalAmount" | "orderNumber";
    sortOrder?: "asc" | "desc";
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.search) query.set("search", params.search);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

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

  async getOrderDetail(orderId: string) {
    const response = await axiosInstance.get<
      ApiResponse<{ order: AdminOrderDetailRecord }>
    >(`/v1/admin/orders/${orderId}`);
    return response.data;
  },

  async updateOrderFulfillmentStatus(
    orderId: string,
    fulfillmentStatus: string,
    trackingNumber?: string,
  ) {
    const response = await axiosInstance.patch<
      ApiResponse<{ order: AdminOrderDetailRecord }>
    >(`/v1/admin/orders/${orderId}/fulfillment-status`, {
      fulfillmentStatus,
      trackingNumber,
    });
    return response.data;
  },
};
