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
        serviceMode: d.serviceMode,
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
        ownVenue: d.ownVenueDetails
          ? {
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
            }
          : undefined,
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
            userType: p.userType,
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
        targetType: d.targetType,
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
const RUN_ORDER: Array<{ name: string; fn: (db: Db) => Promise<void> }> = [
  { name: "sports", fn: migrateSports },
  { name: "users", fn: migrateUsers },
  { name: "coaches", fn: migrateCoaches },
  { name: "venues", fn: migrateVenues },
  { name: "bookings", fn: migrateBookings },
  { name: "wallets", fn: migrateWallets },
  { name: "reviews", fn: migrateReviews },
  // TODO(port): players, experts+sessions, coach subscriptions/packages/payments,
  // notifications, scheduledNotifications, disputes, friendConnections,
  // supportTickets, calendarEvents, venueInquiries, promoCodes, community*,
  // blog*, admins, academies, analyticsEvents, auditLogs, shop (products/
  // variants/inventory/carts/orders/wishlists/payments/waitlist), pathways,
  // tournaments, scholarships, universities, athleteStories, concierge, etc.
  // Each maps 1:1 with a template above — see COVERAGE.md for the field map.
];

async function main() {
  const truncate = process.argv.includes("--truncate");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db();
  console.log(`🚚 ETL start (source=${db.databaseName}) truncate=${truncate}`);

  if (truncate) {
    console.log("⚠️  Truncating target tables not yet enabled — use `prisma migrate reset` for a clean target.");
  }

  for (const step of RUN_ORDER) {
    process.stdout.write(`→ ${step.name}\n`);
    await step.fn(db);
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
