/**
 * ============================================================================
 * Mongo -> Postgres ETL   (run: `npm run etl:from-mongo`)
 * ============================================================================
 * One-off migration of production data from the MongoDB database into the new
 * PostgreSQL schema. Strategy:
 *
 *  1. Preserve identity. Every Mongo `_id` (24-char ObjectId hex) is written
 *     verbatim as the Postgres row `id` (our PKs are String). This keeps every
 *     cross-collection reference (userId, coachId, bookingId, …) valid without
 *     any id remapping table.
 *  2. Dependency order. Parents are inserted before the rows that reference
 *     them where a real FK exists (normalized child tables). Document-to-
 *     document references are plain String columns (no FK), matching Mongo, so
 *     their ordering does not matter.
 *  3. Normalize embedded arrays/maps into their child tables (see the
 *     User/Coach/Venue/Booking migrators below — these are the template for the
 *     remaining collections).
 *  4. Idempotent-ish. Uses createMany({ skipDuplicates:true }) so a re-run does
 *     not crash on already-migrated rows. Run against an EMPTY target for a
 *     clean load; use `--truncate` to wipe the target first.
 *
 * Environment: MONGODB_URI (source) + DATABASE_URL (target).
 *
 * COVERAGE: the collections wired into `RUN_ORDER` below are fully implemented
 * as the canonical pattern. Remaining collections are listed in
 * prisma/migrate-from-mongo/COVERAGE.md with the exact field mapping; each is a
 * mechanical repeat of one of the templates here.
 * ============================================================================
 */
import { MongoClient, Db, ObjectId } from "mongodb";
import prisma from "../../src/lib/prisma";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is required for the ETL");

const oid = (v: any): string | null => (v ? String(v) : null);
const date = (v: any): Date | null => (v ? new Date(v) : null);
const num = (v: any, d: number | null = null) =>
  typeof v === "number" ? v : d;
const geo = (loc: any): { lng: number | null; lat: number | null } => {
  const c = loc?.coordinates;
  return Array.isArray(c) && c.length === 2
    ? { lng: c[0], lat: c[1] }
    : { lng: null, lat: null };
};

/**
 * Normalize Coach.serviceMode to a ServiceMode enum member, preserving the
 * original value verbatim. The enum includes the legacy "OFFLINE" value, so all
 * four known values pass through unchanged (whitespace→underscore + upper-cased
 * to match member spelling). A genuinely unknown value would violate the enum,
 * so it's logged and falls back to FREELANCE rather than crashing the load.
 */
const KNOWN_SERVICE_MODES = new Set([
  "OWN_VENUE",
  "FREELANCE",
  "HYBRID",
  "OFFLINE",
]);
const svcMode = (v: any): "OWN_VENUE" | "FREELANCE" | "HYBRID" | "OFFLINE" => {
  const s = typeof v === "string" ? v.toUpperCase().replace(/\s+/g, "_") : "";
  if (KNOWN_SERVICE_MODES.has(s)) return s as any;
  console.warn(
    `  ⚠️ unrecognized coach.serviceMode=${JSON.stringify(v)} (not an enum member) → FREELANCE`,
  );
  return "FREELANCE";
};

/**
 * Normalize booking payment-leg userType. Mongo data stores uppercase values
 * ("COACH"/"PLAYER"/"VENUE_LISTER"); the Prisma PaymentUserType enum is
 * mixed-case (VenueLister | Coach | Player). Map case-insensitively.
 */
const payUserType = (v: any): "VenueLister" | "Coach" | "Player" => {
  const s = typeof v === "string" ? v.toUpperCase().replace(/[_\s]/g, "") : "";
  if (s === "COACH") return "Coach";
  if (s === "VENUELISTER") return "VenueLister";
  if (s === "PLAYER") return "Player";
  console.warn(
    `  ⚠️ unknown booking payment userType=${JSON.stringify(v)} → Player`,
  );
  return "Player";
};

/**
 * Normalize Review.targetType casing to the ReviewTargetType enum
 * (VENUE | Coach | PRODUCT). Mongo stores "COACH"/"VENUE"/"PRODUCT"; these are
 * the same semantic values, just cased differently — map, don't coerce.
 */
const reviewTargetType = (v: any): "VENUE" | "Coach" | "PRODUCT" => {
  const s = typeof v === "string" ? v.toUpperCase() : "";
  if (s === "COACH") return "Coach";
  if (s === "VENUE") return "VENUE";
  if (s === "PRODUCT") return "PRODUCT";
  console.warn(`  ⚠️ unknown review targetType=${JSON.stringify(v)} → VENUE`);
  return "VENUE";
};

/**
 * Generic enum normalizer factory. Uppercases + whitespace→underscore on the
 * source, matches an enum member case-INSENSITIVELY, and returns the EXACT
 * member spelling (so "admin" → "Admin", "monthly" → "monthly"). Blank/unknown
 * → `fallback` (may be null for nullable enum columns); unknown values warn.
 */
function makeEnum<T extends string>(
  field: string,
  members: readonly T[],
  fallback: T,
): (v: any) => T;
function makeEnum<T extends string>(
  field: string,
  members: readonly T[],
  fallback: null,
): (v: any) => T | null;
function makeEnum<T extends string>(
  field: string,
  members: readonly T[],
  fallback: T | null,
): (v: any) => T | null {
  const byUpper = new Map(members.map((m) => [m.toUpperCase(), m]));
  return (v: any): T | null => {
    const raw =
      typeof v === "string" ? v.trim().toUpperCase().replace(/\s+/g, "_") : "";
    if (!raw) return fallback;
    const hit = byUpper.get(raw);
    if (hit) return hit;
    console.warn(`  ⚠️ unknown ${field}=${JSON.stringify(v)} → ${fallback}`);
    return fallback;
  };
}

// -- Batch: bookings / notifications ----------------------------------------
const slotResourceType = makeEnum("bookingSlotLock.resourceType", ["VENUE_SLOT", "COACH_SLOT"] as const, "VENUE_SLOT");
const waitlistStatus = makeEnum("bookingWaitlist.status", ["ACTIVE", "NOTIFIED", "CANCELLED"] as const, "ACTIVE");
const invitationStatus = makeEnum("bookingInvitation.status", ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"] as const, "PENDING");
const paymentTxnStatus = makeEnum("paymentTxn.status", ["PENDING", "COMPLETED", "FAILED"] as const, "PENDING");
const notificationCategory = makeEnum("notification.category", ["SOCIAL", "BOOKING", "Admin", "REVIEW", "PAYMENT", "COMMUNITY"] as const, "SOCIAL");
const scheduledType = makeEnum("scheduledNotification.type", ["BOOKING_REMINDER", "PATHWAY_DOCUMENT_REMINDER", "PLAN_CHECKIN"] as const, "BOOKING_REMINDER");
const scheduledStatus = makeEnum("scheduledNotification.status", ["PENDING", "SENT", "FAILED", "CANCELLED"] as const, "PENDING");
const friendStatus = makeEnum("friendConnection.status", ["PENDING", "ACCEPTED", "DECLINED", "BLOCKED"] as const, "PENDING");
const calendarEventType = makeEnum("userCalendarEvent.type", ["IMPORTANT", "COMPETITION", "TRAINING", "REMINDER", "OTHER"] as const, "IMPORTANT");
const disputeType = makeEnum("dispute.disputeType", ["NO_SHOW", "POOR_QUALITY", "PAYMENT_ISSUE", "OTHER"] as const, "OTHER");
const disputeStatus = makeEnum("dispute.status", ["OPEN", "RESOLVED", "CLOSED"] as const, "OPEN");
const disputeResolutionMethod = makeEnum("dispute.resolutionMethod", ["AUTO", "MANUAL"] as const, null);
const disputeRecommendedAction = makeEnum("dispute.recommendedAction", ["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND", "MANUAL_REVIEW"] as const, null);
const disputeConfidence = makeEnum("dispute.confidence", ["HIGH", "MEDIUM", "LOW"] as const, null);
const venueInquiryStatus = makeEnum("venueInquiry.status", ["PENDING", "APPROVED", "REJECTED"] as const, "PENDING");

// -- Batch: coach subscriptions / plans / promos ----------------------------
const coachSubStatus = makeEnum("coachSubscription.status", ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"] as const, "ACTIVE");
const subFrequency = makeEnum("subscriptionPackage.frequency", ["MONTHLY", "QUARTERLY", "YEARLY"] as const, "MONTHLY");
const noteType = makeEnum("coachClientNote.noteType", ["GENERAL", "SESSION", "INJURY", "GOAL", "PROGRESS"] as const, "GENERAL");
const planDuration = makeEnum("subscriptionPlan.duration", ["monthly", "quarterly", "annual"] as const, "monthly");
const promoDiscountType = makeEnum("promoCode.discountType", ["PERCENTAGE", "FIXED_AMOUNT"] as const, "PERCENTAGE");
const promoApplicableTo = makeEnum("promoCode.applicableTo", ["ALL", "VENUE_ONLY", "COACH_ONLY", "MERCHANDISE_ONLY"] as const, "ALL");

// -- Batch: players / admin / analytics / infra -----------------------------
const playerType = makeEnum("player.type", ["SELF", "DEPENDENT"] as const, "SELF");
const playerGender = makeEnum("player.gender", ["MALE", "FEMALE", "OTHER"] as const, null);
const playerObjective = makeEnum("player.primaryObjective", ["Recreational", "Fitness", "Compete"] as const, null);
const playerBudget = makeEnum("player.budgetTier", ["Budget", "Moderate", "Premium"] as const, null);
const analyticsSource = makeEnum("analyticsEvent.source", ["WEB", "MOBILE", "SERVER"] as const, "WEB");
const adminRole = makeEnum("admin.role", ["SUPPORT_ADMIN", "OPERATIONS_ADMIN", "FINANCE_ADMIN", "ANALYTICS_ADMIN", "SYSTEM_ADMIN"] as const, "SUPPORT_ADMIN");
const outboxStatus = makeEnum("outboxMessage.status", ["PENDING", "PROCESSING", "DONE", "FAILED"] as const, "PENDING");
const rateLimitType = makeEnum("rateLimit.type", ["EMAIL_VERIFICATION", "LOGIN", "API"] as const, "API");

// -- Batch: experts / guidance / roadmap / concierge ------------------------
const expertSessionMode = makeEnum("expert.sessionMode", ["ONLINE", "IN_PERSON", "BOTH"] as const, "ONLINE");
const expertVerificationStatus = makeEnum("expert.verificationStatus", ["UNVERIFIED", "PENDING", "APPROVED", "REJECTED"] as const, "UNVERIFIED");
const expertSessionStatus = makeEnum("expertSession.status", ["PENDING_PAYMENT", "PAID", "SCHEDULED", "COMPLETED", "CANCELLED"] as const, "PENDING_PAYMENT");
const expertBookingMode = makeEnum("expertSession.mode", ["ONLINE", "IN_PERSON"] as const, null);
const expertCanceller = makeEnum("expertSession.cancelledBy", ["CLIENT", "EXPERT", "ADMIN", "SYSTEM"] as const, null);
const expertRefundStatus = makeEnum("expertSession.refundStatus", ["NONE", "REQUIRED", "MANUAL_DONE"] as const, "NONE");
const expertAcceptance = makeEnum("expertSession.expertAcceptance", ["PENDING", "ACCEPTED", "DECLINED"] as const, "PENDING");
const expertPayoutStatus = makeEnum("expertSession.payoutStatus", ["PENDING", "PAID"] as const, "PENDING");
const chatRole = makeEnum("chatMessage.role", ["user", "assistant"] as const, "user");

// -- Batch: community -------------------------------------------------------
const messagePrivacy = makeEnum("communityProfile.messagePrivacy", ["EVERYONE", "REQUEST_ONLY", "NONE"] as const, "EVERYONE");
const groupMemberAddPolicy = makeEnum("communityGroup.memberAddPolicy", ["ADMIN_ONLY", "ANY_MEMBER"] as const, "ADMIN_ONLY");
const groupAudience = makeEnum("communityGroup.audience", ["ALL", "PLAYERS_ONLY", "COACHES_ONLY"] as const, "ALL");
const conversationType = makeEnum("communityConversation.conversationType", ["DM", "GROUP"] as const, "DM");
const conversationStatus = makeEnum("communityConversation.status", ["PENDING", "ACTIVE"] as const, "ACTIVE");
const communityMessageType = makeEnum("communityMessage.type", ["TEXT", "IMAGE"] as const, "TEXT");
const communityPostStatus = makeEnum("communityPost.status", ["OPEN", "CLOSED"] as const, "OPEN");
const communityVoteTargetType = makeEnum("communityVote.targetType", ["POST", "ANSWER"] as const, "POST");
const communityReportTargetType = makeEnum("communityReport.targetType", ["MESSAGE", "GROUP", "POST", "ANSWER"] as const, "MESSAGE");
const communityReportStatus = makeEnum("communityReport.status", ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const, "OPEN");

// -- Batch: blog / academy / shop -------------------------------------------
const blogPostStatus = makeEnum("blogPost.status", ["PUBLISHED", "DRAFT"] as const, "PUBLISHED");
const blogLikeTargetType = makeEnum("blogLike.targetType", ["BLOG", "COMMENT"] as const, "BLOG");
const academyBusinessType = makeEnum("academy.businessType", ["sole_proprietorship", "partnership", "pvt_ltd", "ngo_trust"] as const, "sole_proprietorship");
const payoutFrequency = makeEnum("academy.payoutFrequency", ["weekly", "biweekly", "monthly"] as const, "weekly");
const productCategory = makeEnum("product.category", ["APPAREL", "FOOTWEAR", "ACCESSORIES", "EQUIPMENT"] as const, "EQUIPMENT");
const productSellerType = makeEnum("product.sellerType", ["MERCHANT", "PARENT", "Player", "Coach", "ACADEMY", "SYSTEM"] as const, "SYSTEM");
const productCondition = makeEnum("product.condition", ["NEW", "USED"] as const, "NEW");
const orderStatus = makeEnum("order.status", ["CART", "PENDING_PAYMENT", "PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const, "PENDING_PAYMENT");
const shopPaymentStatus = makeEnum("shop.paymentStatus", ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUND_INITIATED", "REFUNDED"] as const, "PENDING");
const paymentGateway = makeEnum("shop.paymentGateway", ["PHONEPE"] as const, "PHONEPE");
const fulfillmentStatus = makeEnum("shop.fulfillmentStatus", ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const, "PENDING");

// -- Batch: support tickets -------------------------------------------------
const supportRequesterType = makeEnum("supportTicket.requesterType", ["player", "venue_owner", "coach", "academy_owner", "other"] as const, "other");
const supportCategory = makeEnum("supportTicket.category", ["BOOKING", "PAYMENT", "ACCOUNT", "TECHNICAL", "OTHER"] as const, "OTHER");
const supportStatus = makeEnum("supportTicket.status", ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const, "OPEN");
const supportPriority = makeEnum("supportTicket.priority", ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "MEDIUM");
const supportNoteAuthor = makeEnum("supportTicketNote.authorType", ["USER", "Admin"] as const, "USER");

/** Read a whole collection as an array (fine for one-off migration sizes). */
async function all(db: Db, coll: string): Promise<any[]> {
  return db.collection(coll).find({}).toArray();
}

// ---------------------------------------------------------------------------
// TEMPLATE 1 — flat collection with no embedded children (map fields 1:1).
// ---------------------------------------------------------------------------
async function migrateSports(db: Db) {
  const docs = await all(db, "sports");
  await prisma.sport.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      description: d.description ?? "",
      category: d.category ?? "Other",
      attrInteractionType: d.attributes?.interactionType ?? null,
      attrDemand: d.attributes?.demand ?? null,
      attrContactLevel: d.attributes?.contactLevel ?? null,
      isVerified: !!d.isVerified,
      verifiedAt: date(d.verifiedAt),
      addedBy: oid(d.addedBy),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  sports: ${docs.length}`);
}

// ---------------------------------------------------------------------------
// TEMPLATE 2 — parent + embedded arrays/objects -> child tables.
// ---------------------------------------------------------------------------
async function migrateUsers(db: Db) {
  const docs = await all(db, "users");
  for (const d of docs) {
    await prisma.user.create({
      data: {
        id: String(d._id),
        name: d.name,
        email: d.email,
        phone: d.phone,
        role: d.role ?? "Player",
        userType: d.userType ?? "Player",
        password: d.password ?? null,
        googleId: d.googleId ?? null,
        photoUrl: d.photoUrl ?? null,
        photoS3Key: d.photoS3Key ?? null,
        city: d.city ?? null,
        lastActiveAt: date(d.lastActiveAt),
        dob: date(d.dob),
        resetPasswordToken: d.resetPasswordToken ?? null,
        resetPasswordExpires: date(d.resetPasswordExpires),
        isActive: d.isActive ?? true,
        suspensionReason: d.suspensionReason ?? "",
        suspendedAt: date(d.suspendedAt),
        suspendedBy: oid(d.suspendedBy),
        deactivatedAt: date(d.deactivatedAt),
        defaultAddressId: oid(d.defaultAddressId),
        legalConsents: d.legalConsents ?? undefined,
        notificationPreferences: d.notificationPreferences ?? undefined,
        reminderPreferences: d.reminderPreferences ?? undefined,
        shippingAddress: d.shippingAddress ?? undefined,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        addresses: {
          create: (d.addresses ?? []).map((a: any) => ({
            id: a._id ? String(a._id) : undefined,
            fullName: a.fullName,
            email: a.email,
            phone: a.phone,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2 ?? null,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country ?? "IN",
            isDefault: !!a.isDefault,
            createdAt: date(a.createdAt) ?? new Date(),
            updatedAt: date(a.updatedAt) ?? new Date(),
          })),
        },
        pushSubscriptions: {
          create: (d.pushSubscriptions ?? []).map((p: any) => ({
            endpoint: p.endpoint,
            p256dh: p.keys?.p256dh ?? "",
            auth: p.keys?.auth ?? "",
            userAgent: p.userAgent ?? null,
            createdAt: date(p.createdAt) ?? new Date(),
          })),
        },
        refundMethods: {
          create: (d.refundMethods ?? []).map((r: any) => ({
            type: r.type ?? "ORIGINAL_CARD",
            accountHolderName: r.accountHolderName ?? null,
            accountNumber: r.accountNumber ?? null,
            ifscCode: r.ifscCode ?? null,
            bankName: r.bankName ?? null,
            isDefault: !!r.isDefault,
            addedAt: date(r.addedAt) ?? new Date(),
            updatedAt: date(r.updatedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  users (+addresses/push/refund): ${docs.length}`);
}

async function migrateCoaches(db: Db) {
  const docs = await all(db, "coaches");
  for (const d of docs) {
    const base = geo(d.baseLocation);
    const sportPricing = Object.entries(d.sportPricing ?? {}).map(
      ([sport, price]) => ({ sport, price: Number(price) }),
    );
    const sportAvail: any[] = [];
    for (const [sport, windows] of Object.entries(d.availabilityBySport ?? {})) {
      for (const w of windows as any[])
        sportAvail.push({ sport, dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime });
    }
    await prisma.coach.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        bio: d.bio ?? "",
        certifications: d.certifications ?? [],
        sports: d.sports ?? [],
        hourlyRate: num(d.hourlyRate, 0)!,
        serviceMode: svcMode(d.serviceMode),
        serviceRadiusKm: num(d.serviceRadiusKm),
        travelBufferTime: num(d.travelBufferTime),
        rating: num(d.rating, 0)!,
        reviewCount: num(d.reviewCount, 0)!,
        verificationStatus: d.verificationStatus ?? "UNVERIFIED",
        verificationNotes: d.verificationNotes ?? "",
        onboardingProgressStep: num(d.onboardingProgressStep, 1)!,
        activeSubscriptionId: oid(d.activeSubscriptionId),
        subscriptionStatus: d.subscriptionStatus ?? "NONE",
        subscriptionExpiresAt: date(d.subscriptionExpiresAt),
        verificationSubmittedAt: date(d.verificationSubmittedAt),
        lastVerificationReminderAt: date(d.lastVerificationReminderAt),
        verifiedAt: date(d.verifiedAt),
        verifiedBy: oid(d.verifiedBy),
        isVerified: !!d.isVerified,
        baseLng: base.lng,
        baseLat: base.lat,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        sportPricing: { create: sportPricing },
        availability: {
          create: (d.availability ?? []).map((a: any) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        },
        sportAvailability: { create: sportAvail },
        documents: {
          create: (d.verificationDocuments ?? []).map((doc: any) => ({
            type: doc.type,
            url: doc.url,
            s3Key: doc.s3Key ?? null,
            fileName: doc.fileName,
            uploadedAt: date(doc.uploadedAt) ?? new Date(),
          })),
        },
        blockedDates: {
          create: (d.blockedDates ?? []).map((b: any) => ({
            startDate: new Date(b.startDate),
            endDate: new Date(b.endDate),
            reason: b.reason ?? null,
            allDay: b.allDay ?? true,
            blockedAt: date(b.blockedAt) ?? new Date(),
          })),
        },
        payoutMethods: {
          create: (d.payoutMethods ?? []).map((p: any) => ({
            type: p.type,
            accountHolderName: p.accountHolderName ?? null,
            accountNumber: p.accountNumber ?? null,
            ifscCode: p.ifscCode ?? null,
            bankName: p.bankName ?? null,
            upiId: p.upiId ?? null,
            isDefault: !!p.isDefault,
            addedAt: date(p.addedAt) ?? new Date(),
            updatedAt: date(p.updatedAt) ?? new Date(),
          })),
        },
        // Conditionally include the optional 1:1 relation. `exactOptionalPropertyTypes`
        // forbids passing an explicit `undefined`, so spread the key in only when present.
        ...(d.ownVenueDetails
          ? {
              ownVenue: {
                create: {
                  name: d.ownVenueDetails.name ?? null,
                  address: d.ownVenueDetails.address ?? null,
                  lng: geo(d.ownVenueDetails.location).lng,
                  lat: geo(d.ownVenueDetails.location).lat,
                  sports: d.ownVenueDetails.sports ?? [],
                  amenities: d.ownVenueDetails.amenities ?? [],
                  pricePerHour: num(d.ownVenueDetails.pricePerHour),
                  description: d.ownVenueDetails.description ?? null,
                  images: d.ownVenueDetails.images ?? [],
                  imageS3Keys: d.ownVenueDetails.imageS3Keys ?? [],
                  openingHours: d.ownVenueDetails.openingHours ?? null,
                },
              },
            }
          : {}),
      },
    });
  }
  console.log(`  coaches (+all children): ${docs.length}`);
}

async function migrateVenues(db: Db) {
  const docs = await all(db, "venues");
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const d of docs) {
    const loc = geo(d.location);
    const sportPricing = Object.entries(d.sportPricing ?? {}).map(
      ([sport, price]) => ({ sport, price: Number(price) }),
    );
    const sportImages = Object.keys(d.sportImages ?? {}).map((sport) => ({
      sport,
      images: d.sportImages[sport] ?? [],
      imageKeys: (d.sportImageKeys ?? {})[sport] ?? [],
    }));
    const openingHours = days
      .filter((day) => d.openingHours?.[day])
      .map((day) => ({
        day,
        isOpen: d.openingHours[day].isOpen ?? true,
        openTime: d.openingHours[day].openTime ?? "09:00",
        closeTime: d.openingHours[day].closeTime ?? "21:00",
        slots: d.openingHours[day].slots ?? [],
      }));
    await prisma.venue.create({
      data: {
        id: String(d._id),
        ownerName: d.ownerName,
        ownerEmail: d.ownerEmail,
        ownerPhone: d.ownerPhone,
        emailVerified: !!d.emailVerified,
        name: d.name,
        ownerId: oid(d.ownerId),
        sports: d.sports ?? [],
        pricePerHour: num(d.pricePerHour, 0)!,
        amenities: d.amenities ?? [],
        address: d.address ?? "",
        description: d.description ?? "",
        images: d.images ?? [],
        imageKeys: d.imageKeys ?? [],
        generalImages: d.generalImages ?? [],
        generalImageKeys: d.generalImageKeys ?? [],
        coverPhotoUrl: d.coverPhotoUrl ?? null,
        coverPhotoKey: d.coverPhotoKey ?? null,
        allowExternalCoaches: d.allowExternalCoaches ?? true,
        approvalStatus: d.approvalStatus ?? "PENDING",
        rejectionReason: d.rejectionReason ?? null,
        reviewNotes: d.reviewNotes ?? null,
        rating: num(d.rating, 0)!,
        reviewCount: num(d.reviewCount, 0)!,
        hasCoaches: !!d.hasCoaches,
        lng: loc.lng,
        lat: loc.lat,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        sportPricing: { create: sportPricing },
        sportImages: { create: sportImages },
        openingHours: { create: openingHours },
        venueCoaches: {
          create: (d.venueCoaches ?? []).map((c: any) => ({
            name: c.name,
            sport: c.sport,
            hourlyRate: num(c.hourlyRate, 0)!,
            bio: c.bio ?? null,
          })),
        },
        documents: {
          create: (d.documents ?? []).map((doc: any) => ({
            type: doc.type,
            url: doc.url,
            s3Key: doc.s3Key ?? null,
            fileName: doc.fileName,
            uploadedAt: date(doc.uploadedAt) ?? new Date(),
          })),
        },
        payoutMethods: {
          create: (d.payoutMethods ?? []).map((p: any) => ({
            type: p.type,
            accountHolderName: p.accountHolderName ?? null,
            accountNumber: p.accountNumber ?? null,
            ifscCode: p.ifscCode ?? null,
            bankName: p.bankName ?? null,
            upiId: p.upiId ?? null,
            isDefault: !!p.isDefault,
            addedAt: date(p.addedAt) ?? new Date(),
            updatedAt: date(p.updatedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  venues (+all children): ${docs.length}`);
}

async function migrateBookings(db: Db) {
  const docs = await all(db, "bookings");
  for (const d of docs) {
    await prisma.booking.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        venueId: oid(d.venueId),
        coachId: oid(d.coachId),
        academyId: oid(d.academyId),
        sport: d.sport,
        date: new Date(d.date),
        startTime: d.startTime,
        endTime: d.endTime,
        totalAmount: num(d.totalAmount, 0)!,
        serviceFee: num(d.serviceFee, 0)!,
        taxAmount: num(d.taxAmount, 0)!,
        promoCode: d.promoCode ?? null,
        discountAmount: num(d.discountAmount, 0)!,
        status: d.status ?? "PENDING_CONFIRMATION",
        expiresAt: date(d.expiresAt),
        checkInCode: d.checkInCode ?? null,
        participantName: d.participantName,
        participantId: oid(d.participantId),
        participantAge: num(d.participantAge),
        paymentConfirmedAt: date(d.paymentConfirmedAt),
        confirmationEmailSentAt: date(d.confirmationEmailSentAt),
        cancelledAt: date(d.cancelledAt),
        cancellationReason: d.cancellationReason ?? null,
        refundAmount: num(d.refundAmount),
        refundStatus: d.refundStatus ?? null,
        bookingType: d.bookingType ?? "INDIVIDUAL",
        organizerId: String(d.organizerId ?? d.userId),
        paymentType: d.paymentType ?? "SINGLE",
        splitMethod: d.splitMethod ?? null,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        payments: {
          create: (d.payments ?? []).map((p: any) => ({
            userId: String(p.userId),
            userType: payUserType(p.userType),
            amount: num(p.amount, 0)!,
            status: p.status ?? "PENDING",
            paidAt: date(p.paidAt),
          })),
        },
        participants: {
          create: (d.participants ?? []).map((p: any) => ({
            userId: String(p.userId),
            name: p.name,
            status: p.status ?? "INVITED",
            invitedAt: date(p.invitedAt) ?? new Date(),
            respondedAt: date(p.respondedAt),
          })),
        },
      },
    });
  }
  console.log(`  bookings (+legs/participants): ${docs.length}`);
}

async function migrateWallets(db: Db) {
  const docs = await all(db, "wallets");
  for (const d of docs) {
    await prisma.wallet.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        balance: num(d.balance, 0)!,
        currency: d.currency ?? "INR",
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        transactions: {
          create: (d.transactions ?? []).map((t: any) => ({
            externalId: t.id,
            type: t.type,
            amount: num(t.amount, 0)!,
            status: t.status ?? "COMPLETED",
            reason: t.reason,
            referenceId: t.referenceId ?? null,
            createdAt: date(t.createdAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  wallets (+transactions): ${docs.length}`);
}

async function migrateReviews(db: Db) {
  const docs = await all(db, "reviews");
  for (const d of docs) {
    await prisma.review.create({
      data: {
        id: String(d._id),
        bookingId: oid(d.bookingId),
        orderId: oid(d.orderId),
        userId: String(d.userId),
        targetType: reviewTargetType(d.targetType),
        targetId: String(d.targetId),
        rating: num(d.rating, 0)!,
        review: d.review ?? null,
        isVerified: d.isVerified ?? true,
        helpfulCount: num(d.helpfulCount, 0)!,
        reportCount: num(d.reportCount, 0)!,
        isHidden: !!d.isHidden,
        moderationStatus: d.moderationStatus ?? "APPROVED",
        moderationNotes: d.moderationNotes ?? null,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        reports: {
          create: (d.reports ?? []).map((r: any) => ({
            userId: String(r.userId),
            reason: r.reason,
            reportedAt: date(r.reportedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  reviews (+reports): ${docs.length}`);
}

// ---------------------------------------------------------------------------
// Ordered run list. Parents (with FK children) run before dependents.
// Add the remaining collections here following the templates above +
// COVERAGE.md. Flat collections can reuse the Template-1 shape.
// ---------------------------------------------------------------------------
// ===========================================================================
// BATCH 1 — bookings / notifications (flat)
// ===========================================================================
async function migrateBookingSlotLocks(db: Db) {
  const docs = await all(db, "bookingslotlocks");
  await prisma.bookingSlotLock.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      resourceType: slotResourceType(d.resourceType),
      resourceId: String(d.resourceId),
      dateKey: d.dateKey,
      version: num(d.version, 0)!,
      lastLockedAt: date(d.lastLockedAt) ?? new Date(),
    })),
  });
  console.log(`  bookingSlotLocks: ${docs.length}`);
}

async function migrateBookingWaitlists(db: Db) {
  const docs = await all(db, "bookingwaitlists");
  await prisma.bookingWaitlist.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      venueId: oid(d.venueId),
      coachId: oid(d.coachId),
      sport: d.sport,
      date: new Date(d.date),
      startTime: d.startTime,
      endTime: d.endTime,
      alternateSlots: d.alternateSlots ?? [],
      status: waitlistStatus(d.status),
      notifiedAt: date(d.notifiedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  bookingWaitlists: ${docs.length}`);
}

async function migrateBookingInvitations(db: Db) {
  const docs = await all(db, "bookinginvitations");
  await prisma.bookingInvitation.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      bookingId: String(d.bookingId),
      inviterId: String(d.inviterId),
      inviteeId: String(d.inviteeId),
      venueId: String(d.venueId),
      coachId: oid(d.coachId),
      sport: d.sport,
      date: new Date(d.date),
      startTime: d.startTime,
      endTime: d.endTime,
      estimatedAmount: num(d.estimatedAmount, 0)!,
      status: invitationStatus(d.status),
      respondedAt: date(d.respondedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  bookingInvitations: ${docs.length}`);
}

async function migrateBookingPayments(db: Db) {
  const docs = await all(db, "bookingpaymenttransactions");
  await prisma.bookingPaymentTransaction.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      bookingId: String(d.bookingId),
      userId: String(d.userId),
      merchantOrderId: d.merchantOrderId,
      phonepeOrderId: d.phonepeOrderId ?? null,
      amount: num(d.amount, 0)!,
      status: paymentTxnStatus(d.status),
      state: d.state ?? null,
      redirectUrl: d.redirectUrl ?? null,
      refundMerchantId: d.refundMerchantId ?? null,
      refundId: d.refundId ?? null,
      refundState: d.refundState ?? null,
      refundAmount: num(d.refundAmount),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
      ...(d.callbackPayload ? { callbackPayload: d.callbackPayload } : {}),
      ...(d.lastStatusPayload ? { lastStatusPayload: d.lastStatusPayload } : {}),
      ...(d.refundResponse ? { refundResponse: d.refundResponse } : {}),
    })),
  });
  console.log(`  bookingPayments: ${docs.length}`);
}

async function migrateNotifications(db: Db) {
  const docs = await all(db, "notifications");
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      type: d.type,
      category: notificationCategory(d.category),
      title: d.title,
      message: d.message,
      data: d.data ?? {},
      isRead: !!d.isRead,
      readAt: date(d.readAt),
      expiresAt: date(d.expiresAt),
      deletedAt: date(d.deletedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  notifications: ${docs.length}`);
}

async function migrateScheduledNotifications(db: Db) {
  const docs = await all(db, "schedulednotifications");
  await prisma.scheduledNotification.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      type: scheduledType(d.type),
      interval: d.interval,
      scheduledFor: new Date(d.scheduledFor),
      status: scheduledStatus(d.status),
      bookingId: oid(d.bookingId),
      title: d.title,
      body: d.body,
      data: d.data ?? {},
      sentAt: date(d.sentAt),
      failedAt: date(d.failedAt),
      failureReason: d.failureReason ?? null,
      retryCount: num(d.retryCount, 0)!,
      chEmail: !!d.channels?.email,
      chPush: !!d.channels?.push,
      chInApp: !!d.channels?.inApp,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  scheduledNotifications: ${docs.length}`);
}

async function migrateFriendConnections(db: Db) {
  const docs = await all(db, "friendconnections");
  await prisma.friendConnection.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      requesterId: String(d.requesterId),
      recipientId: String(d.recipientId),
      status: friendStatus(d.status),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  friendConnections: ${docs.length}`);
}

async function migrateUserCalendarEvents(db: Db) {
  const docs = await all(db, "usercalendarevents");
  await prisma.userCalendarEvent.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      title: d.title,
      date: new Date(d.date),
      color: d.color ?? "#f97316",
      type: calendarEventType(d.type),
      notes: d.notes ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  userCalendarEvents: ${docs.length}`);
}

async function migrateDisputes(db: Db) {
  const docs = await all(db, "disputes");
  await prisma.dispute.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      bookingId: String(d.bookingId),
      userId: oid(d.userId),
      disputeType: disputeType(d.disputeType),
      disputeDetails: d.disputeDetails ?? null,
      status: disputeStatus(d.status),
      resolutionMethod: disputeResolutionMethod(d.resolutionMethod),
      recommendedAction: disputeRecommendedAction(d.recommendedAction),
      refundPercentage: num(d.refundPercentage, 0)!,
      reasoning: d.reasoning ?? null,
      confidence: disputeConfidence(d.confidence),
      requiresManualReview: !!d.requiresManualReview,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  disputes: ${docs.length}`);
}

async function migrateVenueInquiries(db: Db) {
  const docs = await all(db, "venueinquiries");
  await prisma.venueInquiry.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      venueName: d.venueName,
      ownerName: d.ownerName,
      phone: d.phone,
      address: d.address,
      sports: d.sports,
      message: d.message ?? null,
      status: venueInquiryStatus(d.status),
      reviewedBy: oid(d.reviewedBy),
      reviewedAt: date(d.reviewedAt),
      reviewNotes: d.reviewNotes ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  venueInquiries: ${docs.length}`);
}

// ===========================================================================
// BATCH 2 — coach subscriptions / plans / promos
// ===========================================================================
async function migrateCoachSubscriptionPackages(db: Db) {
  const docs = await all(db, "coachsubscriptionpackages");
  await prisma.coachSubscriptionPackage.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      coachId: String(d.coachId),
      name: d.name,
      description: d.description ?? "",
      frequency: subFrequency(d.frequency),
      price: num(d.price, 0)!,
      features: d.features ?? [],
      maxStudents: num(d.maxStudents),
      maxSessions: num(d.maxSessions),
      isActive: d.isActive ?? true,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  coachSubscriptionPackages: ${docs.length}`);
}

async function migrateCoachSubscriptions(db: Db) {
  const docs = await all(db, "coachsubscriptions");
  await prisma.coachSubscription.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      coachId: String(d.coachId),
      userId: String(d.userId),
      dependentId: oid(d.dependentId),
      packageId: String(d.packageId),
      status: coachSubStatus(d.status),
      currentPeriodStart: new Date(d.currentPeriodStart),
      currentPeriodEnd: new Date(d.currentPeriodEnd),
      nextBillingDate: new Date(d.nextBillingDate),
      autoRenew: d.autoRenew ?? true,
      gracePeriodEndsAt: date(d.gracePeriodEndsAt),
      cancelledAt: date(d.cancelledAt),
      cancellationReason: d.cancellationReason ?? "",
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  coachSubscriptions: ${docs.length}`);
}

async function migrateCoachSubscriptionPayments(db: Db) {
  const docs = await all(db, "coachsubscriptionpaymenttransactions");
  await prisma.coachSubscriptionPaymentTransaction.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      coachId: String(d.coachId),
      userId: String(d.userId),
      dependentId: oid(d.dependentId),
      packageId: String(d.packageId),
      merchantOrderId: d.merchantOrderId,
      phonepeOrderId: d.phonepeOrderId ?? null,
      linkedSubscriptionId: oid(d.linkedSubscriptionId),
      baseAmount: num(d.baseAmount, 0)!,
      platformFeeAmount: num(d.platformFeeAmount, 0)!,
      taxAmount: num(d.taxAmount, 0)!,
      amount: num(d.amount, 0)!,
      status: paymentTxnStatus(d.status),
      state: d.state ?? null,
      redirectUrl: d.redirectUrl ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
      ...(d.callbackPayload ? { callbackPayload: d.callbackPayload } : {}),
      ...(d.lastStatusPayload ? { lastStatusPayload: d.lastStatusPayload } : {}),
    })),
  });
  console.log(`  coachSubscriptionPayments: ${docs.length}`);
}

async function migrateCoachClientNotes(db: Db) {
  const docs = await all(db, "coachclientnotes");
  await prisma.coachClientNote.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      coachId: String(d.coachId),
      clientId: String(d.clientId),
      note: d.note,
      noteType: noteType(d.noteType),
      sessionDate: date(d.sessionDate),
      bookingId: oid(d.bookingId),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  coachClientNotes: ${docs.length}`);
}

async function migrateSubscriptionPlans(db: Db) {
  const docs = await all(db, "subscriptionplans");
  await prisma.subscriptionPlan.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      academyId: String(d.academyId),
      name: d.name,
      duration: planDuration(d.duration),
      price: num(d.price, 0)!,
      includesVenue: d.includesVenue ?? false,
      includesCoaching: d.includesCoaching ?? true,
      maxSessions: num(d.maxSessions),
      description: d.description ?? "",
      isActive: d.isActive ?? true,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  subscriptionPlans: ${docs.length}`);
}

async function migrateSessionPackages(db: Db) {
  const docs = await all(db, "sessionpackages");
  await prisma.sessionPackage.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      academyId: String(d.academyId),
      name: d.name,
      sessionCount: num(d.sessionCount, 0)!,
      price: num(d.price, 0)!,
      validityDays: num(d.validityDays, 0)!,
      sport: d.sport,
      coachId: oid(d.coachId),
      isActive: d.isActive ?? true,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  sessionPackages: ${docs.length}`);
}

async function migratePromoCodes(db: Db) {
  const docs = await all(db, "promocodes");
  for (const d of docs) {
    await prisma.promoCode.create({
      data: {
        id: String(d._id),
        code: d.code,
        description: d.description,
        discountType: promoDiscountType(d.discountType),
        discountValue: num(d.discountValue, 0)!,
        applicableTo: promoApplicableTo(d.applicableTo),
        minBookingAmount: num(d.minBookingAmount),
        maxDiscountAmount: num(d.maxDiscountAmount),
        validFrom: new Date(d.validFrom),
        validUntil: new Date(d.validUntil),
        isActive: d.isActive ?? true,
        maxUsageTotal: num(d.maxUsageTotal),
        maxUsagePerUser: num(d.maxUsagePerUser, 1)!,
        currentUsageCount: num(d.currentUsageCount, 0)!,
        createdBy: String(d.createdBy),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        usedBy: {
          create: (d.usedBy ?? []).map((u: any) => ({
            ...(u._id ? { id: String(u._id) } : {}),
            userId: String(u.userId),
            bookingId: oid(u.bookingId),
            orderId: oid(u.orderId),
            discountApplied: num(u.discountApplied, 0)!,
            usedAt: date(u.usedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  promoCodes (+usages): ${docs.length}`);
}

// ===========================================================================
// BATCH 3 — players / admin / analytics / infra
// ===========================================================================
async function migratePlayers(db: Db) {
  const docs = await all(db, "players");
  for (const d of docs) {
    const ps = d.pathwayState ?? {};
    await prisma.player.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        type: playerType(d.type),
        name: d.name,
        age: num(d.age),
        dob: date(d.dob),
        gender: playerGender(d.gender),
        relation: d.relation ?? null,
        sportsFocus: d.sportsFocus ?? [],
        skillLevel: d.skillLevel ?? null,
        yearsPlaying: num(d.yearsPlaying),
        personalityTags: d.personalityTags ?? [],
        primaryObjective: playerObjective(d.primaryObjective),
        weeklyTimeCommitment: num(d.weeklyTimeCommitment),
        budgetTier: playerBudget(d.budgetTier),
        location: d.location ?? null,
        psSatisfiedPrereqs: ps.satisfiedPrerequisites ?? [],
        psCurrentGpa: num(ps.currentGpa),
        psTargetDivision: ps.targetDivision ?? null,
        psGraduationYear: num(ps.graduationYear),
        heightCm: num(d.heightCm),
        weightKg: num(d.weightKg),
        medicalConditions: d.medicalConditions ?? [],
        build: d.build ?? null,
        heightCategory: d.heightCategory ?? null,
        energyType: d.energyType ?? null,
        motorType: d.motorType ?? null,
        visualTracking: d.visualTracking ?? null,
        teamIndividual: num(d.teamIndividual),
        competitiveResponse: d.competitiveResponse ?? null,
        focusStyle: d.focusStyle ?? null,
        decisionStyle: d.decisionStyle ?? null,
        pressureResponse: d.pressureResponse ?? null,
        repetitionTolerance: d.repetitionTolerance ?? null,
        contactComfort: d.contactComfort ?? null,
        environment: d.environment ?? null,
        waterComfort: d.waterComfort ?? null,
        budgetRange: d.budgetRange ?? null,
        ambition: d.ambition ?? null,
        eyesight: d.eyesight ?? null,
        agility: d.agility ?? null,
        weeklyHoursCategory: d.weeklyHoursCategory ?? null,
        experienceLevel: d.experienceLevel ?? null,
        trainingType: d.trainingType ?? null,
        wizardCity: d.wizardCity ?? null,
        sportMatches: d.sportMatches ?? undefined,
        wizardCompletedAt: date(d.wizardCompletedAt),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        paymentHistory: {
          create: (d.paymentHistory ?? []).map((p: any) => ({
            ...(p._id ? { id: String(p._id) } : {}),
            bookingId: oid(p.bookingId),
            amount: num(p.amount),
            date: date(p.date),
          })),
        },
      },
    });
  }
  console.log(`  players (+paymentHistory): ${docs.length}`);
}

async function migrateAdmins(db: Db) {
  const docs = await all(db, "admins");
  await prisma.admin.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      email: d.email,
      password: d.password ?? "",
      mustChangePassword: !!d.mustChangePassword,
      role: adminRole(d.role),
      permissions: d.permissions ?? [],
      isActive: d.isActive ?? true,
      lastLogin: date(d.lastLogin),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  admins: ${docs.length}`);
}

async function migrateAdminAuditLogs(db: Db) {
  const docs = await all(db, "adminauditlogs");
  await prisma.adminAuditLog.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      adminId: String(d.adminId),
      adminEmail: d.adminEmail,
      action: d.action,
      targetType: d.targetType,
      targetId: d.targetId ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      ...(d.metadata ? { metadata: d.metadata } : {}),
    })),
  });
  console.log(`  adminAuditLogs: ${docs.length}`);
}

async function migrateAnalyticsEvents(db: Db) {
  const docs = await all(db, "analyticsevents");
  await prisma.analyticsEvent.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: oid(d.userId),
      guestId: d.guestId ?? null,
      eventName: d.eventName,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
      metadata: d.metadata ?? {},
      source: analyticsSource(d.source),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  analyticsEvents: ${docs.length}`);
}

async function migrateEmailVerifications(db: Db) {
  const docs = await all(db, "emailverifications");
  await prisma.emailVerification.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      code: d.code,
      expiresAt: new Date(d.expiresAt),
      attempts: num(d.attempts, 0)!,
      verified: !!d.verified,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  emailVerifications: ${docs.length}`);
}

async function migrateOutboxMessages(db: Db) {
  const docs = await all(db, "outboxmessages");
  await prisma.outboxMessage.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      type: d.type,
      payload: d.payload ?? {},
      status: outboxStatus(d.status),
      attempts: num(d.attempts, 0)!,
      nextAttemptAt: date(d.nextAttemptAt) ?? new Date(),
      lastError: d.lastError ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  outboxMessages: ${docs.length}`);
}

async function migratePaymentWebhookEvents(db: Db) {
  const docs = await all(db, "paymentwebhookevents");
  await prisma.paymentWebhookEvent.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      eventId: d.eventId,
      eventType: d.eventType ?? null,
      payload: d.payload ?? {},
      status: d.status ?? "PENDING",
      attempts: num(d.attempts, 0)!,
      receivedAt: date(d.receivedAt) ?? new Date(),
      processedAt: date(d.processedAt),
      lastError: d.lastError ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  paymentWebhookEvents: ${docs.length}`);
}

async function migrateRateLimits(db: Db) {
  const docs = await all(db, "ratelimits");
  await prisma.rateLimit.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      key: d.key,
      type: rateLimitType(d.type),
      count: num(d.count, 1)!,
      resetAt: new Date(d.resetAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  rateLimits: ${docs.length}`);
}

// ===========================================================================
// BATCH 4 — pathways / discovery content (all flat; nested arrays stay Json)
// ===========================================================================
async function migrateScholarships(db: Db) {
  const docs = await all(db, "scholarships");
  await prisma.scholarship.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      city: d.city ?? null,
      name: d.name,
      provider: d.provider,
      description: d.description,
      eligibility: d.eligibility,
      prerequisiteId: d.prerequisiteId ?? null,
      prerequisiteName: d.prerequisiteName ?? null,
      prerequisiteGuide: d.prerequisiteGuide ?? [],
      documentChecklist: d.documentChecklist ?? [],
      sourceUrls: d.sourceUrls ?? [],
      isVerified: !!d.isVerified,
      lastScrapedAt: date(d.lastScrapedAt) ?? new Date(),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  scholarships: ${docs.length}`);
}

async function migrateUniversities(db: Db) {
  const docs = await all(db, "universities");
  await prisma.university.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      city: d.city ?? null,
      name: d.name,
      location: d.location,
      admissionCriteria: d.admissionCriteria,
      sportsQuotaDetails: d.sportsQuotaDetails,
      prerequisiteId: d.prerequisiteId ?? null,
      prerequisiteName: d.prerequisiteName ?? null,
      prerequisiteGuide: d.prerequisiteGuide ?? [],
      documentChecklist: d.documentChecklist ?? [],
      sourceUrls: d.sourceUrls ?? [],
      isVerified: !!d.isVerified,
      lastScrapedAt: date(d.lastScrapedAt) ?? new Date(),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  universities: ${docs.length}`);
}

async function migrateAthleteStories(db: Db) {
  const docs = await all(db, "athletestories");
  await prisma.athleteStory.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      level: num(d.level, 0)!,
      name: d.name,
      location: d.location,
      achievement: d.achievement,
      quote: d.quote,
      parentNote: d.parentNote,
      tags: d.tags ?? [],
      isAiGenerated: d.isAiGenerated ?? true,
      sourceUrls: d.sourceUrls ?? [],
      lastScrapedAt: date(d.lastScrapedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  athleteStories: ${docs.length}`);
}

async function migrateTournaments(db: Db) {
  const docs = await all(db, "tournaments");
  await prisma.tournament.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      city: d.city ?? null,
      name: d.name,
      level: d.level,
      description: d.description,
      ageGroup: d.ageGroup,
      prerequisiteId: d.prerequisiteId ?? null,
      prerequisiteName: d.prerequisiteName ?? null,
      prerequisiteGuide: d.prerequisiteGuide ?? [],
      documentChecklist: d.documentChecklist ?? [],
      typicalDates: d.typicalDates ?? null,
      registrationDeadline: d.registrationDeadline ?? null,
      sourceUrls: d.sourceUrls ?? [],
      isVerified: !!d.isVerified,
      lastScrapedAt: date(d.lastScrapedAt) ?? new Date(),
      slug: d.slug ?? null,
      isCurated: !!d.isCurated,
      fedName: d.federation?.name ?? null,
      fedAcronym: d.federation?.acronym ?? null,
      fedWebsite: d.federation?.website ?? null,
      fedType: d.federation?.type ?? null,
      fedAbout: d.federation?.about ?? null,
      participationGuide: d.participationGuide ?? [],
      qualificationPath: d.qualificationPath ?? null,
      format: d.format ?? null,
      prestige: d.prestige ?? null,
      prizePool: d.prizePool ?? null,
      registrationUrl: d.registrationUrl ?? null,
      entryFee: d.entryFee ?? null,
      selectionCriteria: d.selectionCriteria ?? null,
      prizes: d.prizes ?? null,
      keyFacts: d.keyFacts ?? [],
      importantNotes: d.importantNotes ?? [],
      circuitContext: d.circuitContext ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  tournaments: ${docs.length}`);
}

async function migrateTournamentEditions(db: Db) {
  const docs = await all(db, "tournamenteditions");
  await prisma.tournamentEdition.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      name: d.name,
      editionYear: num(d.editionYear, 0)!,
      startDate: new Date(d.startDate),
      endDate: date(d.endDate),
      registrationDeadlineDate: date(d.registrationDeadlineDate),
      venue: d.venue ?? null,
      city: d.city ?? null,
      level: d.level ?? null,
      ageGroups: d.ageGroups ?? [],
      sourceUrl: d.sourceUrl,
      status: d.status ?? "announced",
      lastCheckedAt: date(d.lastCheckedAt) ?? new Date(),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  tournamentEditions: ${docs.length}`);
}

async function migrateSportPathways(db: Db) {
  const docs = await all(db, "sportpathways");
  await prisma.sportPathway.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      sportName: d.sportName,
      cacheKey: d.cacheKey ?? null,
      category: d.category ?? "Other",
      overview: d.overview ?? "",
      levels: d.levels ?? [],
      tournaments: d.tournaments ?? [],
      scholarships: d.scholarships ?? [],
      universities: d.universities ?? [],
      equipment: d.equipment ?? [],
      careers: d.careers ?? [],
      tournamentsVerifiedEmpty: !!d.tournamentsVerifiedEmpty,
      scholarshipsVerifiedEmpty: !!d.scholarshipsVerifiedEmpty,
      universitiesVerifiedEmpty: !!d.universitiesVerifiedEmpty,
      isVerified: !!d.isVerified,
      verifiedAt: date(d.verifiedAt),
      verifiedBy: oid(d.verifiedBy),
      lookupCount: num(d.lookupCount, 1)!,
      contentRefreshedAt: date(d.contentRefreshedAt),
      financialDataRefreshedAt: date(d.financialDataRefreshedAt),
      contentRefreshInProgress: !!d.contentRefreshInProgress,
      financialRefreshInProgress: !!d.financialRefreshInProgress,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
      ...(d.progressionPlan ? { progressionPlan: d.progressionPlan } : {}),
    })),
  });
  console.log(`  sportPathways: ${docs.length}`);
}

async function migrateSportBasePaths(db: Db) {
  const docs = await all(db, "sportbasepaths");
  await prisma.sportBasePath.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      sportName: d.sportName,
      category: d.category ?? null,
      overview: d.overview,
      levels: d.levels ?? [],
      equipment: d.equipment ?? [],
      careers: d.careers ?? [],
      generatedAt: date(d.generatedAt) ?? new Date(),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  sportBasePaths: ${docs.length}`);
}

async function migrateSportStatePaths(db: Db) {
  const docs = await all(db, "sportstatepaths");
  await prisma.sportStatePath.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      stateSlug: d.stateSlug,
      stateName: d.stateName,
      saName: d.stateAssociation?.name ?? null,
      saAcronym: d.stateAssociation?.acronym ?? null,
      saWebsite: d.stateAssociation?.website ?? null,
      saContact: d.stateAssociation?.contact ?? null,
      topAcademies: d.topAcademies ?? [],
      feeMonthly: d.feeRange?.monthly ?? null,
      feeEquipment: d.feeRange?.equipment ?? null,
      feeTournaments: d.feeRange?.tournaments ?? null,
      governmentSchemes: d.governmentSchemes ?? [],
      regionalCalendar: d.regionalCalendar,
      generatedAt: date(d.generatedAt) ?? new Date(),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  sportStatePaths: ${docs.length}`);
}

async function migratePathwayExpertVerifications(db: Db) {
  const docs = await all(db, "pathwayexpertverifications");
  await prisma.pathwayExpertVerification.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      sportSlug: d.sportSlug,
      sportName: d.sportName,
      expertId: String(d.expertId),
      expertName: d.expertName,
      expertPhotoUrl: d.expertPhotoUrl ?? null,
      verifiedAt: date(d.verifiedAt) ?? new Date(),
      note: d.note ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  pathwayExpertVerifications: ${docs.length}`);
}

async function migrateUserPathwayProfiles(db: Db) {
  const docs = await all(db, "userpathwayprofiles");
  await prisma.userPathwayProfile.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      dependentId: oid(d.dependentId),
      progress: d.progress ?? {},
      savedItems: d.savedItems ?? [],
      applications: d.applications ?? [],
      reminders: d.reminders ?? [],
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  userPathwayProfiles: ${docs.length}`);
}

// ===========================================================================
// BATCH 5 — experts / guidance / roadmap / concierge
// ===========================================================================
async function migrateExperts(db: Db) {
  const docs = await all(db, "experts");
  for (const d of docs) {
    await prisma.expert.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        bio: d.bio ?? "",
        sports: d.sports ?? [],
        expertise: d.expertise ?? [],
        achievements: d.achievements ?? null,
        sessionFee: num(d.sessionFee, 0)!,
        sessionMode: expertSessionMode(d.sessionMode),
        sessionDurationMinutes: num(d.sessionDurationMinutes, 60)!,
        timezone: d.timezone ?? "Asia/Kolkata",
        blackoutDates: d.blackoutDates ?? [],
        city: d.city ?? null,
        languages: d.languages ?? [],
        photoUrl: d.photoUrl ?? null,
        photoKey: d.photoKey ?? null,
        inPersonAddress: d.inPersonAddress ?? null,
        isActive: !!d.isActive,
        verificationStatus: expertVerificationStatus(d.verificationStatus),
        rejectionReason: d.rejectionReason ?? null,
        rating: num(d.rating, 0)!,
        reviewCount: num(d.reviewCount, 0)!,
        createdBy: oid(d.createdBy),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        weeklyAvailability: {
          create: (d.weeklyAvailability ?? []).map((w: any) => ({
            dayOfWeek: w.dayOfWeek,
            start: w.start,
            end: w.end,
          })),
        },
        payoutMethods: {
          create: (d.payoutMethods ?? []).map((p: any) => ({
            type: p.type,
            accountHolderName: p.accountHolderName ?? null,
            accountNumber: p.accountNumber ?? null,
            ifscCode: p.ifscCode ?? null,
            bankName: p.bankName ?? null,
            upiId: p.upiId ?? null,
            isDefault: !!p.isDefault,
            addedAt: date(p.addedAt) ?? new Date(),
            updatedAt: date(p.updatedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  experts (+availability/payoutMethods): ${docs.length}`);
}

async function migrateExpertSessions(db: Db) {
  const docs = await all(db, "expertsessions");
  await prisma.expertSession.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      expertId: String(d.expertId),
      userId: String(d.userId),
      amount: num(d.amount, 0)!,
      status: expertSessionStatus(d.status),
      paymentStatus: paymentTxnStatus(d.paymentStatus),
      merchantOrderId: d.merchantOrderId,
      phonepeOrderId: d.phonepeOrderId ?? null,
      scheduledAt: date(d.scheduledAt),
      durationMinutes: num(d.durationMinutes, 60)!,
      holdExpiresAt: date(d.holdExpiresAt),
      mode: expertBookingMode(d.mode),
      meetingLink: d.meetingLink ?? null,
      clientNote: d.clientNote ?? null,
      cancelledAt: date(d.cancelledAt),
      cancelledBy: expertCanceller(d.cancelledBy),
      cancelReason: d.cancelReason ?? null,
      refundStatus: expertRefundStatus(d.refundStatus),
      cancellationNoticeHours: num(d.cancellationNoticeHours),
      autoCompleted: !!d.autoCompleted,
      expertAcceptance: expertAcceptance(d.expertAcceptance),
      expertRespondedAt: date(d.expertRespondedAt),
      completedAt: date(d.completedAt),
      payoutStatus: expertPayoutStatus(d.payoutStatus),
      payoutPaidAt: date(d.payoutPaidAt),
      reviewed: !!d.reviewed,
      rating: num(d.rating),
      review: d.review ?? null,
      reviewAnonymous: !!d.reviewAnonymous,
      reviewHidden: !!d.reviewHidden,
      reviewedAt: date(d.reviewedAt),
      reviewReminderSentAt: date(d.reviewReminderSentAt),
      meetingLinkNudgeSentAt: date(d.meetingLinkNudgeSentAt),
      startReminderSentAt: date(d.startReminderSentAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
      ...(d.callbackPayload ? { callbackPayload: d.callbackPayload } : {}),
    })),
  });
  console.log(`  expertSessions: ${docs.length}`);
}

async function migrateGuidanceSubmissions(db: Db) {
  const docs = await all(db, "guidancesubmissions");
  await prisma.guidanceSubmission.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: oid(d.userId),
      request: d.request,
      response: d.response,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  guidanceSubmissions: ${docs.length}`);
}

async function migrateGuidanceChatSessions(db: Db) {
  const docs = await all(db, "guidancechatsessions");
  for (const d of docs) {
    await prisma.guidanceChatSession.create({
      data: {
        id: String(d._id),
        submissionId: String(d.submissionId),
        userId: String(d.userId),
        totalMessageCount: num(d.totalMessageCount, 0)!,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        messages: {
          create: (d.messages ?? []).map((m: any) => ({
            role: chatRole(m.role),
            content: m.content,
            createdAt: date(m.createdAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  guidanceChatSessions (+messages): ${docs.length}`);
}

async function migrateRoadmapChatSessions(db: Db) {
  const docs = await all(db, "roadmapchatsessions");
  for (const d of docs) {
    await prisma.roadmapChatSession.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        sportSlug: d.sportSlug,
        title: d.title ?? null,
        totalMessageCount: num(d.totalMessageCount, 0)!,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        messages: {
          create: (d.messages ?? []).map((m: any) => ({
            role: chatRole(m.role),
            content: m.content,
            createdAt: date(m.createdAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  roadmapChatSessions (+messages): ${docs.length}`);
}

async function migrateConciergeRequests(db: Db) {
  const docs = await all(db, "conciergerequests");
  for (const d of docs) {
    await prisma.conciergeRequest.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        sportSlug: d.sportSlug,
        itemType: d.itemType ?? null,
        itemId: d.itemId ?? null,
        itemName: d.itemName ?? null,
        tournamentId: d.tournamentId ?? null,
        tournamentName: d.tournamentName ?? null,
        prerequisiteId: d.prerequisiteId ?? null,
        prerequisiteName: d.prerequisiteName ?? null,
        status: d.status ?? "pending",
        adminNotes: d.adminNotes ?? null,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        documents: {
          create: (d.documents ?? []).map((doc: any) => ({
            ...(doc._id ? { id: String(doc._id) } : {}),
            documentName: doc.documentName,
            s3Key: doc.s3Key,
          })),
        },
      },
    });
  }
  console.log(`  conciergeRequests (+documents): ${docs.length}`);
}

// ===========================================================================
// BATCH 6 — community
// ===========================================================================
async function migrateCommunityProfiles(db: Db) {
  const docs = await all(db, "communityprofiles");
  for (const d of docs) {
    await prisma.communityProfile.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        anonymousAlias: d.anonymousAlias,
        isIdentityPublic: d.isIdentityPublic ?? true,
        messagePrivacy: messagePrivacy(d.messagePrivacy),
        readReceiptsEnabled: d.readReceiptsEnabled ?? true,
        lastSeenVisible: d.lastSeenVisible ?? true,
        lastSeenAt: date(d.lastSeenAt),
        username: d.username ?? null,
        bio: d.bio ?? "",
        slYoutube: d.socialLinks?.youtube ?? "",
        slInstagram: d.socialLinks?.instagram ?? "",
        slFacebook: d.socialLinks?.facebook ?? "",
        slTwitter: d.socialLinks?.twitter ?? "",
        slGithub: d.socialLinks?.github ?? "",
        slWebsite: d.socialLinks?.website ?? "",
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        blockedUsers: {
          create: (d.blockedUsers ?? []).map((u: any) => ({
            blockedUserId: String(u),
          })),
        },
      },
    });
  }
  console.log(`  communityProfiles (+blockedUsers): ${docs.length}`);
}

async function migrateCommunityGroups(db: Db) {
  const docs = await all(db, "communitygroups");
  for (const d of docs) {
    const roleByUser = new Map<string, "MEMBER" | "ADMIN">();
    for (const m of d.members ?? []) roleByUser.set(String(m), "MEMBER");
    for (const a of d.admins ?? []) roleByUser.set(String(a), "ADMIN");
    const groupMembers = Array.from(roleByUser.entries()).map(
      ([userId, role]) => ({ userId, role }),
    );
    await prisma.communityGroup.create({
      data: {
        id: String(d._id),
        name: d.name,
        description: d.description ?? "",
        visibility: d.visibility ?? "PUBLIC",
        sport: d.sport ?? "",
        city: d.city ?? "",
        profilePicture: d.profilePicture ?? "",
        profilePictureKey: d.profilePictureKey ?? "",
        memberAddPolicy: groupMemberAddPolicy(d.memberAddPolicy),
        audience: groupAudience(d.audience),
        createdBy: String(d.createdBy),
        inviteCode: d.inviteCode,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        members: { create: groupMembers },
      },
    });
  }
  console.log(`  communityGroups (+members/admins merged): ${docs.length}`);
}

async function migrateCommunityConversations(db: Db) {
  const docs = await all(db, "communityconversations");
  for (const d of docs) {
    await prisma.communityConversation.create({
      data: {
        id: String(d._id),
        conversationType: conversationType(d.conversationType),
        groupId: oid(d.groupId),
        participantKey: d.participantKey ?? null,
        status: conversationStatus(d.status),
        requestedBy: String(d.requestedBy),
        lastMessageAt: date(d.lastMessageAt) ?? new Date(),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        participants: {
          create: (d.participants ?? []).map((u: any) => ({
            userId: String(u),
          })),
        },
      },
    });
  }
  console.log(`  communityConversations (+participants): ${docs.length}`);
}

async function migrateCommunityMessages(db: Db) {
  const docs = await all(db, "communitymessages");
  for (const d of docs) {
    await prisma.communityMessage.create({
      data: {
        id: String(d._id),
        conversationId: String(d.conversationId),
        senderId: String(d.senderId),
        type: communityMessageType(d.type),
        content: d.content,
        metaWidth: num(d.metadata?.width),
        metaHeight: num(d.metadata?.height),
        metaCaption: d.metadata?.caption ?? null,
        isDeleted: !!d.isDeleted,
        deletedAt: date(d.deletedAt),
        deletedBy: oid(d.deletedBy),
        editedAt: date(d.editedAt),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        readBy: {
          create: (d.readBy ?? []).map((u: any) => ({ userId: String(u) })),
        },
        deliveredTo: {
          create: (d.deliveredTo ?? []).map((u: any) => ({ userId: String(u) })),
        },
      },
    });
  }
  console.log(`  communityMessages (+read/delivery receipts): ${docs.length}`);
}

async function migrateCommunityPosts(db: Db) {
  const docs = await all(db, "communityposts");
  await prisma.communityPost.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      authorId: String(d.authorId),
      title: d.title,
      body: d.body,
      tags: d.tags ?? [],
      sport: d.sport ?? "",
      city: d.city ?? "",
      category: d.category ?? "General",
      isAnonymous: !!d.isAnonymous,
      voteScore: num(d.voteScore, 0)!,
      upvoteCount: num(d.upvoteCount, 0)!,
      downvoteCount: num(d.downvoteCount, 0)!,
      answerCount: num(d.answerCount, 0)!,
      viewCount: num(d.viewCount, 0)!,
      status: communityPostStatus(d.status),
      isDeleted: !!d.isDeleted,
      deletedAt: date(d.deletedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  communityPosts: ${docs.length}`);
}

async function migrateCommunityAnswers(db: Db) {
  const docs = await all(db, "communityanswers");
  await prisma.communityAnswer.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      postId: String(d.postId),
      authorId: String(d.authorId),
      content: d.content,
      isAnonymous: !!d.isAnonymous,
      voteScore: num(d.voteScore, 0)!,
      upvoteCount: num(d.upvoteCount, 0)!,
      downvoteCount: num(d.downvoteCount, 0)!,
      isDeleted: !!d.isDeleted,
      deletedAt: date(d.deletedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  communityAnswers: ${docs.length}`);
}

async function migrateCommunityReports(db: Db) {
  const docs = await all(db, "communityreports");
  await prisma.communityReport.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      reporterUserId: String(d.reporterUserId),
      targetType: communityReportTargetType(d.targetType),
      targetId: String(d.targetId),
      reason: d.reason,
      details: d.details ?? null,
      maSenderId: oid(d.messageAudit?.senderId),
      maCreatedAt: date(d.messageAudit?.createdAt),
      maUpdatedAt: date(d.messageAudit?.updatedAt),
      maEditedAt: date(d.messageAudit?.editedAt),
      maDeletedAt: date(d.messageAudit?.deletedAt),
      maWasEdited: !!d.messageAudit?.wasEdited,
      maWasDeleted: !!d.messageAudit?.wasDeleted,
      status: communityReportStatus(d.status),
      reviewedBy: oid(d.reviewedBy),
      reviewedAt: date(d.reviewedAt),
      resolutionNote: d.resolutionNote ?? null,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  communityReports: ${docs.length}`);
}

async function migrateCommunityReputations(db: Db) {
  const docs = await all(db, "communityreputations");
  await prisma.communityReputation.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      totalPoints: num(d.totalPoints, 0)!,
      questionCount: num(d.questionCount, 0)!,
      answerCount: num(d.answerCount, 0)!,
      receivedUpvotes: num(d.receivedUpvotes, 0)!,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  communityReputations: ${docs.length}`);
}

async function migrateCommunityVotes(db: Db) {
  const docs = await all(db, "communityvotes");
  await prisma.communityVote.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      targetType: communityVoteTargetType(d.targetType),
      targetId: String(d.targetId),
      value: num(d.value, 0)!,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  communityVotes: ${docs.length}`);
}

// ===========================================================================
// BATCH 7 — blog / academy / shop
// ===========================================================================
async function migrateBlogPosts(db: Db) {
  const docs = await all(db, "blogposts");
  await prisma.blogPost.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      authorId: String(d.authorId),
      title: d.title,
      excerpt: d.excerpt ?? "",
      coverImageKey: d.coverImageKey ?? null,
      coverImageUrl: d.coverImageUrl ?? null,
      topic: d.topic ?? "General",
      tags: d.tags ?? [],
      content: d.content ?? "",
      likeCount: num(d.likeCount, 0)!,
      commentCount: num(d.commentCount, 0)!,
      viewCount: num(d.viewCount, 0)!,
      status: blogPostStatus(d.status),
      isDeleted: !!d.isDeleted,
      deletedAt: date(d.deletedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  blogPosts: ${docs.length}`);
}

async function migrateBlogComments(db: Db) {
  const docs = await all(db, "blogcomments");
  await prisma.blogComment.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      blogId: String(d.blogId),
      authorId: String(d.authorId),
      content: d.content,
      parentId: oid(d.parentId),
      likeCount: num(d.likeCount, 0)!,
      isDeleted: !!d.isDeleted,
      deletedAt: date(d.deletedAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  blogComments: ${docs.length}`);
}

async function migrateBlogLikes(db: Db) {
  const docs = await all(db, "bloglikes");
  await prisma.blogLike.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      targetType: blogLikeTargetType(d.targetType),
      targetId: String(d.targetId),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  blogLikes: ${docs.length}`);
}

async function migrateAcademies(db: Db) {
  const docs = await all(db, "academies");
  await prisma.academy.createMany({
    skipDuplicates: true,
    data: docs.map((d) => {
      const loc = geo(d.location);
      return {
        id: String(d._id),
        name: d.name,
        legalName: d.legalName,
        slug: d.slug,
        description: d.description ?? "",
        establishedYear: num(d.establishedYear),
        logoUrl: d.logoUrl ?? null,
        logoKey: d.logoKey ?? null,
        coverPhotoUrl: d.coverPhotoUrl ?? null,
        coverPhotoKey: d.coverPhotoKey ?? null,
        photos: d.photos ?? [],
        photoKeys: d.photoKeys ?? [],
        sports: d.sports ?? [],
        ageGroups: d.ageGroups ?? [],
        lng: loc.lng,
        lat: loc.lat,
        address: d.address ?? null,
        city: d.city ?? null,
        state: d.state ?? null,
        pincode: d.pincode ?? null,
        placeId: d.placeId ?? null,
        panNumber: d.panNumber ?? "",
        panDocumentUrl: d.panDocumentUrl ?? "",
        panDocumentKey: d.panDocumentKey ?? null,
        businessType: academyBusinessType(d.businessType),
        gstNumber: d.gstNumber ?? null,
        gstDocumentUrl: d.gstDocumentUrl ?? null,
        gstDocumentKey: d.gstDocumentKey ?? null,
        msmeRegistration: d.msmeRegistration ?? null,
        sportsAuthorityAffiliation: d.sportsAuthorityAffiliation ?? null,
        aadhaarLast4: d.aadhaarLast4 ?? "",
        languagesSpoken: d.languagesSpoken ?? [],
        whatsappNumber: d.whatsappNumber,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone,
        contactPersonName: d.contactPersonName,
        allowsExternalCoaches: !!d.allowsExternalCoaches,
        maxBatchSize: num(d.maxBatchSize, 0)!,
        batchTimings: d.batchTimings ?? [],
        academyVenues: d.academyVenues ?? [],
        academyCoaches: d.academyCoaches ?? [],
        ownerId: oid(d.ownerId),
        venueIds: (d.venueIds ?? []).map((x: any) => String(x)),
        coachIds: (d.coachIds ?? []).map((x: any) => String(x)),
        sessionRatePerHour: num(d.sessionRatePerHour, 0)!,
        trialsessionOffered: !!d.trialsessionOffered,
        trialSessionPrice: num(d.trialSessionPrice),
        subscriptionPlanIds: (d.subscriptionPlans ?? []).map((x: any) => String(x)),
        sessionPackageIds: (d.sessionPackages ?? []).map((x: any) => String(x)),
        bankAccountNumber: d.bankAccountNumber ?? "",
        bankIfsc: d.bankIfsc ?? "",
        bankAccountName: d.bankAccountName ?? "",
        upiId: d.upiId ?? "",
        payoutFrequency: payoutFrequency(d.payoutFrequency),
        cancellationPolicy: d.cancellationPolicy ?? "",
        refundPolicy: d.refundPolicy ?? "",
        kycVerified: !!d.kycVerified,
        isActive: !!d.isActive,
        isApproved: !!d.isApproved,
        rejectionReason: d.rejectionReason ?? null,
        onboardingStep: num(d.onboardingStep, 1)!,
        onboardingCompleted: !!d.onboardingCompleted,
        rating: num(d.rating, 0)!,
        reviewCount: num(d.reviewCount, 0)!,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        ...(d.operatingHours ? { operatingHours: d.operatingHours } : {}),
      };
    }),
  });
  console.log(`  academies: ${docs.length}`);
}

async function migrateProducts(db: Db) {
  const docs = await all(db, "products");
  const inventories = await all(db, "inventories");
  const invByVariant = new Map(
    inventories.map((i) => [String(i.productVariantId), i]),
  );
  for (const d of docs) {
    await prisma.product.create({
      data: {
        id: String(d._id),
        sku: d.sku,
        name: d.name,
        shortDescription: d.shortDescription ?? null,
        description: d.description,
        brand: d.brand ?? null,
        material: d.material ?? null,
        warranty: d.warranty ?? null,
        tags: d.tags ?? [],
        ageGroup: d.ageGroup ?? null,
        skillLevel: d.skillLevel ?? null,
        gender: d.gender ?? null,
        category: productCategory(d.category),
        images: d.images ?? [],
        basePrice: num(d.basePrice, 0)!,
        salePrice: num(d.salePrice),
        weight: num(d.weight, 0)!,
        dimLength: num(d.dimensions?.length, 0)!,
        dimWidth: num(d.dimensions?.width, 0)!,
        dimHeight: num(d.dimensions?.height, 0)!,
        taxable: d.taxable ?? true,
        taxRate: num(d.taxRate, 0)!,
        totalStock: num(d.totalStock, 0)!,
        isActive: d.isActive ?? true,
        averageRating: num(d.averageRating, 0)!,
        totalReviews: num(d.totalReviews, 0)!,
        seller: oid(d.seller),
        sellerName: d.sellerName ?? null,
        sellerType: productSellerType(d.sellerType),
        condition: productCondition(d.condition),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        variants: {
          create: (d.variants ?? []).map((v: any) => {
            const inv = invByVariant.get(String(v._id));
            return {
              ...(v._id ? { id: String(v._id) } : {}),
              sku: v.sku,
              variantLabel: v.variantLabel,
              attributes: v.attributes ?? {},
              price: num(v.price, 0)!,
              stock: num(v.stock, 0)!,
              reorderLevel: num(v.reorderLevel, 10)!,
              createdAt: date(v.createdAt) ?? new Date(),
              updatedAt: date(v.updatedAt) ?? new Date(),
              ...(inv
                ? {
                    inventory: {
                      create: {
                        id: String(inv._id),
                        quantityOnHand: num(inv.quantityOnHand, 0)!,
                        quantityReserved: num(inv.quantityReserved, 0)!,
                        quantityAvailable: num(inv.quantityAvailable, 0)!,
                        reorderLevel: num(inv.reorderLevel, 10)!,
                        lastStockCheckAt: date(inv.lastStockCheckAt) ?? new Date(),
                        createdAt: date(inv.createdAt) ?? new Date(),
                        updatedAt: date(inv.updatedAt) ?? new Date(),
                      },
                    },
                  }
                : {}),
            };
          }),
        },
      },
    });
  }
  console.log(`  products (+variants/inventory): ${docs.length}`);
}

async function migrateOrders(db: Db) {
  const docs = await all(db, "orders");
  for (const d of docs) {
    const s = d.shippingAddress ?? {};
    await prisma.order.create({
      data: {
        id: String(d._id),
        orderNumber: d.orderNumber,
        userId: String(d.userId),
        subtotal: num(d.subtotal, 0)!,
        taxAmount: num(d.taxAmount, 0)!,
        shippingAmount: num(d.shippingAmount, 0)!,
        discountAmount: num(d.discountAmount, 0)!,
        totalAmount: num(d.totalAmount, 0)!,
        status: orderStatus(d.status),
        paymentMethod: d.paymentMethod,
        paymentGateway: paymentGateway(d.paymentGateway),
        paymentGatewayOrderId: d.paymentGatewayOrderId ?? null,
        paymentGatewayPaymentId: d.paymentGatewayPaymentId ?? null,
        paymentStatus: shopPaymentStatus(d.paymentStatus),
        appliedPromoCode: d.appliedPromoCode ?? null,
        promoDiscountAmount: num(d.promoDiscountAmount, 0)!,
        shipFullName: s.fullName ?? null,
        shipEmail: s.email ?? null,
        shipPhone: s.phone ?? null,
        shipAddressLine1: s.addressLine1 ?? null,
        shipAddressLine2: s.addressLine2 ?? null,
        shipCity: s.city ?? null,
        shipState: s.state ?? null,
        shipPostalCode: s.postalCode ?? null,
        shipCountry: s.country ?? "IN",
        estimatedDeliveryDate: date(d.estimatedDeliveryDate),
        fulfillmentStatus: fulfillmentStatus(d.fulfillmentStatus),
        trackingNumber: d.trackingNumber ?? null,
        cancelledAt: date(d.cancelledAt),
        cancelReason: d.cancelReason ?? null,
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        items: {
          create: (d.items ?? []).map((it: any) => ({
            ...(it._id ? { id: String(it._id) } : {}),
            productVariantId: String(it.productVariantId),
            productName: it.productName,
            variantLabel: it.variantLabel,
            quantity: num(it.quantity, 0)!,
            unitPrice: num(it.unitPrice, 0)!,
            lineTotal: num(it.lineTotal, 0)!,
            sellerId: oid(it.sellerId),
            condition: productCondition(it.condition),
            fulfillmentStatus: fulfillmentStatus(it.fulfillmentStatus),
            trackingNumber: it.trackingNumber ?? null,
            createdAt: date(it.createdAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  orders (+items): ${docs.length}`);
}

async function migrateCarts(db: Db) {
  const docs = await all(db, "carts");
  for (const d of docs) {
    await prisma.cart.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        subtotal: num(d.subtotal, 0)!,
        taxAmount: num(d.taxAmount, 0)!,
        discountAmount: num(d.discountAmount, 0)!,
        totalAmount: num(d.totalAmount, 0)!,
        appliedPromoCode: d.appliedPromoCode ?? null,
        expiresAt: new Date(d.expiresAt),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        items: {
          create: (d.items ?? []).map((it: any) => ({
            ...(it._id ? { id: String(it._id) } : {}),
            productVariantId: String(it.productVariantId),
            quantity: num(it.quantity, 0)!,
            lineTotal: num(it.lineTotal, 0)!,
            reservedAt: date(it.reservedAt),
            createdAt: date(it.createdAt) ?? new Date(),
            updatedAt: date(it.updatedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  carts (+items): ${docs.length}`);
}

async function migrateWishlists(db: Db) {
  const docs = await all(db, "wishlists");
  for (const d of docs) {
    await prisma.wishlist.create({
      data: {
        id: String(d._id),
        userId: String(d.userId),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        products: {
          create: (d.products ?? []).map((p: any) => ({
            ...(p._id ? { id: String(p._id) } : {}),
            productId: String(p.productId),
            addedAt: date(p.addedAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  wishlists (+items): ${docs.length}`);
}

async function migrateShopWaitlist(db: Db) {
  const docs = await all(db, "shopwaitlists");
  await prisma.shopWaitlist.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
    })),
  });
  console.log(`  shopWaitlist: ${docs.length}`);
}

async function migrateShopPaymentTransactions(db: Db) {
  const docs = await all(db, "paymenttransactions");
  await prisma.shopPaymentTransaction.createMany({
    skipDuplicates: true,
    data: docs.map((d) => ({
      id: String(d._id),
      orderId: String(d.orderId),
      paymentGateway: paymentGateway(d.paymentGateway),
      gatewayOrderId: d.gatewayOrderId,
      gatewayPaymentId: d.gatewayPaymentId ?? null,
      amount: num(d.amount, 0)!,
      currency: d.currency ?? "INR",
      status: shopPaymentStatus(d.status),
      idempotencyKey: d.idempotencyKey,
      gatewayResponse: d.gatewayResponse ?? {},
      attemptNumber: num(d.attemptNumber, 1)!,
      lastRetryAt: date(d.lastRetryAt),
      createdAt: date(d.createdAt) ?? new Date(),
      updatedAt: date(d.updatedAt) ?? new Date(),
      ...(d.webhookData ? { webhookData: d.webhookData } : {}),
    })),
  });
  console.log(`  shopPaymentTransactions: ${docs.length}`);
}

// ===========================================================================
// BATCH 8 — support tickets (parent + notes)
// ===========================================================================
async function migrateSupportTickets(db: Db) {
  const docs = await all(db, "supporttickets");
  for (const d of docs) {
    await prisma.supportTicket.create({
      data: {
        id: String(d._id),
        userId: oid(d.userId),
        requesterName: d.requesterName ?? null,
        requesterEmail: d.requesterEmail ?? null,
        requesterPhone: d.requesterPhone ?? null,
        requesterType: supportRequesterType(d.requesterType),
        subject: d.subject,
        description: d.description,
        category: supportCategory(d.category),
        status: supportStatus(d.status),
        priority: supportPriority(d.priority),
        assignedAdminId: oid(d.assignedAdminId),
        lastUpdatedBy: oid(d.lastUpdatedBy),
        createdAt: date(d.createdAt) ?? new Date(),
        updatedAt: date(d.updatedAt) ?? new Date(),
        notes: {
          create: (d.notes ?? []).map((n: any) => ({
            ...(n._id ? { id: String(n._id) } : {}),
            authorType: supportNoteAuthor(n.authorType),
            authorId: String(n.authorId),
            message: n.message,
            createdAt: date(n.createdAt) ?? new Date(),
          })),
        },
      },
    });
  }
  console.log(`  supportTickets (+notes): ${docs.length}`);
}

const RUN_ORDER: Array<{ name: string; fn: (db: Db) => Promise<void> }> = [
  { name: "sports", fn: migrateSports },
  { name: "users", fn: migrateUsers },
  { name: "coaches", fn: migrateCoaches },
  { name: "venues", fn: migrateVenues },
  { name: "bookings", fn: migrateBookings },
  { name: "wallets", fn: migrateWallets },
  { name: "reviews", fn: migrateReviews },
  // -- Batch 1: bookings / notifications --
  { name: "bookingSlotLocks", fn: migrateBookingSlotLocks },
  { name: "bookingWaitlists", fn: migrateBookingWaitlists },
  { name: "bookingInvitations", fn: migrateBookingInvitations },
  { name: "bookingPayments", fn: migrateBookingPayments },
  { name: "notifications", fn: migrateNotifications },
  { name: "scheduledNotifications", fn: migrateScheduledNotifications },
  { name: "friendConnections", fn: migrateFriendConnections },
  { name: "userCalendarEvents", fn: migrateUserCalendarEvents },
  { name: "disputes", fn: migrateDisputes },
  { name: "venueInquiries", fn: migrateVenueInquiries },
  // -- Batch 2: coach subscriptions / plans / promos --
  { name: "coachSubscriptionPackages", fn: migrateCoachSubscriptionPackages },
  { name: "coachSubscriptions", fn: migrateCoachSubscriptions },
  { name: "coachSubscriptionPayments", fn: migrateCoachSubscriptionPayments },
  { name: "coachClientNotes", fn: migrateCoachClientNotes },
  { name: "subscriptionPlans", fn: migrateSubscriptionPlans },
  { name: "sessionPackages", fn: migrateSessionPackages },
  { name: "promoCodes", fn: migratePromoCodes },
  // -- Batch 3: players / admin / analytics / infra --
  { name: "players", fn: migratePlayers },
  { name: "admins", fn: migrateAdmins },
  { name: "adminAuditLogs", fn: migrateAdminAuditLogs },
  { name: "analyticsEvents", fn: migrateAnalyticsEvents },
  { name: "emailVerifications", fn: migrateEmailVerifications },
  { name: "outboxMessages", fn: migrateOutboxMessages },
  { name: "paymentWebhookEvents", fn: migratePaymentWebhookEvents },
  { name: "rateLimits", fn: migrateRateLimits },
  // -- Batch 4: pathways / discovery content --
  { name: "scholarships", fn: migrateScholarships },
  { name: "universities", fn: migrateUniversities },
  { name: "athleteStories", fn: migrateAthleteStories },
  { name: "tournaments", fn: migrateTournaments },
  { name: "tournamentEditions", fn: migrateTournamentEditions },
  { name: "sportPathways", fn: migrateSportPathways },
  { name: "sportBasePaths", fn: migrateSportBasePaths },
  { name: "sportStatePaths", fn: migrateSportStatePaths },
  { name: "pathwayExpertVerifications", fn: migratePathwayExpertVerifications },
  { name: "userPathwayProfiles", fn: migrateUserPathwayProfiles },
  // -- Batch 5: experts / guidance / roadmap / concierge --
  { name: "experts", fn: migrateExperts },
  { name: "expertSessions", fn: migrateExpertSessions },
  { name: "guidanceSubmissions", fn: migrateGuidanceSubmissions },
  { name: "guidanceChatSessions", fn: migrateGuidanceChatSessions },
  { name: "roadmapChatSessions", fn: migrateRoadmapChatSessions },
  { name: "conciergeRequests", fn: migrateConciergeRequests },
  // -- Batch 6: community (groups→conversations→messages; posts→answers) --
  { name: "communityProfiles", fn: migrateCommunityProfiles },
  { name: "communityReputations", fn: migrateCommunityReputations },
  { name: "communityVotes", fn: migrateCommunityVotes },
  { name: "communityGroups", fn: migrateCommunityGroups },
  { name: "communityConversations", fn: migrateCommunityConversations },
  { name: "communityMessages", fn: migrateCommunityMessages },
  { name: "communityPosts", fn: migrateCommunityPosts },
  { name: "communityAnswers", fn: migrateCommunityAnswers },
  { name: "communityReports", fn: migrateCommunityReports },
  // -- Batch 7: blog / academy / shop (posts→comments; products→orders/carts/wishlists) --
  { name: "blogPosts", fn: migrateBlogPosts },
  { name: "blogComments", fn: migrateBlogComments },
  { name: "blogLikes", fn: migrateBlogLikes },
  { name: "academies", fn: migrateAcademies },
  { name: "products", fn: migrateProducts },
  { name: "orders", fn: migrateOrders },
  { name: "carts", fn: migrateCarts },
  { name: "wishlists", fn: migrateWishlists },
  { name: "shopWaitlist", fn: migrateShopWaitlist },
  { name: "shopPaymentTransactions", fn: migrateShopPaymentTransactions },
  // -- Batch 8: support --
  { name: "supportTickets", fn: migrateSupportTickets },
  // All 63 non-core collections now wired (7 core + these). Sport pathways &
  // nested arrays stay Json per COVERAGE.md; enum casing normalized via makeEnum.
];

async function main() {
  const truncate = process.argv.includes("--truncate");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db();
  console.log(`🚚 ETL start (source=${db.databaseName}) truncate=${truncate}`);

  if (truncate) {
    console.log("🧹 Truncating all target tables (CASCADE)…");
    // Wipe every table in the public schema except Prisma's migration ledger,
    // so a re-run loads into a clean target without duplicate-PK crashes.
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log("✅ Target truncated.");
  }

  const failures: Array<{ step: string; error: string }> = [];
  for (const step of RUN_ORDER) {
    process.stdout.write(`→ ${step.name}\n`);
    try {
      await step.fn(db);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      console.error(`  ❌ ${step.name} failed: ${msg.split("\n")[0]}`);
      failures.push({ step: step.name, error: msg });
    }
  }

  if (failures.length) {
    console.log(`\n⚠️  ${failures.length} collection(s) failed to migrate:`);
    for (const f of failures) {
      console.log(`   - ${f.step}: ${f.error.split("\n")[0]}`);
    }
  } else {
    console.log("\n✅ All collections migrated with no step-level errors.");
  }

  await client.close();
  await prisma.$disconnect();
  console.log("✅ ETL complete.");
}

main().catch(async (e) => {
  console.error("❌ ETL failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});

export {
  migrateSports,
  migrateUsers,
  migrateCoaches,
  migrateVenues,
  migrateBookings,
  migrateWallets,
  migrateReviews,
};
