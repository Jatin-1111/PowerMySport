import mongoose, { Document, Schema } from "mongoose";
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  PaymentGateway,
  ProductCategory,
  ShippingAddress,
} from "../types/ecommerce";

// ============ PRODUCT MODELS ============

export interface ProductVariantDocument extends Document {
  _id: mongoose.Types.ObjectId;
  sku: string;
  variantLabel: string;
  attributes: Map<string, string>;
  price: number;
  stock: number;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDocument extends Document {
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
  variants: ProductVariantDocument[];
  totalStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productVariantSchema = new Schema<ProductVariantDocument>({
  sku: {
    type: String,
    required: [true, "Variant SKU is required"],
    trim: true,
  },
  variantLabel: {
    type: String,
    required: [true, "Variant label is required"],
    trim: true,
  },
  attributes: {
    type: Map,
    of: String,
    required: true,
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price must be non-negative"],
  },
  stock: {
    type: Number,
    required: [true, "Stock is required"],
    min: [0, "Stock cannot be negative"],
    default: 0,
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const productSchema = new Schema<ProductDocument>(
  {
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["APPAREL", "FOOTWEAR", "ACCESSORIES", "EQUIPMENT"],
      required: [true, "Product category is required"],
    },
    images: {
      type: [String],
      required: [true, "At least one image is required"],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one image URL is required",
      },
    },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Price must be non-negative"],
    },
    salePrice: {
      type: Number,
      min: [0, "Sale price must be non-negative"],
      validate: {
        validator: function (this: ProductDocument, v?: number) {
          return !v || v <= this.basePrice;
        },
        message: "Sale price must be less than or equal to base price",
      },
    },
    weight: {
      type: Number,
      required: [true, "Weight is required"],
      min: [0.1, "Weight must be at least 0.1g"],
    },
    dimensions: {
      length: {
        type: Number,
        required: [true, "Length is required"],
        min: [0.1, "Length must be positive"],
      },
      width: {
        type: Number,
        required: [true, "Width is required"],
        min: [0.1, "Width must be positive"],
      },
      height: {
        type: Number,
        required: [true, "Height is required"],
        min: [0.1, "Height must be positive"],
      },
    },
    taxable: {
      type: Boolean,
      required: true,
      default: true,
    },
    taxRate: {
      type: Number,
      required: [true, "Tax rate is required"],
      min: [0, "Tax rate cannot be negative"],
      max: [1, "Tax rate cannot exceed 100%"],
    },
    variants: {
      type: [productVariantSchema],
      required: [true, "At least one variant is required"],
      validate: {
        validator: (v: ProductVariantDocument[]) => v.length > 0,
        message: "At least one variant is required",
      },
    },
    totalStock: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Update totalStock on variant change
productSchema.pre("save", function () {
  this.totalStock = this.variants.reduce((sum, v) => sum + v.stock, 0);
});

export const Product = mongoose.model<ProductDocument>(
  "Product",
  productSchema,
);

// ============ INVENTORY MODEL ============

export interface InventoryDocument extends Document {
  productVariantId: mongoose.Types.ObjectId;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel: number;
  lastStockCheckAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<InventoryDocument>(
  {
    productVariantId: {
      type: Schema.Types.ObjectId,
      ref: "Product.variants",
      required: true,
      unique: true,
    },
    quantityOnHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantityReserved: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    lastStockCheckAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Ensure quantityAvailable is always up-to-date
inventorySchema.pre("save", function () {
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved;
  if (this.quantityAvailable < 0) {
    throw new Error("Reserved quantity cannot exceed on-hand quantity");
  }
});

export const Inventory = mongoose.model<InventoryDocument>(
  "Inventory",
  inventorySchema,
);

// ============ CART MODELS ============

export interface CartItemDocument extends Document {
  cartId: mongoose.Types.ObjectId;
  productVariantId: mongoose.Types.ObjectId;
  quantity: number;
  lineTotal: number;
  reservedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartDocument extends Document {
  userId: mongoose.Types.ObjectId;
  items: CartItemDocument[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  appliedPromoCode?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<CartItemDocument>({
  cartId: {
    type: Schema.Types.ObjectId,
    ref: "Cart",
    required: true,
  },
  productVariantId: {
    type: Schema.Types.ObjectId,
    required: [true, "Product variant ID is required"],
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [1, "Quantity must be at least 1"],
  },
  lineTotal: {
    type: Number,
    required: [true, "Line total is required"],
    min: 0,
  },
  reservedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new Schema<CartDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    items: {
      type: [cartItemSchema],
      required: true,
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    appliedPromoCode: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index for automatic cleanup
    },
  },
  { timestamps: true },
);

export const Cart = mongoose.model<CartDocument>("Cart", cartSchema);

// ============ ORDER MODELS ============

export interface OrderItemDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  productVariantId: mongoose.Types.ObjectId;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: Date;
}

export interface OrderDocument extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  items: OrderItemDocument[];
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

const orderItemSchema = new Schema<OrderItemDocument>({
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  productVariantId: {
    type: Schema.Types.ObjectId,
    required: [true, "Product variant ID is required"],
  },
  productName: {
    type: String,
    required: true,
  },
  variantLabel: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const orderSchema = new Schema<OrderDocument>(
  {
    orderNumber: {
      type: String,
      required: [true, "Order number is required"],
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, "Order must have at least one item"],
      validate: {
        validator: (v: OrderItemDocument[]) => v.length > 0,
        message: "Order must have at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.PENDING_PAYMENT,
      index: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    paymentGateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      required: true,
    },
    paymentGatewayOrderId: {
      type: String,
      required: true,
      trim: true,
    },
    paymentGatewayPaymentId: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.PENDING,
      index: true,
    },
    appliedPromoCode: {
      type: String,
      trim: true,
    },
    promoDiscountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      addressLine1: {
        type: String,
        required: true,
        trim: true,
      },
      addressLine2: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
        default: "IN",
      },
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    fulfillmentStatus: {
      type: String,
      enum: Object.values(FulfillmentStatus),
      required: true,
      default: FulfillmentStatus.PENDING,
      index: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Index for user orders sorted by date
orderSchema.index({ userId: 1, createdAt: -1 });

export const Order = mongoose.model<OrderDocument>("Order", orderSchema);

// ============ PAYMENT TRANSACTION MODEL ============

export interface PaymentTransactionDocument extends Document {
  orderId: mongoose.Types.ObjectId;
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

const paymentTransactionSchema = new Schema<PaymentTransactionDocument>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      index: true,
    },
    paymentGateway: {
      type: String,
      enum: Object.values(PaymentGateway),
      required: true,
    },
    gatewayOrderId: {
      type: String,
      required: [true, "Gateway order ID is required"],
      trim: true,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.PENDING,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: [true, "Idempotency key is required"],
      unique: true,
      trim: true,
      index: true,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    webhookData: {
      type: Schema.Types.Mixed,
    },
    attemptNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    lastRetryAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Index for retry logic
paymentTransactionSchema.index({ status: 1, lastRetryAt: 1 });

export const PaymentTransaction = mongoose.model<PaymentTransactionDocument>(
  "PaymentTransaction",
  paymentTransactionSchema,
);
