// Product & Catalog Types
export type ProductCategory =
  | "APPAREL"
  | "FOOTWEAR"
  | "ACCESSORIES"
  | "EQUIPMENT";

export interface IProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantLabel: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  images: string[];
  basePrice: number;
  salePrice?: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  taxable: boolean;
  taxRate: number;
  variants: IProductVariant[];
  totalStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Cart Types
export interface ICartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  lineTotal: number;
  reservedAt?: Date;
}

export interface ICart {
  id: string;
  userId: string;
  items: ICartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  appliedPromoCode?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Order & Payment Enums
export enum OrderStatus {
  CART = "CART",
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURNED = "RETURNED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  AUTHORIZED = "AUTHORIZED",
  CAPTURED = "CAPTURED",
  FAILED = "FAILED",
  REFUND_INITIATED = "REFUND_INITIATED",
  REFUNDED = "REFUNDED",
}

export enum FulfillmentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum PaymentGateway {
  RAZORPAY = "RAZORPAY",
  STRIPE = "STRIPE",
}

// Order Types
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

export interface IOrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: Date;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  items: IOrderItem[];

  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;

  status: OrderStatus;
  paymentMethod: string;
  paymentGateway: PaymentGateway;
  paymentGatewayOrderId: string;
  paymentGatewayPaymentId?: string;
  paymentStatus: PaymentStatus;

  appliedPromoCode?: string;
  promoDiscountAmount: number;

  shippingAddress: ShippingAddress;
  estimatedDeliveryDate?: Date;

  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;

  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

// Payment Transaction Type
export interface IPaymentTransaction {
  id: string;
  orderId: string;
  paymentGateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  gatewayResponse: Record<string, any>;
  webhookData?: Record<string, any>;
  attemptNumber: number;
  lastRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Type
export interface IInventory {
  id: string;
  productVariantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  lastStockCheckAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Cart API Request Types
export interface AddToCartRequest {
  productVariantId: string;
  quantity: number;
}

export interface RemoveFromCartRequest {
  cartItemId: string;
}

export interface ApplyPromoRequest {
  promoCode: string;
}

// Order API Request Types
export interface CreateOrderFromCartRequest {
  shippingAddress: ShippingAddress;
  paymentMethod: string;
}

export interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface CancelOrderRequest {
  reason: string;
}

// Admin API Request Types
export interface CreateProductRequest {
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  basePrice: number;
  salePrice?: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  taxable: boolean;
  taxRate: number;
  isActive: boolean;
  images: string[];
  variants: {
    sku: string;
    attributes: Record<string, string>;
    price: number;
    stock: number;
    reorderLevel?: number;
  }[];
}

export interface UpdateInventoryRequest {
  stock: number;
  reorderLevel: number;
}

export interface UpdateFulfillmentStatusRequest {
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;
}

export interface InitiateRefundRequest {
  refundAmount: number;
  reason: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
