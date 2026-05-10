# PhonePe Payment Gateway Integration Audit

**Date:** May 10, 2026  
**Scope:** Booking and E-commerce payment integration  
**Status:** ⚠️ PARTIALLY INTEGRATED - Multiple gaps identified

---

## Executive Summary

The PhonePe Payment Gateway Node.js SDK (v2.0.5) is **partially integrated** into the PowerMySport system. While basic payment initiation and order status checking are implemented for bookings, there are **11 significant gaps** and missing functionalities that prevent full utilization of the PhonePe SDK capabilities.

### Current Integration Level: **40-50%**

- ✅ Basic payment initiation for bookings
- ✅ Order status verification
- ✅ Callback validation
- ✅ Basic refund initiation
- ❌ Refund status checking
- ❌ Admin refund UI for PhonePe
- ❌ E-commerce orders (Shop app)
- ❌ Mobile SDK order token generation
- ❌ Advanced payment modes configuration
- ❌ Comprehensive error handling

---

## Detailed Findings

### ✅ IMPLEMENTED FEATURES

#### 1. **Class Initialization (StandardCheckoutClient)**

- **File:** [server/src/services/PhonePeService.ts](server/src/services/PhonePeService.ts#L36-L65)
- **Status:** ✅ Fully Implemented
- **Details:**
  - Credentials configured from environment variables
  - Client singleton cached for reuse
  - Supports both SANDBOX and PRODUCTION environments
  - Proper error handling for missing credentials

#### 2. **Initiate Payment (pay method)**

- **File:** [server/src/services/PhonePeService.ts](server/src/services/PhonePeService.ts#L68-L120)
- **Controller:** [server/src/controllers/bookingController.ts](server/src/controllers/bookingController.ts#L1180)
- **Status:** ✅ Fully Implemented
- **Integration Points:**
  - Endpoint: `POST /api/bookings/:bookingId/phonepe/initiate`
  - Client: [client/src/modules/booking/services/booking.ts](client/src/modules/booking/services/booking.ts#L133)
  - Payment Page: [client/src/app/payment/page.tsx](client/src/app/payment/page.tsx#L77-L90)
- **Features Implemented:**
  - Merchant order ID generation
  - Amount in paisa conversion
  - Redirect URL handling
  - Phone number prefill (basic)
  - Basic metaInfo (udf1, udf2 only)
  - Payment state tracking in database

**Gaps in Implementation:**

- Missing prefill options:
  - ❌ Email prefill
  - ❌ Customer ID
  - ❌ GSTIN (for B2B)
  - ❌ Customer first/last name
- ❌ No payment modes configuration
- ❌ No message parameter for UPI collect requests
- ❌ No expireAfter validation (hardcoded 3600 seconds)
- ❌ Limited metaInfo (only udf1, udf2 used; udf3-udf10, udf11-udf15 available)

#### 3. **Order Status Checking (getOrderStatus method)**

- **File:** [server/src/services/PhonePeService.ts](server/src/services/PhonePeService.ts#L122-L133)
- **Controller:** [server/src/controllers/bookingController.ts](server/src/controllers/bookingController.ts#L1394-L1480)
- **Status:** ✅ Mostly Implemented
- **Integration Points:**
  - Endpoint: `GET /api/bookings/phonepe/status/:merchantOrderId`
  - Client: [client/src/modules/booking/services/booking.ts](client/src/modules/booking/services/booking.ts#L149)
  - Payment Page Polling: [client/src/app/payment/page.tsx](client/src/app/payment/page.tsx#L55-L100)

**Gaps in Implementation:**

- ❌ Not using `details` parameter (defaults to false, returns only latest payment attempt)
  - Should have option to get all payment attempt details
- ❌ Not extracting metaInfo from response
- ❌ Not extracting payment method details from paymentDetails
  - Missing: transactionId, paymentMode (UPI_INTENT, UPI_COLLECT, UPI_QR, CARD, TOKEN, NET_BANKING)
  - Missing: timestamp, errorCode, detailedErrorCode
  - Missing: splitInstruments data
- ❌ Not handling the expireAfter field from response
- ❌ Insufficient logging of payment attempt details

#### 4. **Callback Validation (validateCallback method)**

- **File:** [server/src/services/PhonePeService.ts](server/src/services/PhonePeService.ts#L135-L156)
- **Controller:** [server/src/controllers/bookingController.ts](server/src/controllers/bookingController.ts#L1315-L1388)
- **Status:** ✅ Implemented
- **Integration Points:**
  - Endpoint: `POST /api/bookings/phonepe/callback` (no auth required)
  - Requires: Authorization header + raw body
  - Updates transaction state and payment status

**Gaps in Implementation:**

- ⚠️ Webhook handling is **IGNORED per user request**
- ❌ No rate limiting on callback endpoint
- ❌ No callback retry logic
- ❌ No signature validation logging for audit trail

#### 5. **Refund Initiation (refund method)**

- **File:** [server/src/services/PhonePeService.ts](server/src/services/PhonePeService.ts#L158-L200)
- **Status:** ⚠️ **INCOMPLETE - Missing refund status checking**
- **Current Implementation:**
  - Merchant refund ID generation
  - Amount validation (in paisa)
  - Refund request building
  - Basic response handling

**Critical Gaps:**

- ❌ **No `getRefundStatus()` implementation** - Cannot verify refund status after initiation
  - Required parameters: refundId, merchantRefundId
  - Should return: state (PENDING/COMPLETED/FAILED), amount, paymentDetails
- ❌ Not handling refund state transitions
- ❌ No polling mechanism for refund verification
- ❌ No admin endpoint to check refund status
- ❌ No user-facing refund status UI

---

### ❌ NOT IMPLEMENTED FEATURES

#### 1. **Create SDK Order (createSdkOrder method)**

- **Status:** ❌ NOT IMPLEMENTED
- **Why Needed:** For mobile app integration (if planned)
- **What's Missing:**
  ```typescript
  - createSdkOrder() service method
  - Token generation for mobile apps
  - DisablePaymentRetry flag support
  - Endpoint: POST /api/orders/phonepe/create-token
  - Order token response handling
  ```
- **Impact:** Cannot integrate with mobile SDKs (Android, iOS, React Native)
- **PhonePe Docs:** https://developer.phonepe.com/payment-gateway/backend-sdk/nodejs-be-sdk/api-reference-node-js/create-sdk-order

#### 2. **Refund Status Verification (getRefundStatus method)**

- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** 🔴 HIGH - Blocking refund workflows
- **What's Missing:**
  ```typescript
  export const getPhonePeRefundStatus = async (
    refundId: string,
  ): Promise<PhonePeRefundStatusResult> => {
    const client = getPhonePeClient();
    const response = await client.getRefundStatus(refundId);
    return {
      merchantId: response.merchantId,
      merchantRefundId: response.merchantRefundId,
      state: response.state,
      amount: response.amount,
      paymentDetails: response.paymentDetails,
      raw: response,
    };
  };
  ```
- **Endpoint Needed:** `GET /api/bookings/phonepe/refund-status/:refundId`
- **Admin UI Needed:** Refund status tracking dashboard
- **PhonePe Docs:** https://developer.phonepe.com/payment-gateway/backend-sdk/nodejs-be-sdk/api-reference-node-js/refund

#### 3. **E-commerce (Shop App) Integration**

- **Status:** ❌ NOT IMPLEMENTED
- **Current State:** Uses Razorpay only
- **Files Affected:**
  - [server/src/controllers/EcommerceController.ts](server/src/controllers/EcommerceController.ts#L33) - Hardcoded RAZORPAY
  - [server/src/services/PaymentService.ts](server/src/services/PaymentService.ts#L31-L470) - Only Razorpay service
  - [server/docs/ECOMMERCE_API_CONTRACT.md](server/docs/ECOMMERCE_API_CONTRACT.md#L116-L118) - Documents payment gateway abstraction
- **What's Missing:**
  - PhonePe payment gateway adapter in PaymentService
  - Order creation with PhonePe
  - Order verification with PhonePe
  - Refund processing through PhonePe
  - Admin UI for PhonePe orders
- **Impact:** E-commerce orders cannot use PhonePe despite system supporting it in types

#### 4. **Admin Refund UI for PhonePe**

- **Status:** ❌ NOT IMPLEMENTED
- **Current State:** Generic booking refund UI exists
- **Files:**
  - [admin/src/app/admin/bookings/page.tsx](admin/src/app/admin/bookings/page.tsx#L538-L556) - Has `processRefund` but uses generic API
  - [admin/src/modules/admin/services/admin.ts](admin/src/modules/admin/services/admin.ts#L538-L556)
- **What's Missing:**
  - PhonePe-specific refund UI
  - Refund status checking UI
  - Refund amount validation against PhonePe limits
  - Merchant refund ID generation UI
  - Refund history display
  - Payment method details display (to show which UPI/card was refunded)

#### 5. **Advanced Payment Modes Configuration**

- **Status:** ❌ NOT IMPLEMENTED
- **What's Missing:**

  ```typescript
  interface PaymentMode {
    instrument: 'UPI' | 'CARD' | 'NET_BANKING';
    method: 'UPI_INTENT' | 'UPI_COLLECT' | 'UPI_QR' | 'CARD' | 'NET_BANKING' | 'TOKEN';
  }

  // PayRequest should support:
  .paymentModes([
    { instrument: 'UPI', method: 'UPI_INTENT' },
    { instrument: 'UPI', method: 'UPI_COLLECT' },
    { instrument: 'CARD', method: 'CARD' }
  ])
  ```

- **Impact:** Cannot restrict payment methods, all methods shown to users
- **Use Cases:**
  - Disable UPI for high-value transactions
  - Force card-only for international transactions
  - Prefer specific payment method based on user region

#### 6. **Payment Instrument Details Extraction**

- **Status:** ❌ NOT IMPLEMENTED
- **What's Missing:**
  - Extract from order status response:
    - `paymentMode`: UPI_INTENT, UPI_COLLECT, UPI_QR, CARD, TOKEN, NET_BANKING
    - `transactionId`: PhonePe transaction ID
    - `errorCode` and `detailedErrorCode`: For failed payments
    - `splitInstruments`: For split payments
- **Impact:** Cannot display which payment method user actually used
- **Use Case:** Refund tracking, payment analytics, user payment history

#### 7. **Prefill User Details - Extended**

- **Status:** ⚠️ PARTIALLY IMPLEMENTED
- **Currently Implemented:**
  - ✅ Phone number
- **Missing:**
  - ❌ Email address prefill
  - ❌ Customer/User ID
  - ❌ GSTIN (for B2B payments)
  - ❌ First name
  - ❌ Last name
  - ❌ Business name
- **Impact:** Better UX, especially for returning customers
- **PhonePe Doc:** PrefillUserLoginDetails has more fields available

#### 8. **Comprehensive Error Handling**

- **Status:** ❌ NOT IMPLEMENTED
- **What's Missing:**
  - PhonePe error code mapping:
    - INVALID_MERCHANT_ID
    - INVALID_MERCHANT_KEY
    - INVALID_REDIRECT_URL
    - INVALID_AMOUNT
    - PAYMENT_ALREADY_COMPLETED
    - ORDER_NOT_FOUND
    - REFUND_AMOUNT_EXCEEDS_ORIGINAL
    - REFUND_ALREADY_PROCESSED
    - SUBSCRIPTION_NOT_FOUND
    - etc.
  - User-friendly error messages
  - Error logging and monitoring
  - Retry logic for transient errors
- **Current:** Generic error messages returned

#### 9. **Payment Expiry Handling**

- **Status:** ⚠️ INCOMPLETE
- **Current:** Hardcoded 3600 seconds (1 hour)
- **Missing:**
  - Configurable expiry time per order
  - Expiry time validation
  - Expired order cleanup
  - User warning before expiry
  - Expired payment retry logic
- **PhonePe Doc:** `expireAfter` parameter and `expire_at` response field

#### 10. **MetaInfo (UDF) Full Utilization**

- **Status:** ⚠️ UNDERUTILIZED
- **Currently Used:**
  - udf1: bookingId
  - udf2: userId
- **Available (udf3-udf10):**
  - udf3: Sport type
  - udf4: Venue/Coach ID
  - udf5: Number of participants
  - udf6: Booking type (SINGLE/GROUP)
  - udf7: Payment type (FULL/SPLIT)
  - udf8: Reserved
  - udf9: Reserved
  - udf10: Reserved
- **Available (udf11-udf15, alphanumeric only):**
  - udf11-udf15: Can store custom metadata
- **Impact:** Limited tracking, analytics capability

#### 11. **Disable Payment Retry Flag**

- **Status:** ❌ NOT IMPLEMENTED
- **What's Missing:**
  - `disablePaymentRetry` parameter in CreateSdkOrderRequest
  - Logic to disable retries for sensitive transactions
  - Admin configuration for retry behavior
- **Use Cases:**
  - Avoid double-charging for large amounts
  - Require manual verification before retry
  - Single-attempt payments for specific scenarios

---

## Integration Points Summary

### Server (Backend)

| Feature             | File                   | Implemented | Status                |
| ------------------- | ---------------------- | ----------- | --------------------- |
| SDK Installation    | package.json           | ✅          | v2.0.5 installed      |
| Class Init          | PhonePeService.ts#L36  | ✅          | Singleton pattern     |
| Pay Method          | PhonePeService.ts#L108 | ✅          | Full implementation   |
| Order Status        | PhonePeService.ts#L122 | ⚠️          | Missing details param |
| Refund Init         | PhonePeService.ts#L186 | ⚠️          | No status check       |
| Refund Status       | PhonePeService.ts      | ❌          | Not implemented       |
| Callback Validation | PhonePeService.ts#L135 | ✅          | Implemented           |
| SDK Order           | PhonePeService.ts      | ❌          | Not implemented       |
| Payment Config      | Controllers            | ❌          | Not implemented       |

### Client (Frontend)

| Feature              | File                    | Implemented | Status                     |
| -------------------- | ----------------------- | ----------- | -------------------------- |
| PhonePe Payment Init | booking.ts#L133         | ✅          | API integration            |
| Order Status Check   | booking.ts#L149         | ✅          | Polling implemented        |
| Payment Page         | payment/page.tsx        | ✅          | Status UI                  |
| Admin Refund UI      | admin/bookings/page.tsx | ⚠️          | Generic only               |
| Refund Status UI     | Admin                   | ❌          | Not implemented            |
| Payment History      | Client                  | ❌          | Not showing payment method |

### Admin Panel

| Feature             | File                   | Implemented | Status          |
| ------------------- | ---------------------- | ----------- | --------------- |
| Process Refund      | bookings/page.tsx#L122 | ⚠️          | Generic handler |
| Refund Status       | Admin                  | ❌          | Not implemented |
| Payment Details     | Admin                  | ❌          | Not shown       |
| PhonePe-specific UI | Admin                  | ❌          | Missing         |

---

## Database & Data Model

### Current Tracking

**BookingPaymentTransaction Model** ([server/src/models/BookingPayment.ts](server/src/models/BookingPayment.ts))

✅ Fields tracked:

- `merchantOrderId`: Merchant order ID
- `phonepeOrderId`: PhonePe order ID
- `state`: Current order state
- `status`: Transaction status
- `redirectUrl`: Payment page URL
- `callbackPayload`: Callback data
- `lastStatusPayload`: Last status response

❌ Missing fields:

- `refundId`: PhonePe refund ID (if refunded)
- `refundStatus`: Refund state
- `paymentMethod`: Payment method used (UPI_INTENT, CARD, etc.)
- `transactionId`: PhonePe transaction ID
- `errorCode`: Error code for failures
- `detailedErrorCode`: Detailed error code
- `splitInstruments`: Split payment details
- `paidAt`: Actual payment timestamp
- `expireAt`: Order expiry epoch time

### Schema Recommendations

```typescript
interface BookingPaymentTransaction {
  // ... existing fields

  // Refund tracking
  refundId?: string;
  merchantRefundId?: string;
  refundStatus?: "PENDING" | "COMPLETED" | "FAILED";
  refundAmount?: number;
  refundInitiatedAt?: Date;
  refundCompletedAt?: Date;

  // Payment method tracking
  paymentMode?:
    | "UPI_INTENT"
    | "UPI_COLLECT"
    | "UPI_QR"
    | "CARD"
    | "TOKEN"
    | "NET_BANKING";
  transactionId?: string;

  // Error tracking
  errorCode?: string;
  detailedErrorCode?: string;

  // Metadata
  expireAt?: number; // epoch
  paidAt?: Date;
  metaInfo?: {
    udf1?: string;
    udf2?: string;
    udf3?: string;
    // ... more UDFs
  };
}
```

---

## Environment Variables

### Current (.env)

```
PHONEPE_CLIENT_ID=M23I3VZQ44COM_2605082109
PHONEPE_CLIENT_SECRET=NTBlYWE0NmItZWM4OS00YmU2LThjYzgtNmY5ZGQzY2Q0NGQ2
PHONEPE_CLIENT_VERSION=1
PHONEPE_ENV=SANDBOX
PHONEPE_REDIRECT_URL_BASE=http://localhost:3000
PHONEPE_CALLBACK_URL=http://localhost:5000/api/bookings/phonepe/callback
PHONEPE_CALLBACK_USERNAME=Powermysport
PHONEPE_CALLBACK_PASSWORD=PowerMySport2026
```

### Recommended Additions

```
# Payment modes
PHONEPE_PAYMENT_MODES=UPI_INTENT,UPI_COLLECT,CARD,NET_BANKING

# Refund settings
PHONEPE_AUTO_REFUND_DELAY_HOURS=24
PHONEPE_MAX_REFUND_PERCENT=100

# Payment configuration
PHONEPE_DEFAULT_PAYMENT_TIMEOUT=3600
PHONEPE_ENABLE_PAYMENT_RETRY=true

# Admin settings
PHONEPE_ADMIN_NOTIFICATIONS=true
```

---

## Critical Issues Priority Matrix

| Issue                      | Severity  | Impact                  | Effort  | Priority |
| -------------------------- | --------- | ----------------------- | ------- | -------- |
| No Refund Status Check     | 🔴 HIGH   | Cannot verify refunds   | 1-2 hrs | P0       |
| Admin Refund UI Missing    | 🔴 HIGH   | No refund management    | 2-3 hrs | P0       |
| E-commerce No PhonePe      | 🟠 MEDIUM | Limited payment options | 4-6 hrs | P1       |
| Limited MetaInfo           | 🟠 MEDIUM | Poor tracking           | 1 hr    | P1       |
| No Error Code Mapping      | 🟠 MEDIUM | Poor UX                 | 2 hrs   | P1       |
| Payment Method Not Tracked | 🟠 MEDIUM | Analytics gap           | 1 hr    | P1       |
| No SDK Order (Mobile)      | 🟡 LOW    | Future mobile support   | 3-4 hrs | P2       |
| Payment Modes Config       | 🟡 LOW    | Limited flexibility     | 2-3 hrs | P2       |
| Extended Prefill           | 🟡 LOW    | Minor UX improvement    | 1 hr    | P2       |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)

1. **Implement Refund Status Checking**
   - Add `getPhonePeRefundStatus()` service method
   - Create `/api/bookings/phonepe/refund-status/:refundId` endpoint
   - Update database schema for refund tracking
   - Test refund status polling

2. **Add Admin Refund UI**
   - Create PhonePe-specific refund modal
   - Display refund status in real-time
   - Add refund history tracking
   - Implement refund retry logic

### Phase 2: Data Enhancement (Week 2)

3. **Enhanced Order Status Extraction**
   - Use `details: true` parameter for full payment history
   - Extract and store payment method
   - Store transaction IDs and error codes
   - Add payment attempt history UI

4. **Complete MetaInfo Utilization**
   - Expand UDF fields to capture sport, venue, participants
   - Update order status to return metaInfo
   - Use metaInfo in analytics

### Phase 3: Extended Features (Week 3)

5. **E-commerce Integration**
   - Create PhonePe payment adapter
   - Implement order creation endpoint
   - Add shop payment page
   - Integrate with admin dashboard

6. **Error Handling & Configuration**
   - Map PhonePe error codes to user messages
   - Add payment modes configuration
   - Implement transaction logging
   - Add monitoring/alerts

### Phase 4: Future (Week 4+)

7. **Mobile SDK Support**
   - Implement `createSdkOrder()`
   - Generate payment tokens
   - Document mobile integration

8. **Advanced Features**
   - Payment retry logic
   - Subscription/autopay support
   - Payment links generation
   - Advanced analytics

---

## Testing Checklist

### Booking Payments

- [ ] Basic payment flow works
- [ ] Order status polling works
- [ ] Callback validation works
- [ ] Payment marked as completed
- [ ] Refund initiation works
- [ ] Refund status can be checked
- [ ] Partial refunds work

### Admin Functions

- [ ] View payment transactions
- [ ] Initiate refund from admin
- [ ] Check refund status from admin
- [ ] See payment method used
- [ ] See error details for failed payments

### E-commerce (if integrated)

- [ ] Shop orders use PhonePe
- [ ] Order payment works
- [ ] Refund works for orders
- [ ] Admin can manage order refunds

### Error Handling

- [ ] Invalid merchant ID error
- [ ] Invalid amount error
- [ ] Payment already completed
- [ ] Refund exceeds amount
- [ ] Order expired
- [ ] Network timeout handling

---

## References

- PhonePe Node.js SDK Docs: https://developer.phonepe.com/payment-gateway/backend-sdk/nodejs-be-sdk/api-reference-node-js/installation
- SDK Version: 2.0.5 (@phonepe-pg/pg-sdk-node)
- Current Implementation: Bookings module only
- System Architecture: Node.js backend, React client, Next.js admin

---

## Conclusion

The PhonePe integration is **partially functional** for booking payments but lacks critical production features like refund status checking and admin management UI. The most urgent fixes are:

1. **Refund status verification** (blocking feature)
2. **Admin refund UI** (operational necessity)
3. **E-commerce integration** (revenue impact)
4. **Enhanced error handling** (user experience)

Estimated effort to reach **80% integration**: 12-15 hours  
Estimated effort to reach **100% integration**: 18-20 hours

**Not included in this audit (per user request):** Webhook configuration and advanced webhook handling patterns.
