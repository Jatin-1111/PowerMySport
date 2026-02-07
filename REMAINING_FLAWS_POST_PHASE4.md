# PowerMySport - Remaining Conceptual & Logical Flaws (Post Phase 1-4)

**Analysis Date:** February 8, 2026  
**Completed Phases:** 1, 2, 3, 4  
**Status:** New features implemented but missing integration

---

## 🔴 CRITICAL INTEGRATION GAPS

### 1. **Promo Codes Not Integrated into Booking Flow** ⚠️ SEVERITY: HIGH

**Issue:**

- PromoCodeService exists with full validation logic
- BookingService.initiateBooking() doesn't accept or apply promo codes
- No discount field in Booking model
- Payment calculation ignores discounts completely

**Current Flow:**

```typescript
// BookingService.ts - Line 130
const venuePrice = hours * venue.pricePerHour;
const coachPrice = hours * coach.hourlyRate;
const totalAmount = venuePrice + coachPrice; // NO DISCOUNT APPLIED
```

**Missing:**

```typescript
interface InitiateBookingPayload {
  // ... existing fields
  promoCode?: string; // MISSING!
}

// Should validate and apply:
const discount = await validatePromoCode(
  promoCode,
  userId,
  totalAmount,
  !!coachId,
);
const finalAmount = totalAmount - discount.discountAmount;
```

**Impact:**

- Promo codes created by admin are unusable
- Users can't apply discounts
- PromoCode usage tracking never increments

---

### 2. **Cancellation Has No Refund Logic** ⚠️ SEVERITY: CRITICAL

**Issue:**

```typescript
// BookingService.ts - Line 416
export const cancelBooking = async (bookingId: string) => {
  return Booking.findByIdAndUpdate(
    bookingId,
    { status: "CANCELLED" },
    { new: true },
  );
};
```

**Problems:**

- ❌ No time window check (24-hour policy mentioned in docs but not enforced)
- ❌ No refund processing
- ❌ No cancellation fee calculation
- ❌ No notification to venue/coach
- ❌ Anyone can cancel any booking (no user verification)
- ❌ Can cancel COMPLETED bookings

**Expected Logic:**

```typescript
// Check if user owns the booking
if (booking.userId.toString() !== userId) throw new Error("Unauthorized");

// Check booking status
if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
  throw new Error("Cannot cancel completed/in-progress bookings");
}

// Calculate refund based on time to booking
const hoursUntilBooking =
  (booking.date.getTime() - Date.now()) / (1000 * 60 * 60);

if (hoursUntilBooking > 24) {
  // Full refund
  refundAmount = booking.totalAmount;
} else if (hoursUntilBooking > 2) {
  // 50% refund
  refundAmount = booking.totalAmount * 0.5;
} else {
  // No refund
  refundAmount = 0;
}
```

---

### 3. **Review System Allows NO_SHOW Reviews** ⚠️ SEVERITY: MEDIUM

**Issue:**

```typescript
// ReviewService.ts - Line 29
if (booking.status !== "COMPLETED") {
  throw new Error("Can only review completed bookings");
}
```

**Problem:**
NO_SHOW bookings are counted as revenue in analytics, but users didn't actually experience the service. Allowing reviews for NO_SHOW is illogical.

**Fix:**

```typescript
if (booking.status !== "COMPLETED") {
  throw new Error("Can only review completed bookings");
}

// Also prevent reviewing your own NO_SHOW
if (booking.status === "NO_SHOW") {
  throw new Error("Cannot review bookings you didn't attend");
}
```

---

### 4. **Analytics Count NO_SHOW as Confirmed Revenue** ⚠️ SEVERITY: MEDIUM

**Issue:**

```typescript
// AnalyticsService.ts
const paidBookings = [...completedBookings, ...noShowBookings];
```

**Problems:**

- NO_SHOW means player didn't show up
- Payment might not have been processed yet (could still be PENDING_PAYMENT)
- Counting as revenue is misleading

**Reality Check:**

```
Player books → Pays → Doesn't show up (NO_SHOW)
  - Should venue get paid? YES (cancellation fee)
  - But did service get delivered? NO
  - Is this "earned revenue"? Debatable

Better: Track separately as "Cancellation Fees" not "Service Revenue"
```

**Fix:**

```typescript
// Only COMPLETED bookings
completedRevenue: // Only NO_SHOW bookings
cancellationFees: totalRevenue: completedRevenue + cancellationFees;
```

---

### 5. **Complete/No-Show Authorization Missing** ⚠️ SEVERITY: HIGH

**Issue:**

```typescript
// BookingService.ts - Line 466
export const completeBooking = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId);
  // ... NO USER/ROLE VERIFICATION
  booking.status = "COMPLETED";
};
```

**Problems:**

- Anyone with bookingId can mark as COMPLETED
- Anyone can mark as NO_SHOW
- No verification that caller is:
  - Venue owner, OR
  - Admin

**Expected:**

```typescript
export const completeBooking = async (
  bookingId: string,
  userId: string,
  userRole: string,
) => {
  const booking = await Booking.findById(bookingId).populate("venueId");

  // Verify authorization
  const isVenueOwner = booking.venueId.ownerId.toString() === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isVenueOwner && !isAdmin) {
    throw new Error("Only venue owner or admin can complete bookings");
  }

  // ... rest of logic
};
```

---

### 6. **Check-in Has No Identity Verification** ⚠️ SEVERITY: MEDIUM-HIGH

**Issue:**

```typescript
// BookingService.ts - Line 428
export const checkInBooking = async (verificationToken: string) => {
  // Anyone with QR code can check-in
  // No verification of WHO is checking in
};
```

**Security Flaw:**

- QR code is shared with all parties (player, venue, coach)
- Anyone can scan and check-in
- Malicious actor could check-in early

**Expected:**

```typescript
export const checkInBooking = async (
  verificationToken: string,
  userId: string, // Who's scanning?
) => {
  const booking = await Booking.findOne({ verificationToken }).populate(
    "userId coachId venueId",
  );

  // Verify scanner is authorized
  const isPlayer = booking.userId._id.toString() === userId;
  const isVenueStaff = booking.venueId.ownerId.toString() === userId;
  const isCoach = booking.coachId?._id.toString() === userId;

  if (!isPlayer && !isVenueStaff && !isCoach) {
    throw new Error("You are not authorized to check-in to this booking");
  }

  // ... proceed
};
```

---

### 7. **Payment Links Never Updated with Booking ID** ⚠️ SEVERITY: LOW

**Issue:**

```typescript
// BookingService.ts - Line 181
paymentLink: generateMockPaymentLink(
  payment.userId,
  payment.amount,
  "temp-booking-id", // ❌ Still says "temp"
),
```

**Problem:**
After booking is created, payment links still reference "temp-booking-id" instead of actual `booking._id`

**Fix:**

```typescript
const booking = new Booking({ ... });
await booking.save();

// Update payment links with real booking ID
paymentLinks.forEach((link) => {
  link.paymentLink = generateMockPaymentLink(
    link.userId,
    link.amount,
    booking._id.toString(), // ✓ Actual ID
  );
});
```

---

## 📋 MISSING FEATURES (NOT IMPLEMENTED)

### 8. **No Notification System** ⚠️ SEVERITY: HIGH

**Missing Notifications:**

- Booking confirmed → Notify venue owner + coach
- Payment received → Notify all parties
- Booking cancelled → Notify venue + coach
- Review posted → Notify venue owner/coach
- Booking about to start (1 hour before) → Remind player
- NO_SHOW marked → Notify player

**Current State:**

- Zero emails sent
- Zero push notifications
- Users have no visibility into booking status changes

---

### 9. **No Time Zone Handling** ⚠️ SEVERITY: MEDIUM

**Issue:**

```typescript
startTime: "14:00"; // What timezone?
date: new Date(); // Server timezone? User timezone?
```

**Problems:**

- User in different timezone books venue
- Booking time ambiguous
- Check-in window calculated incorrectly

**Solution:**

- Store venue timezone in Venue model
- All times stored in UTC
- Convert to venue local time for display

---

### 10. **Booking Model Missing Fields** ⚠️ SEVERITY: MEDIUM

**Missing:**

```typescript
interface BookingDocument {
  // ... existing
  promoCodeUsed?: string; // Which promo was applied
  discountAmount?: number; // How much discount
  originalAmount: number; // Before discount
  cancellationFee?: number; // If cancelled late
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  refundAmount?: number;
  refundProcessedAt?: Date;
}
```

---

### 11. **No Automated Booking State Transitions** ⚠️ SEVERITY: MEDIUM

**Issue:**
Bookings stay IN_PROGRESS forever unless manually marked COMPLETED

**Expected:**

```typescript
// Cron job: Mark bookings as COMPLETED if end time passed + 1 hour
const pastBookings = await Booking.find({
  status: "IN_PROGRESS",
  date: { $lt: new Date(Date.now() - 60 * 60 * 1000) },
});

pastBookings.forEach(async (booking) => {
  const endDateTime = parseEndTime(booking.date, booking.endTime);
  if (Date.now() > endDateTime.getTime() + 60 * 60 * 1000) {
    booking.status = "COMPLETED";
    await booking.save();
  }
});
```

---

### 12. **Split Payment Creates UX Confusion** ⚠️ SEVERITY: MEDIUM

**Already Documented Issue (From FLAWS.md):**

- Player pays venue ✓
- Coach hasn't paid yet
- Booking shows PENDING_PAYMENT
- Player thinks "I paid, why pending?"

**Partial Solution in Phase 2:**

- Documented escrow model for future
- But current implementation still has this UX issue

**Recommendation:**
Implement single payment upfront (player pays full amount to platform) instead of split payments at booking time.

---

### 13. **Coach Verification Documents Not Used** ⚠️ SEVERITY: LOW

**Issue:**

- Coach.verificationDocuments field exists
- Coach.isVerified field exists
- ❌ No workflow to verify coaches
- ❌ No admin UI to review documents
- ❌ No restriction on unverified coaches

**Expected:**

```typescript
// When booking coach
if (!coach.isVerified) {
  throw new Error("This coach has not been verified yet");
}

// Or: Show warning to user but allow booking
```

---

## 🎯 PRIORITY FIXES

### P0 (MUST FIX BEFORE BETA):

1. ✅ Add userId param to cancelBooking, complete, no-show (authorization)
2. ✅ Implement cancellation refund logic
3. ✅ Integrate promo codes into booking flow
4. ✅ Add Booking model fields for discounts/refunds

### P1 (BEFORE PRODUCTION):

5. ✅ Add notification system
6. ✅ Fix NO_SHOW review logic
7. ✅ Add identity verification to check-in
8. ✅ Separate revenue analytics (completed vs cancellation fees)

### P2 (NICE TO HAVE):

9. ✅ Automated booking state transitions (cron)
10. ✅ Timezone handling
11. ✅ Coach verification workflow

---

## 📊 SUMMARY

**Total New Issues Found:** 13  
**Integration Gaps:** 7  
**Missing Features:** 6

**Risk Level:**

- 🔴 Critical: 3 issues (Cancellation refunds, Authorization, Promo integration)
- 🟠 High: 3 issues (Notifications, Analytics accuracy, NO_SHOW reviews)
- 🟡 Medium: 5 issues
- 🟢 Low: 2 issues

**Next Steps:**
Implement P0 fixes before allowing real users. Current system works for demos but has critical gaps for production use.
