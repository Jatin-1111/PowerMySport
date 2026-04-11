# PowerMySport Merchandise Ecommerce API Contract

**Date Created:** April 8, 2026  
**Scope:** MVP merchandise store in shop app, single-vendor (PowerMySport-owned), payment gateway abstraction layer  
**Status:** Contract Frozen for Phase 1 → Phase 2 Implementation

---

## Table of Contents

1. [Core Domain Models](#core-domain-models)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Schemas](#requestresponse-schemas)
4. [Webhook Payloads](#webhook-payloads)
5. [Enumerations](#enumerations)
6. [Error Codes](#error-codes)

---

## Core Domain Models

### Product

Represents a merchandise item in the catalog (gear, apparel, accessories).

```typescript
interface Product {
  id: string; // MongoDB ObjectId
  sku: string; // Unique SKU (e.g., "TEE-001-BLK")
  name: string; // "Running T-Shirt"
  description: string;
  category: string; // "APPAREL" | "FOOTWEAR" | "ACCESSORIES"
  images: string[]; // Array of S3 URLs
  basePrice: number; // Price in paise (e.g., 99900 = ₹999)
  salePrice?: number; // Discounted price in paise
  weight: number; // Weight in grams
  dimensions: {
    length: number; // cm
    width: number; // cm
    height: number; // cm
  };
  taxable: boolean;
  taxRate: number; // e.g., 0.18 for 18% GST
  variants: ProductVariant[]; // Size, color options
  totalStock: number; // Sum of all variant stock
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface ProductVariant {
  id: string;
  productId: string;
  sku: string; // "TEE-001-BLK-L"
  variantLabel: string; // "Size: L / Color: Black"
  attributes: Record<string, string>; // { size: "L", color: "Black" }
  price: number; // Can override basePrice
  stock: number;
  reorderLevel: number; // Alert if stock < this
  createdAt: string;
}
```

### Cart & Cart Items

Shopping cart per user session.

```typescript
interface Cart {
  id: string;
  userId: string; // Authenticated user ID
  items: CartItem[];
  subtotal: number; // Sum of line totals (paise)
  taxAmount: number; // Calculated at cart level (paise)
  discountAmount: number; // Applied promo discount (paise)
  totalAmount: number; // subtotal + tax - discount (paise)
  appliedPromoCode?: string; // If a promo is active
  expiresAt: string; // Cart TTL (e.g., 24 hours from last update)
  createdAt: string;
  updatedAt: string;
}

interface CartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  lineTotal: number; // (price * quantity) before tax/discount
  reservedAt?: string; // When inventory was reserved
}
```

### Order

Represents a completed or in-progress purchase.

```typescript
interface Order {
  id: string;
  orderNumber: string; // User-facing unique ID (e.g., "ORD-20260408-001")
  userId: string;
  items: OrderItem[];

  // Pricing
  subtotal: number; // Line items total (paise)
  taxAmount: number;
  shippingAmount: number; // 0 for now (reserved for future)
  discountAmount: number;
  totalAmount: number; // Final amount charged

  // Status
  status: OrderStatus; // CART | PENDING_PAYMENT | PAYMENT_CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | RETURNED

  // Payment
  paymentMethod: string; // "RAZORPAY" | "STRIPE" | "UPI" | "WALLET" (future)
  paymentGateway: PaymentGateway;
  paymentGatewayOrderId: string; // Razorpay order_id
  paymentGatewayPaymentId?: string; // Razorpay payment_id
  paymentStatus: PaymentStatus;

  // Promo
  appliedPromoCode?: string;
  promoDiscountAmount: number;

  // Shipping
  shippingAddress: ShippingAddress;
  estimatedDeliveryDate?: string; // ISO 8601

  // Fulfillment
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  productName: string; // Denormalized for order history
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number; // unitPrice * quantity (before tax)
}

interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // Default: "IN"
}
```

### PaymentTransaction

Records payment attempts and status from gateway.

```typescript
interface PaymentTransaction {
  id: string;
  orderId: string;
  paymentGateway: PaymentGateway; // "RAZORPAY" | "STRIPE"
  gatewayOrderId: string; // Razorpay order_id
  gatewayPaymentId?: string; // Razorpay payment_id (after payment attempt)
  amount: number; // Paise
  currency: string; // "INR"
  status: PaymentStatus;

  // Idempotency & Audit
  idempotencyKey: string; // For duplicate prevention
  gatewayResponse: Record<string, any>; // Full gateway response
  webhookData?: Record<string, any>; // Webhook payload

  // Attempt tracking
  attemptNumber: number;
  lastRetryAt?: string;

  createdAt: string;
  updatedAt: string;
}
```

### Inventory

Tracks stock levels and reservations.

```typescript
interface Inventory {
  id: string;
  productVariantId: string;
  quantityOnHand: number; // Physical stock
  quantityReserved: number; // In active carts/pending orders
  quantityAvailable: number; // On-hand - reserved
  reorderLevel: number; // Alert threshold
  lastStockCheckAt: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## API Endpoints

### Customer APIs

#### Catalog

**GET /api/v1/products**
List products with filtering and pagination.

Request:

```json
{
  "page": 1,
  "limit": 20,
  "category": "APPAREL",
  "search": "running",
  "sortBy": "price_asc" // price_asc | price_desc | newest | popularity
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "products": [
      {
        "id": "prod_001",
        "sku": "TEE-001-BLK",
        "name": "Running T-Shirt",
        "basePrice": 99900,
        "salePrice": 79900,
        "images": ["https://s3.../image1.jpg"],
        "category": "APPAREL",
        "totalStock": 150,
        "variants": [
          {
            "id": "var_001",
            "variantLabel": "Size: M / Color: Black",
            "sku": "TEE-001-BLK-M",
            "stock": 50
          }
        ]
      }
    ],
    "total": 245,
    "page": 1,
    "pages": 13
  }
}
```

**GET /api/v1/products/{id}**
Get single product detail.

Response:

```json
{
  "ok": true,
  "data": {
    "id": "prod_001",
    "sku": "TEE-001-BLK",
    "name": "Running T-Shirt",
    "description": "Breathable...",
    "basePrice": 99900,
    "salePrice": 79900,
    "weight": 200,
    "dimensions": { "length": 75, "width": 55, "height": 5 },
    "taxable": true,
    "taxRate": 0.18,
    "category": "APPAREL",
    "images": ["https://s3.../image1.jpg"],
    "variants": [
      {
        "id": "var_001",
        "productId": "prod_001",
        "sku": "TEE-001-BLK-M",
        "variantLabel": "Size: M / Color: Black",
        "attributes": { "size": "M", "color": "Black" },
        "price": 79900,
        "stock": 50
      }
    ],
    "totalStock": 150,
    "isActive": true,
    "createdAt": "2026-04-01T10:00:00Z"
  }
}
```

#### Cart

**POST /api/v1/cart/add-item**
Add item to cart.

Request:

```json
{
  "productVariantId": "var_001",
  "quantity": 2
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "cartId": "cart_001",
    "items": [
      {
        "id": "item_001",
        "productVariantId": "var_001",
        "quantity": 2,
        "lineTotal": 159800
      }
    ],
    "subtotal": 159800,
    "taxAmount": 28764,
    "discountAmount": 0,
    "totalAmount": 188564,
    "updatedAt": "2026-04-08T12:30:00Z"
  }
}
```

**POST /api/v1/cart/remove-item**
Remove item from cart.

Request:

```json
{
  "cartItemId": "item_001"
}
```

Response: `{ "ok": true, "data": { ... updated cart ... } }`

**GET /api/v1/cart**
Fetch current cart.

Response: `{ "ok": true, "data": { ... cart object ... } }`

**POST /api/v1/cart/apply-promo**
Apply promo code to cart.

Request:

```json
{
  "promoCode": "SUMMER20"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "appliedPromoCode": "SUMMER20",
    "discountAmount": 31960,
    "totalAmount": 156604,
    "cartId": "cart_001"
  }
}
```

Error (invalid promo):

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_PROMO",
    "message": "Promo code not found or expired"
  }
}
```

**POST /api/v1/cart/clear**
Clear entire cart.

Response: `{ "ok": true, "data": { "cartId": "cart_001" } }`

#### Checkout & Payment

**POST /api/v1/orders/create-from-cart**
Convert cart to order and initiate payment.

Request:

```json
{
  "shippingAddress": {
    "fullName": "Raj Kumar",
    "email": "raj@example.com",
    "phone": "+91-9876543210",
    "addressLine1": "123 Main St",
    "city": "Delhi",
    "state": "DL",
    "postalCode": "110001",
    "country": "IN"
  },
  "paymentMethod": "RAZORPAY"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "order": {
      "id": "ord_001",
      "orderNumber": "ORD-20260408-001",
      "status": "PENDING_PAYMENT",
      "totalAmount": 188564,
      "paymentGateway": "RAZORPAY",
      "paymentGatewayOrderId": "order_Kxxt66cd9fxzta",
      "createdAt": "2026-04-08T12:35:00Z"
    },
    "paymentConfig": {
      "razorpayOrderId": "order_Kxxt66cd9fxzta",
      "amount": 188564,
      "currency": "INR",
      "key": "rzp_live_YOUR_KEY_ID",
      "description": "Order ORD-20260408-001 - PowerMySport",
      "prefill": {
        "name": "Raj Kumar",
        "email": "raj@example.com",
        "contact": "9876543210"
      }
    }
  }
}
```

**POST /api/v1/orders/{orderId}/verify-payment**
Verify payment after gateway callback.

Request:

```json
{
  "razorpay_payment_id": "pay_Kxxt66cd9fxzta",
  "razorpay_order_id": "order_Kxxt66cd9fxzta",
  "razorpay_signature": "9ef4dffbfd84f1318f6739..."
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "order": {
      "id": "ord_001",
      "orderNumber": "ORD-20260408-001",
      "status": "PAYMENT_CONFIRMED",
      "paymentStatus": "CAPTURED",
      "totalAmount": 188564,
      "updatedAt": "2026-04-08T12:36:00Z"
    }
  }
}
```

Error (verification failed):

```json
{
  "ok": false,
  "error": {
    "code": "PAYMENT_VERIFICATION_FAILED",
    "message": "Invalid or tampered payment data"
  }
}
```

**GET /api/v1/orders/{orderId}**
Get order details.

Response:

```json
{
  "ok": true,
  "data": {
    "id": "ord_001",
    "orderNumber": "ORD-20260408-001",
    "status": "PAYMENT_CONFIRMED",
    "items": [...],
    "totalAmount": 188564,
    "paymentStatus": "CAPTURED",
    "fulfillmentStatus": "PENDING",
    "shippingAddress": {...},
    "createdAt": "2026-04-08T12:35:00Z"
  }
}
```

**GET /api/v1/orders**
List user's orders with pagination.

Request:

```json
{
  "page": 1,
  "limit": 10,
  "status": "PAYMENT_CONFIRMED"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "orders": [...],
    "total": 5,
    "page": 1,
    "pages": 1
  }
}
```

**POST /api/v1/orders/{orderId}/cancel**
Cancel an order (allowed only in PENDING_PAYMENT state).

Request:

```json
{
  "reason": "Changed my mind"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "order": {
      "id": "ord_001",
      "status": "CANCELLED",
      "cancelledAt": "2026-04-08T12:40:00Z",
      "cancelReason": "Changed my mind"
    }
  }
}
```

---

### Admin APIs

#### Product Management

**POST /api/v1/admin/products**
Create product (admin only).

Request:

```json
{
  "sku": "TEE-001-BLK",
  "name": "Running T-Shirt",
  "description": "...",
  "category": "APPAREL",
  "basePrice": 99900,
  "salePrice": 79900,
  "weight": 200,
  "dimensions": { "length": 75, "width": 55, "height": 5 },
  "taxable": true,
  "taxRate": 0.18,
  "isActive": true,
  "images": ["https://s3.../image1.jpg"],
  "variants": [
    {
      "sku": "TEE-001-BLK-M",
      "attributes": { "size": "M", "color": "Black" },
      "price": 79900,
      "stock": 50
    }
  ]
}
```

Response: `{ "ok": true, "data": { "product": { ... } } }`

**PATCH /api/v1/admin/products/{productId}**
Update product.

Request: (partial, only fields to update)

Response: `{ "ok": true, "data": { "product": { ... } } }`

**GET /api/v1/admin/products**
List all products (admin dashboard).

Response: `{ "ok": true, "data": { "products": [...], "total": 245 } }`

**DELETE /api/v1/admin/products/{productId}**
Soft delete product.

Response: `{ "ok": true }`

#### Inventory Management

**PATCH /api/v1/admin/inventory/variants/{variantId}**
Update variant stock.

Request:

```json
{
  "stock": 100,
  "reorderLevel": 10
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "variantId": "var_001",
    "stock": 100,
    "reserved": 5,
    "available": 95
  }
}
```

**GET /api/v1/admin/inventory/low-stock**
List low-stock variants.

Response:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "variantId": "var_001",
        "sku": "TEE-001-BLK-M",
        "stock": 8,
        "reorderLevel": 10,
        "lastStockCheckAt": "2026-04-08T10:00:00Z"
      }
    ]
  }
}
```

#### Order Management

**GET /api/v1/admin/orders**
List all orders with filters.

Request:

```json
{
  "page": 1,
  "limit": 20,
  "status": "PAYMENT_CONFIRMED",
  "dateFrom": "2026-04-01",
  "dateTo": "2026-04-08"
}
```

Response: `{ "ok": true, "data": { "orders": [...], "total": 156 } }`

**PATCH /api/v1/admin/orders/{orderId}/fulfillment-status**
Update order fulfillment status.

Request:

```json
{
  "fulfillmentStatus": "SHIPPED",
  "trackingNumber": "TRK-123456789"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "orderId": "ord_001",
    "fulfillmentStatus": "SHIPPED",
    "trackingNumber": "TRK-123456789",
    "updatedAt": "2026-04-08T14:00:00Z"
  }
}
```

**POST /api/v1/admin/orders/{orderId}/refund**
Initiate refund to payment gateway.

Request:

```json
{
  "refundAmount": 188564,
  "reason": "Customer requested"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "orderId": "ord_001",
    "paymentStatus": "REFUND_INITIATED",
    "refundAmount": 188564,
    "gatewayRefundId": "rfnd_Kxxt66cd9fxzta"
  }
}
```

---

## Request/Response Schemas

### Standard Response Wrapper

All responses follow this format:

**Success:**

```json
{
  "ok": true,
  "data": { ... entity or collection ... }
}
```

**Error:**

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... optional nested error context ... }
  }
}
```

### Common Request Headers

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Idempotency-Key: <UUID> (required for POST requests to ensure idempotency)
```

---

## Webhook Payloads

### Razorpay Payment Webhook

**Event: payment.authorized**

```json
{
  "event": "payment.authorized",
  "created_at": 1712577600,
  "payload": {
    "payment": {
      "id": "pay_Kxxt66cd9fxzta",
      "entity": "payment",
      "amount": 188564,
      "currency": "INR",
      "order_id": "order_Kxxt66cd9fxzta",
      "status": "authorized",
      "method": "card",
      "email": "raj@example.com",
      "contact": "9876543210"
    }
  }
}
```

**Event: payment.captured**

```json
{
  "event": "payment.captured",
  "created_at": 1712577601,
  "payload": {
    "payment": {
      "id": "pay_Kxxt66cd9fxzta",
      "order_id": "order_Kxxt66cd9fxzta",
      "amount": 188564,
      "status": "captured"
    }
  }
}
```

**Event: payment.failed**

```json
{
  "event": "payment.failed",
  "created_at": 1712577602,
  "payload": {
    "payment": {
      "id": "pay_Kxxt66cd9fxzta",
      "order_id": "order_Kxxt66cd9fxzta",
      "status": "failed",
      "reason_code": "insufficient_funds",
      "reason": "Insufficient funds in the account",
      "error_code": "BAD_REQUEST_ERROR"
    }
  }
}
```

**Event: refund.created**

```json
{
  "event": "refund.created",
  "created_at": 1712577603,
  "payload": {
    "refund": {
      "id": "rfnd_Kxxt66cd9fxzta",
      "payment_id": "pay_Kxxt66cd9fxzta",
      "amount": 188564,
      "status": "processed",
      "notes": {}
    }
  }
}
```

### Webhook Processing Rules

1. **Signature Verification**: All webhooks must verify Razorpay signature using HMAC-SHA256.
2. **Idempotency**: Generate idempotency key from webhook event ID and type to prevent duplicate processing.
3. **Retry Logic**: If webhook processing fails, return HTTP 5xx to trigger Razorpay retry; on success, return HTTP 200.
4. **State Transitions**: Only apply state changes if current order status allows transition for the event type.

---

## Enumerations

### OrderStatus

```typescript
type OrderStatus =
  | "CART" // Created but not submitted
  | "PENDING_PAYMENT" // Awaiting payment
  | "PAYMENT_CONFIRMED" // Payment verified, ready for fulfillment
  | "PROCESSING" // Being packed
  | "SHIPPED" // In transit
  | "DELIVERED" // Delivered to customer
  | "CANCELLED" // Order cancelled
  | "RETURNED"; // Return processed (future)
```

### PaymentStatus

```typescript
type PaymentStatus =
  | "PENDING" // Order created, no payment attempt
  | "AUTHORIZED" // Payment authorized but not captured
  | "CAPTURED" // Payment successfully captured
  | "FAILED" // Payment declined
  | "REFUND_INITIATED" // Refund requested
  | "REFUNDED"; // Refund processed
```

### FulfillmentStatus

```typescript
type FulfillmentStatus =
  | "PENDING" // Awaiting warehouse processing
  | "PROCESSING" // Being picked/packed
  | "SHIPPED" // Handed to carrier
  | "DELIVERED" // Confirmed delivered
  | "CANCELLED"; // Fulfillment cancelled
```

### PaymentGateway

```typescript
type PaymentGateway = "RAZORPAY" | "STRIPE";
```

### ProductCategory

```typescript
type ProductCategory = "APPAREL" | "FOOTWEAR" | "ACCESSORIES" | "EQUIPMENT";
```

---

## Error Codes

| Code                        | HTTP | Description                               |
| --------------------------- | ---- | ----------------------------------------- |
| INVALID_REQUEST             | 400  | Malformed request                         |
| UNAUTHORIZED                | 401  | Missing or invalid auth token             |
| FORBIDDEN                   | 403  | Insufficient permissions (not admin)      |
| NOT_FOUND                   | 404  | Resource not found                        |
| CONFLICT                    | 409  | State conflict (e.g., double add to cart) |
| INVALID_PROMO               | 400  | Promo code invalid/expired/exhausted      |
| OUT_OF_STOCK                | 400  | Insufficient inventory for request        |
| CART_EXPIRED                | 410  | Cart TTL exceeded                         |
| PAYMENT_VERIFICATION_FAILED | 400  | Payment signature invalid                 |
| PAYMENT_ALREADY_PROCESSED   | 409  | Duplicate payment attempt (idempotency)   |
| INVALID_STATE_TRANSITION    | 409  | Status transition not allowed             |
| INTERNAL_ERROR              | 500  | Server error                              |

---

## Notes for Implementation

1. **Idempotency Keys**: All POST requests must include an `Idempotency-Key` header (UUID). Server stores mapping of key → response to prevent duplicate processing.

2. **Inventory Reservation**:
   - When item added to cart, increment `quantityReserved`.
   - When checkout initiated, lock reservation until payment confirmed or timeout (e.g., 10 minutes).
   - On payment failure, release reservation.

3. **Promo Code Scope**:
   - Extend existing `PromoCode` model to support `appliesTo: "MERCHANDISE" | "BOOKING" | "ALL"`.
   - Validate promo applicability when applied to cart.

4. **Tax Calculation**:
   - Store tax rate at order creation time (snapshot).
   - Tax calculated server-side: `taxAmount = subtotal * taxRate`.
   - Must be consistent across order item creation and order summary.

5. **Payment Gateway Abstraction**:
   - Create `PaymentGatewayService` interface with methods: `createOrder()`, `verifyPayment()`, `initiateRefund()`.
   - Implement `RazorpayGatewayService` and `StripeGatewayService` as concrete implementations.
   - Switch via config/env variable.

6. **Notification Triggers**:
   - Order created: notification to user (email + socket)
   - Payment confirmed: notification to user + admin
   - Fulfillment status change: notification to user
   - Refund initiated/completed: notification to user
