-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Player', 'Parent', 'VenueLister', 'Coach', 'Academy', 'EXPERT', 'Admin', 'VENUE_ONBOARDING');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('Parent', 'Player', 'Coach', 'Academy', 'VenueLister', 'Admin', 'Expert');

-- CreateEnum
CREATE TYPE "RefundMethodType" AS ENUM ('ORIGINAL_CARD', 'BANK_ACCOUNT', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "PlayerType" AS ENUM ('SELF', 'DEPENDENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PrimaryObjective" AS ENUM ('Recreational', 'Fitness', 'Compete');

-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('Budget', 'Moderate', 'Premium');

-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('OWN_VENUE', 'FREELANCE', 'HYBRID');

-- CreateEnum
CREATE TYPE "CoachVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoachSubscriptionStatusOnCoach" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CoachDocumentType" AS ENUM ('CERTIFICATION', 'ID_PROOF', 'ADDRESS_PROOF', 'BACKGROUND_CHECK', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "VenueDocumentType" AS ENUM ('OWNERSHIP_PROOF', 'BUSINESS_REGISTRATION', 'TAX_DOCUMENT', 'INSURANCE', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "VenueApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVIEW');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_INVITES', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "BookingPaymentType" AS ENUM ('SINGLE', 'SPLIT');

-- CreateEnum
CREATE TYPE "SplitMethod" AS ENUM ('EQUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookingRefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentUserType" AS ENUM ('VenueLister', 'Coach', 'Player');

-- CreateEnum
CREATE TYPE "PaymentLegStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SlotLockResourceType" AS ENUM ('VENUE_SLOT', 'COACH_SLOT');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentTxnStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CoachSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'SESSION', 'INJURY', 'GOAL', 'PROGRESS');

-- CreateEnum
CREATE TYPE "PlanDuration" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('VENUE', 'Coach', 'PRODUCT');

-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('NO_SHOW', 'POOR_QUALITY', 'PAYMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeResolutionMethod" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DisputeRecommendedAction" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'NO_REFUND', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "DisputeConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTxnStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FriendConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SOCIAL', 'BOOKING', 'Admin', 'REVIEW', 'PAYMENT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ScheduledNotificationType" AS ENUM ('BOOKING_REMINDER', 'PATHWAY_DOCUMENT_REMINDER', 'PLAN_CHECKIN');

-- CreateEnum
CREATE TYPE "FederationType" AS ENUM ('govt', 'national', 'hybrid');

-- CreateEnum
CREATE TYPE "PlanCheckInSource" AS ENUM ('find_sport_trial', 'guidance_short_plan', 'guidance_journey');

-- CreateEnum
CREATE TYPE "PlanCheckInStatus" AS ENUM ('active', 'due', 'progressing', 'not_progressing', 'ambiguous', 'abandoned');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('requested', 'scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ScheduledNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportRequesterType" AS ENUM ('player', 'venue_owner', 'coach', 'academy_owner', 'other');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('BOOKING', 'PAYMENT', 'ACCOUNT', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportNoteAuthorType" AS ENUM ('USER', 'Admin');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('IMPORTANT', 'COMPETITION', 'TRAINING', 'REMINDER', 'OTHER');

-- CreateEnum
CREATE TYPE "VenueInquiryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpertSessionMode" AS ENUM ('ONLINE', 'IN_PERSON', 'BOTH');

-- CreateEnum
CREATE TYPE "ExpertVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpertSessionStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpertBookingMode" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "ExpertCanceller" AS ENUM ('CLIENT', 'EXPERT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExpertRefundStatus" AS ENUM ('NONE', 'REQUIRED', 'MANUAL_DONE');

-- CreateEnum
CREATE TYPE "ExpertAcceptance" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ExpertPayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('PUBLISHED', 'DRAFT');

-- CreateEnum
CREATE TYPE "BlogLikeTargetType" AS ENUM ('BLOG', 'COMMENT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DM', 'GROUP');

-- CreateEnum
CREATE TYPE "GroupMemberAddPolicy" AS ENUM ('ADMIN_ONLY', 'ANY_MEMBER');

-- CreateEnum
CREATE TYPE "GroupAudience" AS ENUM ('ALL', 'PLAYERS_ONLY', 'COACHES_ONLY');

-- CreateEnum
CREATE TYPE "CommunityMessageType" AS ENUM ('TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "CommunityPostStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessagePrivacy" AS ENUM ('EVERYONE', 'REQUEST_ONLY', 'NONE');

-- CreateEnum
CREATE TYPE "CommunityReportTargetType" AS ENUM ('MESSAGE', 'GROUP', 'POST', 'ANSWER');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommunityVoteTargetType" AS ENUM ('POST', 'ANSWER');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'ANALYTICS_ADMIN', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "AnalyticsSource" AS ENUM ('WEB', 'MOBILE', 'SERVER');

-- CreateEnum
CREATE TYPE "AcademyBusinessType" AS ENUM ('sole_proprietorship', 'partnership', 'pvt_ltd', 'ngo_trust');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CART', 'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShopPaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUND_INITIATED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PHONEPE');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('APPAREL', 'FOOTWEAR', 'ACCESSORIES', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "ProductSellerType" AS ENUM ('MERCHANT', 'PARENT', 'Player', 'Coach', 'ACADEMY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromoApplicableTo" AS ENUM ('ALL', 'VENUE_ONLY', 'COACH_ONLY', 'MERCHANDISE_ONLY');

-- CreateEnum
CREATE TYPE "RateLimitType" AS ENUM ('EMAIL_VERIFICATION', 'LOGIN', 'API');

-- CreateEnum
CREATE TYPE "ConciergeItemType" AS ENUM ('tournament', 'scholarship', 'university');

-- CreateEnum
CREATE TYPE "ConciergeStatus" AS ENUM ('pending', 'processing', 'completed', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Player',
    "userType" "UserType" NOT NULL DEFAULT 'Player',
    "password" TEXT,
    "googleId" TEXT,
    "photoUrl" TEXT,
    "photoS3Key" TEXT,
    "city" TEXT,
    "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "dob" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suspensionReason" TEXT NOT NULL DEFAULT '',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "defaultAddressId" TEXT,
    "legalConsents" JSONB,
    "notificationPreferences" JSONB,
    "reminderPreferences" JSONB,
    "shippingAddress" JSONB,
    "parentProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_refund_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RefundMethodType" NOT NULL DEFAULT 'ORIGINAL_CARD',
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_refund_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PlayerType" NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "dob" TIMESTAMP(3),
    "gender" "Gender",
    "relation" TEXT,
    "sportsFocus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skillLevel" TEXT,
    "yearsPlaying" INTEGER,
    "personalityTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryObjective" "PrimaryObjective",
    "weeklyTimeCommitment" INTEGER,
    "budgetTier" "BudgetTier",
    "location" TEXT,
    "psSatisfiedPrereqs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "psCurrentGpa" DOUBLE PRECISION,
    "psTargetDivision" TEXT,
    "psGraduationYear" INTEGER,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "build" TEXT,
    "heightCategory" TEXT,
    "energyType" TEXT,
    "motorType" TEXT,
    "visualTracking" TEXT,
    "teamIndividual" INTEGER,
    "competitiveResponse" TEXT,
    "focusStyle" TEXT,
    "decisionStyle" TEXT,
    "pressureResponse" TEXT,
    "repetitionTolerance" TEXT,
    "contactComfort" TEXT,
    "environment" TEXT,
    "waterComfort" TEXT,
    "budgetRange" TEXT,
    "ambition" TEXT,
    "eyesight" TEXT,
    "agility" TEXT,
    "weeklyHoursCategory" TEXT,
    "experienceLevel" TEXT,
    "trainingType" TEXT,
    "wizardCity" TEXT,
    "sportMatches" JSONB NOT NULL DEFAULT '[]',
    "wizardCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_payment_history" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amount" INTEGER,
    "date" TIMESTAMP(3),

    CONSTRAINT "player_payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sports" TEXT[],
    "hourlyRate" INTEGER NOT NULL,
    "serviceMode" "ServiceMode" NOT NULL,
    "serviceRadiusKm" INTEGER,
    "travelBufferTime" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "CoachVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNotes" TEXT NOT NULL DEFAULT '',
    "onboardingProgressStep" INTEGER NOT NULL DEFAULT 1,
    "activeSubscriptionId" TEXT,
    "subscriptionStatus" "CoachSubscriptionStatusOnCoach" NOT NULL DEFAULT 'NONE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "verificationSubmittedAt" TIMESTAMP(3),
    "lastVerificationReminderAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "baseLng" DOUBLE PRECISION,
    "baseLat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_own_venues" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "lng" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricePerHour" INTEGER,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageS3Keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openingHours" TEXT,

    CONSTRAINT "coach_own_venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_sport_pricing" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "coach_sport_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "coach_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_sport_availability" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "coach_sport_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_documents" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "type" "CoachDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "s3Key" TEXT,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_blocked_dates" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_payout_methods" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "type" "PayoutMethodType" NOT NULL,
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricePerHour" INTEGER NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generalImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generalImageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverPhotoUrl" TEXT,
    "coverPhotoKey" TEXT,
    "allowExternalCoaches" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "VenueApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewNotes" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "hasCoaches" BOOLEAN NOT NULL DEFAULT false,
    "lng" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sport_pricing" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "venue_sport_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sport_images" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "venue_sport_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_opening_hours" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '21:00',
    "slots" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "venue_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_coaches" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "hourlyRate" INTEGER NOT NULL,
    "bio" TEXT,

    CONSTRAINT "venue_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_documents" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" "VenueDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "s3Key" TEXT,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_payout_methods" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" "PayoutMethodType" NOT NULL,
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT,
    "coachId" TEXT,
    "academyId" TEXT,
    "sport" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "expiresAt" TIMESTAMP(3),
    "checkInCode" TEXT,
    "participantName" TEXT NOT NULL,
    "participantId" TEXT,
    "participantAge" INTEGER,
    "paymentConfirmedAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundAmount" INTEGER,
    "refundStatus" "BookingRefundStatus",
    "bookingType" "BookingType" NOT NULL DEFAULT 'INDIVIDUAL',
    "organizerId" TEXT NOT NULL,
    "paymentType" "BookingPaymentType" NOT NULL DEFAULT 'SINGLE',
    "splitMethod" "SplitMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payment_legs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" "PaymentUserType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentLegStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "booking_payment_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slot_locks" (
    "id" TEXT NOT NULL,
    "resourceType" "SlotLockResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastLockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_slot_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_waitlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT,
    "coachId" TEXT,
    "sport" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "alternateSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_waitlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_invitations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "coachId" TEXT,
    "sport" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "estimatedAmount" INTEGER NOT NULL,
    "status" "BookingInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payment_transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantOrderId" TEXT NOT NULL,
    "phonepeOrderId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentTxnStatus" NOT NULL DEFAULT 'PENDING',
    "state" TEXT,
    "redirectUrl" TEXT,
    "callbackPayload" JSONB,
    "lastStatusPayload" JSONB,
    "refundMerchantId" TEXT,
    "refundId" TEXT,
    "refundState" TEXT,
    "refundAmount" INTEGER,
    "refundResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_subscriptions" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dependentId" TEXT,
    "packageId" TEXT NOT NULL,
    "status" "CoachSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_subscription_packages" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "frequency" "SubscriptionFrequency" NOT NULL,
    "price" INTEGER NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxStudents" INTEGER,
    "maxSessions" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_subscription_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_subscription_payment_transactions" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dependentId" TEXT,
    "packageId" TEXT NOT NULL,
    "merchantOrderId" TEXT NOT NULL,
    "phonepeOrderId" TEXT,
    "linkedSubscriptionId" TEXT,
    "baseAmount" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "status" "PaymentTxnStatus" NOT NULL DEFAULT 'PENDING',
    "state" TEXT,
    "redirectUrl" TEXT,
    "callbackPayload" JSONB,
    "lastStatusPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_subscription_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_client_notes" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "noteType" "NoteType" NOT NULL DEFAULT 'GENERAL',
    "sessionDate" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration" "PlanDuration" NOT NULL,
    "price" INTEGER NOT NULL,
    "includesVenue" BOOLEAN NOT NULL DEFAULT false,
    "includesCoaching" BOOLEAN NOT NULL DEFAULT true,
    "maxSessions" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_packages" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "sport" TEXT NOT NULL,
    "coachId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "moderationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT,
    "disputeType" "DisputeType" NOT NULL,
    "disputeDetails" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionMethod" "DisputeResolutionMethod",
    "recommendedAction" "DisputeRecommendedAction",
    "refundPercentage" INTEGER NOT NULL DEFAULT 0,
    "reasoning" TEXT,
    "confidence" "DisputeConfidence",
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "WalletTxnStatus" NOT NULL DEFAULT 'COMPLETED',
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_connections" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "FriendConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ScheduledNotificationType" NOT NULL DEFAULT 'BOOKING_REMINDER',
    "interval" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "bookingId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "chEmail" BOOLEAN NOT NULL DEFAULT false,
    "chPush" BOOLEAN NOT NULL DEFAULT false,
    "chInApp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "requesterType" "SupportRequesterType" NOT NULL DEFAULT 'other',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL DEFAULT 'OTHER',
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedAdminId" TEXT,
    "lastUpdatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_notes" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "SupportNoteAuthorType" NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_calendar_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "type" "CalendarEventType" NOT NULL DEFAULT 'IMPORTANT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_inquiries" (
    "id" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "sports" TEXT NOT NULL,
    "message" TEXT,
    "status" "VenueInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "achievements" TEXT,
    "sessionFee" INTEGER NOT NULL,
    "sessionMode" "ExpertSessionMode" NOT NULL DEFAULT 'ONLINE',
    "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "blackoutDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoUrl" TEXT,
    "photoKey" TEXT,
    "inPersonAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "ExpertVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "rejectionReason" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_availability_windows" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "expert_availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_payout_methods" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "type" "PayoutMethodType" NOT NULL,
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_sessions" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ExpertSessionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentTxnStatus" NOT NULL DEFAULT 'PENDING',
    "merchantOrderId" TEXT NOT NULL,
    "phonepeOrderId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "holdExpiresAt" TIMESTAMP(3),
    "mode" "ExpertBookingMode",
    "meetingLink" TEXT,
    "clientNote" TEXT,
    "callbackPayload" JSONB,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" "ExpertCanceller",
    "cancelReason" TEXT,
    "refundStatus" "ExpertRefundStatus" NOT NULL DEFAULT 'NONE',
    "cancellationNoticeHours" INTEGER,
    "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "expertAcceptance" "ExpertAcceptance" NOT NULL DEFAULT 'PENDING',
    "expertRespondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "payoutStatus" "ExpertPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutPaidAt" TIMESTAMP(3),
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "review" TEXT,
    "reviewAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "reviewHidden" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewReminderSentAt" TIMESTAMP(3),
    "meetingLinkNudgeSentAt" TIMESTAMP(3),
    "startReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guidance_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_chat_sessions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guidance_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidance_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "title" TEXT,
    "totalMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anonymousAlias" TEXT NOT NULL,
    "isIdentityPublic" BOOLEAN NOT NULL DEFAULT true,
    "messagePrivacy" "MessagePrivacy" NOT NULL DEFAULT 'EVERYONE',
    "readReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenVisible" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "username" TEXT,
    "bio" TEXT NOT NULL DEFAULT '',
    "slYoutube" TEXT NOT NULL DEFAULT '',
    "slInstagram" TEXT NOT NULL DEFAULT '',
    "slFacebook" TEXT NOT NULL DEFAULT '',
    "slTwitter" TEXT NOT NULL DEFAULT '',
    "slGithub" TEXT NOT NULL DEFAULT '',
    "slWebsite" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_blocked_users" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,

    CONSTRAINT "community_blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reputations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "receivedUpvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sport" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "voteScore" INTEGER NOT NULL DEFAULT 0,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "downvoteCount" INTEGER NOT NULL DEFAULT 0,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'OPEN',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_answers" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "voteScore" INTEGER NOT NULL DEFAULT 0,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "downvoteCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "CommunityVoteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "sport" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "profilePicture" TEXT NOT NULL DEFAULT '',
    "profilePictureKey" TEXT NOT NULL DEFAULT '',
    "memberAddPolicy" "GroupMemberAddPolicy" NOT NULL DEFAULT 'ADMIN_ONLY',
    "audience" "GroupAudience" NOT NULL DEFAULT 'ALL',
    "createdBy" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "community_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_conversations" (
    "id" TEXT NOT NULL,
    "conversationType" "ConversationType" NOT NULL DEFAULT 'DM',
    "groupId" TEXT,
    "participantKey" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "requestedBy" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "CommunityMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "metaWidth" INTEGER,
    "metaHeight" INTEGER,
    "metaCaption" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_delivery_receipts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reports" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "CommunityReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "maSenderId" TEXT,
    "maCreatedAt" TIMESTAMP(3),
    "maUpdatedAt" TIMESTAMP(3),
    "maEditedAt" TIMESTAMP(3),
    "maDeletedAt" TIMESTAMP(3),
    "maWasEdited" BOOLEAN NOT NULL DEFAULT false,
    "maWasDeleted" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "coverImageKey" TEXT,
    "coverImageUrl" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'General',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL DEFAULT '',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "BlogLikeTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_ADMIN',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "eventName" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source" "AnalyticsSource" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "establishedYear" INTEGER,
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "coverPhotoUrl" TEXT,
    "coverPhotoKey" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sports" TEXT[],
    "ageGroups" TEXT[],
    "lng" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "placeId" TEXT,
    "panNumber" TEXT NOT NULL DEFAULT '',
    "panDocumentUrl" TEXT NOT NULL DEFAULT '',
    "panDocumentKey" TEXT,
    "businessType" "AcademyBusinessType" NOT NULL DEFAULT 'sole_proprietorship',
    "gstNumber" TEXT,
    "gstDocumentUrl" TEXT,
    "gstDocumentKey" TEXT,
    "msmeRegistration" TEXT,
    "sportsAuthorityAffiliation" TEXT,
    "aadhaarLast4" TEXT NOT NULL DEFAULT '',
    "operatingHours" JSONB,
    "languagesSpoken" TEXT[],
    "whatsappNumber" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactPersonName" TEXT NOT NULL,
    "allowsExternalCoaches" BOOLEAN NOT NULL DEFAULT false,
    "maxBatchSize" INTEGER NOT NULL,
    "batchTimings" TEXT[],
    "academyVenues" JSONB NOT NULL DEFAULT '[]',
    "academyCoaches" JSONB NOT NULL DEFAULT '[]',
    "ownerId" TEXT,
    "venueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coachIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionRatePerHour" INTEGER NOT NULL DEFAULT 0,
    "trialsessionOffered" BOOLEAN NOT NULL DEFAULT false,
    "trialSessionPrice" INTEGER,
    "subscriptionPlanIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionPackageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "bankIfsc" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "upiId" TEXT NOT NULL DEFAULT '',
    "payoutFrequency" "PayoutFrequency" NOT NULL DEFAULT 'weekly',
    "cancellationPolicy" TEXT NOT NULL DEFAULT '',
    "refundPolicy" TEXT NOT NULL DEFAULT '',
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "material" TEXT,
    "warranty" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageGroup" TEXT,
    "skillLevel" TEXT,
    "gender" TEXT,
    "category" "ProductCategory" NOT NULL,
    "images" TEXT[],
    "basePrice" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL,
    "dimLength" DOUBLE PRECISION NOT NULL,
    "dimWidth" DOUBLE PRECISION NOT NULL,
    "dimHeight" DOUBLE PRECISION NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "totalStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "seller" TEXT,
    "sellerName" TEXT,
    "sellerType" "ProductSellerType" NOT NULL DEFAULT 'SYSTEM',
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "lastStockCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "appliedPromoCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "reservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "shippingAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentMethod" TEXT NOT NULL,
    "paymentGateway" "PaymentGateway" NOT NULL,
    "paymentGatewayOrderId" TEXT,
    "paymentGatewayPaymentId" TEXT,
    "paymentStatus" "ShopPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "appliedPromoCode" TEXT,
    "promoDiscountAmount" INTEGER NOT NULL DEFAULT 0,
    "shipFullName" TEXT,
    "shipEmail" TEXT,
    "shipPhone" TEXT,
    "shipAddressLine1" TEXT,
    "shipAddressLine2" TEXT,
    "shipCity" TEXT,
    "shipState" TEXT,
    "shipPostalCode" TEXT,
    "shipCountry" TEXT DEFAULT 'IN',
    "estimatedDeliveryDate" TIMESTAMP(3),
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "sellerId" TEXT,
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_payment_transactions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentGateway" "PaymentGateway" NOT NULL,
    "gatewayOrderId" TEXT NOT NULL,
    "gatewayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "ShopPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "gatewayResponse" JSONB NOT NULL DEFAULT '{}',
    "webhookData" JSONB,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_waitlists" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_waitlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "applicableTo" "PromoApplicableTo" NOT NULL DEFAULT 'ALL',
    "minBookingAmount" INTEGER,
    "maxDiscountAmount" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUsageTotal" INTEGER,
    "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
    "currentUsageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_usages" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "orderId" TEXT,
    "discountApplied" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "RateLimitType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Other',
    "attrInteractionType" TEXT,
    "attrDemand" TEXT,
    "attrContactLevel" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarships" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "city" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL,
    "prerequisiteId" TEXT,
    "prerequisiteName" TEXT,
    "prerequisiteGuide" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentChecklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "city" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "admissionCriteria" TEXT NOT NULL,
    "sportsQuotaDetails" TEXT NOT NULL,
    "prerequisiteId" TEXT,
    "prerequisiteName" TEXT,
    "prerequisiteGuide" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentChecklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_stories" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "achievement" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "parentNote" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastScrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "city" TEXT,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "prerequisiteId" TEXT,
    "prerequisiteName" TEXT,
    "prerequisiteGuide" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentChecklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "typicalDates" TEXT,
    "registrationDeadline" TEXT,
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slug" TEXT,
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "fedName" TEXT,
    "fedAcronym" TEXT,
    "fedWebsite" TEXT,
    "fedType" TEXT,
    "fedAbout" TEXT,
    "participationGuide" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualificationPath" TEXT,
    "format" TEXT,
    "prestige" TEXT,
    "prizePool" TEXT,
    "registrationUrl" TEXT,
    "entryFee" TEXT,
    "selectionCriteria" TEXT,
    "prizes" TEXT,
    "keyFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "circuitContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_editions" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "editionYear" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "registrationDeadlineDate" TIMESTAMP(3),
    "venue" TEXT,
    "city" TEXT,
    "level" TEXT,
    "ageGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'announced',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concierge_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "itemType" TEXT,
    "itemId" TEXT,
    "itemName" TEXT,
    "tournamentId" TEXT,
    "tournamentName" TEXT,
    "prerequisiteId" TEXT,
    "prerequisiteName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concierge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concierge_request_documents" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,

    CONSTRAINT "concierge_request_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathway_expert_verifications" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "sportName" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "expertName" TEXT NOT NULL,
    "expertPhotoUrl" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathway_expert_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_pathway_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dependentId" TEXT,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "savedItems" JSONB NOT NULL DEFAULT '[]',
    "applications" JSONB NOT NULL DEFAULT '[]',
    "reminders" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pathway_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_pathways" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "sportName" TEXT NOT NULL,
    "cacheKey" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "overview" TEXT NOT NULL DEFAULT '',
    "progressionPlan" JSONB,
    "levels" JSONB NOT NULL DEFAULT '[]',
    "tournaments" JSONB NOT NULL DEFAULT '[]',
    "scholarships" JSONB NOT NULL DEFAULT '[]',
    "universities" JSONB NOT NULL DEFAULT '[]',
    "equipment" JSONB NOT NULL DEFAULT '[]',
    "careers" JSONB NOT NULL DEFAULT '[]',
    "tournamentsVerifiedEmpty" BOOLEAN NOT NULL DEFAULT false,
    "scholarshipsVerifiedEmpty" BOOLEAN NOT NULL DEFAULT false,
    "universitiesVerifiedEmpty" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "lookupCount" INTEGER NOT NULL DEFAULT 1,
    "contentRefreshedAt" TIMESTAMP(3),
    "financialDataRefreshedAt" TIMESTAMP(3),
    "contentRefreshInProgress" BOOLEAN NOT NULL DEFAULT false,
    "financialRefreshInProgress" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sport_pathways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_base_paths" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "sportName" TEXT NOT NULL,
    "category" TEXT,
    "overview" TEXT NOT NULL,
    "levels" JSONB NOT NULL DEFAULT '[]',
    "equipment" JSONB NOT NULL DEFAULT '[]',
    "careers" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sport_base_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_state_paths" (
    "id" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "stateSlug" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "saName" TEXT,
    "saAcronym" TEXT,
    "saWebsite" TEXT,
    "saContact" TEXT,
    "topAcademies" JSONB NOT NULL DEFAULT '[]',
    "feeMonthly" TEXT,
    "feeEquipment" TEXT,
    "feeTournaments" TEXT,
    "governmentSchemes" JSONB NOT NULL DEFAULT '[]',
    "regionalCalendar" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sport_state_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "sportSlug" TEXT NOT NULL,
    "type" "FederationType" NOT NULL,
    "about" TEXT NOT NULL,
    "founded" INTEGER,
    "headquarters" TEXT,
    "website" TEXT,
    "officialCalendarUrl" TEXT,
    "socialLinks" JSONB,
    "affiliations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stateAssociations" JSONB NOT NULL DEFAULT '[]',
    "keyFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibilityCriteria" JSONB,
    "registrationSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact" JSONB,
    "dataVerifiedAt" TIMESTAMP(3),
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_check_ins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dependentId" TEXT,
    "source" "PlanCheckInSource" NOT NULL,
    "sourceId" TEXT,
    "sport" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkInDueAt" TIMESTAMP(3) NOT NULL,
    "status" "PlanCheckInStatus" NOT NULL DEFAULT 'active',
    "outcomeNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_requests" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "dependentName" TEXT NOT NULL,
    "sport" TEXT,
    "phone" TEXT NOT NULL,
    "preferredTime" TEXT,
    "city" TEXT,
    "status" "ScreeningStatus" NOT NULL DEFAULT 'requested',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_lastActiveAt_idx" ON "users"("lastActiveAt");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "user_addresses_userId_idx" ON "user_addresses"("userId");

-- CreateIndex
CREATE INDEX "user_push_subscriptions_userId_idx" ON "user_push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "user_refund_methods_userId_idx" ON "user_refund_methods"("userId");

-- CreateIndex
CREATE INDEX "players_userId_idx" ON "players"("userId");

-- CreateIndex
CREATE INDEX "player_payment_history_playerId_idx" ON "player_payment_history"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_userId_key" ON "coaches"("userId");

-- CreateIndex
CREATE INDEX "coaches_serviceMode_idx" ON "coaches"("serviceMode");

-- CreateIndex
CREATE INDEX "coaches_isVerified_idx" ON "coaches"("isVerified");

-- CreateIndex
CREATE INDEX "coaches_verificationStatus_idx" ON "coaches"("verificationStatus");

-- CreateIndex
CREATE INDEX "coaches_subscriptionStatus_idx" ON "coaches"("subscriptionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "coach_own_venues_coachId_key" ON "coach_own_venues"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "coach_sport_pricing_coachId_sport_key" ON "coach_sport_pricing"("coachId", "sport");

-- CreateIndex
CREATE INDEX "coach_availability_coachId_idx" ON "coach_availability"("coachId");

-- CreateIndex
CREATE INDEX "coach_sport_availability_coachId_sport_idx" ON "coach_sport_availability"("coachId", "sport");

-- CreateIndex
CREATE INDEX "coach_documents_coachId_idx" ON "coach_documents"("coachId");

-- CreateIndex
CREATE INDEX "coach_blocked_dates_coachId_idx" ON "coach_blocked_dates"("coachId");

-- CreateIndex
CREATE INDEX "coach_payout_methods_coachId_idx" ON "coach_payout_methods"("coachId");

-- CreateIndex
CREATE INDEX "venues_ownerId_createdAt_idx" ON "venues"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "venues_ownerEmail_approvalStatus_idx" ON "venues"("ownerEmail", "approvalStatus");

-- CreateIndex
CREATE INDEX "venues_approvalStatus_createdAt_idx" ON "venues"("approvalStatus", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "venue_sport_pricing_venueId_sport_key" ON "venue_sport_pricing"("venueId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "venue_sport_images_venueId_sport_key" ON "venue_sport_images"("venueId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "venue_opening_hours_venueId_day_key" ON "venue_opening_hours"("venueId", "day");

-- CreateIndex
CREATE INDEX "venue_coaches_venueId_idx" ON "venue_coaches"("venueId");

-- CreateIndex
CREATE INDEX "venue_documents_venueId_idx" ON "venue_documents"("venueId");

-- CreateIndex
CREATE INDEX "venue_payout_methods_venueId_idx" ON "venue_payout_methods"("venueId");

-- CreateIndex
CREATE INDEX "bookings_venueId_date_startTime_endTime_idx" ON "bookings"("venueId", "date", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "bookings_coachId_date_startTime_endTime_idx" ON "bookings"("coachId", "date", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "bookings_expiresAt_status_idx" ON "bookings"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "bookings_checkInCode_idx" ON "bookings"("checkInCode");

-- CreateIndex
CREATE INDEX "bookings_userId_status_date_idx" ON "bookings"("userId", "status", "date" DESC);

-- CreateIndex
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "booking_payment_legs_bookingId_idx" ON "booking_payment_legs"("bookingId");

-- CreateIndex
CREATE INDEX "booking_participants_bookingId_idx" ON "booking_participants"("bookingId");

-- CreateIndex
CREATE INDEX "booking_slot_locks_lastLockedAt_idx" ON "booking_slot_locks"("lastLockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_slot_locks_resourceType_resourceId_dateKey_key" ON "booking_slot_locks"("resourceType", "resourceId", "dateKey");

-- CreateIndex
CREATE INDEX "booking_waitlists_userId_idx" ON "booking_waitlists"("userId");

-- CreateIndex
CREATE INDEX "booking_waitlists_venueId_idx" ON "booking_waitlists"("venueId");

-- CreateIndex
CREATE INDEX "booking_waitlists_coachId_idx" ON "booking_waitlists"("coachId");

-- CreateIndex
CREATE INDEX "booking_waitlists_date_idx" ON "booking_waitlists"("date");

-- CreateIndex
CREATE INDEX "booking_waitlists_status_idx" ON "booking_waitlists"("status");

-- CreateIndex
CREATE INDEX "booking_invitations_inviteeId_status_idx" ON "booking_invitations"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "booking_invitations_bookingId_idx" ON "booking_invitations"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_payment_transactions_merchantOrderId_key" ON "booking_payment_transactions"("merchantOrderId");

-- CreateIndex
CREATE INDEX "booking_payment_transactions_bookingId_userId_idx" ON "booking_payment_transactions"("bookingId", "userId");

-- CreateIndex
CREATE INDEX "coach_subscriptions_coachId_status_idx" ON "coach_subscriptions"("coachId", "status");

-- CreateIndex
CREATE INDEX "coach_subscriptions_userId_status_idx" ON "coach_subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "coach_subscriptions_dependentId_idx" ON "coach_subscriptions"("dependentId");

-- CreateIndex
CREATE INDEX "coach_subscriptions_packageId_idx" ON "coach_subscriptions"("packageId");

-- CreateIndex
CREATE INDEX "coach_subscriptions_nextBillingDate_idx" ON "coach_subscriptions"("nextBillingDate");

-- CreateIndex
CREATE INDEX "coach_subscription_packages_coachId_isActive_idx" ON "coach_subscription_packages"("coachId", "isActive");

-- CreateIndex
CREATE INDEX "coach_subscription_packages_coachId_frequency_idx" ON "coach_subscription_packages"("coachId", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "coach_subscription_payment_transactions_merchantOrderId_key" ON "coach_subscription_payment_transactions"("merchantOrderId");

-- CreateIndex
CREATE INDEX "coach_subscription_payment_transactions_coachId_userId_crea_idx" ON "coach_subscription_payment_transactions"("coachId", "userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "coach_client_notes_coachId_clientId_createdAt_idx" ON "coach_client_notes"("coachId", "clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "subscription_plans_academyId_idx" ON "subscription_plans"("academyId");

-- CreateIndex
CREATE INDEX "subscription_plans_academyId_isActive_idx" ON "subscription_plans"("academyId", "isActive");

-- CreateIndex
CREATE INDEX "session_packages_academyId_idx" ON "session_packages"("academyId");

-- CreateIndex
CREATE INDEX "session_packages_academyId_isActive_idx" ON "session_packages"("academyId", "isActive");

-- CreateIndex
CREATE INDEX "session_packages_sport_idx" ON "session_packages"("sport");

-- CreateIndex
CREATE INDEX "reviews_targetType_targetId_createdAt_idx" ON "reviews"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex
CREATE INDEX "reviews_moderationStatus_reportCount_idx" ON "reviews"("moderationStatus", "reportCount" DESC);

-- CreateIndex
CREATE INDEX "review_reports_reviewId_idx" ON "review_reports"("reviewId");

-- CreateIndex
CREATE INDEX "disputes_bookingId_idx" ON "disputes"("bookingId");

-- CreateIndex
CREATE INDEX "disputes_userId_idx" ON "disputes"("userId");

-- CreateIndex
CREATE INDEX "disputes_disputeType_idx" ON "disputes"("disputeType");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "friend_connections_recipientId_status_idx" ON "friend_connections"("recipientId", "status");

-- CreateIndex
CREATE INDEX "friend_connections_requesterId_status_idx" ON "friend_connections"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friend_connections_requesterId_recipientId_key" ON "friend_connections"("requesterId", "recipientId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_category_createdAt_idx" ON "notifications"("userId", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_expiresAt_idx" ON "notifications"("expiresAt");

-- CreateIndex
CREATE INDEX "scheduled_notifications_status_scheduledFor_idx" ON "scheduled_notifications"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "scheduled_notifications_bookingId_interval_idx" ON "scheduled_notifications"("bookingId", "interval");

-- CreateIndex
CREATE INDEX "scheduled_notifications_userId_type_status_idx" ON "scheduled_notifications"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "scheduled_notifications_sentAt_idx" ON "scheduled_notifications"("sentAt");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_requesterType_idx" ON "support_tickets"("requesterType");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_assignedAdminId_idx" ON "support_tickets"("assignedAdminId");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_updatedAt_idx" ON "support_tickets"("status", "priority" DESC, "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "support_ticket_notes_ticketId_idx" ON "support_ticket_notes"("ticketId");

-- CreateIndex
CREATE INDEX "user_calendar_events_userId_date_idx" ON "user_calendar_events"("userId", "date");

-- CreateIndex
CREATE INDEX "venue_inquiries_phone_idx" ON "venue_inquiries"("phone");

-- CreateIndex
CREATE INDEX "venue_inquiries_status_idx" ON "venue_inquiries"("status");

-- CreateIndex
CREATE INDEX "venue_inquiries_createdAt_idx" ON "venue_inquiries"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "experts_userId_key" ON "experts"("userId");

-- CreateIndex
CREATE INDEX "experts_isActive_rating_idx" ON "experts"("isActive", "rating" DESC);

-- CreateIndex
CREATE INDEX "experts_city_idx" ON "experts"("city");

-- CreateIndex
CREATE INDEX "experts_verificationStatus_idx" ON "experts"("verificationStatus");

-- CreateIndex
CREATE INDEX "expert_availability_windows_expertId_idx" ON "expert_availability_windows"("expertId");

-- CreateIndex
CREATE INDEX "expert_payout_methods_expertId_idx" ON "expert_payout_methods"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "expert_sessions_merchantOrderId_key" ON "expert_sessions"("merchantOrderId");

-- CreateIndex
CREATE INDEX "expert_sessions_expertId_status_createdAt_idx" ON "expert_sessions"("expertId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "expert_sessions_userId_createdAt_idx" ON "expert_sessions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "expert_sessions_expertId_scheduledAt_status_idx" ON "expert_sessions"("expertId", "scheduledAt", "status");

-- CreateIndex
CREATE INDEX "expert_sessions_status_payoutStatus_completedAt_idx" ON "expert_sessions"("status", "payoutStatus", "completedAt");

-- CreateIndex
CREATE INDEX "expert_sessions_status_scheduledAt_idx" ON "expert_sessions"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "guidance_submissions_createdAt_idx" ON "guidance_submissions"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "guidance_chat_sessions_submissionId_userId_key" ON "guidance_chat_sessions"("submissionId", "userId");

-- CreateIndex
CREATE INDEX "guidance_chat_messages_sessionId_idx" ON "guidance_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "roadmap_chat_sessions_userId_sportSlug_idx" ON "roadmap_chat_sessions"("userId", "sportSlug");

-- CreateIndex
CREATE INDEX "roadmap_chat_sessions_userId_updatedAt_idx" ON "roadmap_chat_sessions"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "roadmap_chat_messages_sessionId_idx" ON "roadmap_chat_messages"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "community_profiles_userId_key" ON "community_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_profiles_username_key" ON "community_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "community_blocked_users_profileId_blockedUserId_key" ON "community_blocked_users"("profileId", "blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "community_reputations_userId_key" ON "community_reputations"("userId");

-- CreateIndex
CREATE INDEX "community_reputations_totalPoints_updatedAt_idx" ON "community_reputations"("totalPoints" DESC, "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "community_posts_authorId_idx" ON "community_posts"("authorId");

-- CreateIndex
CREATE INDEX "community_posts_category_idx" ON "community_posts"("category");

-- CreateIndex
CREATE INDEX "community_posts_isAnonymous_idx" ON "community_posts"("isAnonymous");

-- CreateIndex
CREATE INDEX "community_posts_voteScore_idx" ON "community_posts"("voteScore");

-- CreateIndex
CREATE INDEX "community_posts_answerCount_idx" ON "community_posts"("answerCount");

-- CreateIndex
CREATE INDEX "community_posts_status_idx" ON "community_posts"("status");

-- CreateIndex
CREATE INDEX "community_posts_isDeleted_idx" ON "community_posts"("isDeleted");

-- CreateIndex
CREATE INDEX "community_posts_createdAt_idx" ON "community_posts"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_posts_voteScore_createdAt_idx" ON "community_posts"("voteScore" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_posts_status_isDeleted_createdAt_idx" ON "community_posts"("status", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_answers_postId_createdAt_idx" ON "community_answers"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "community_answers_postId_voteScore_createdAt_idx" ON "community_answers"("postId", "voteScore" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_answers_authorId_idx" ON "community_answers"("authorId");

-- CreateIndex
CREATE INDEX "community_answers_voteScore_idx" ON "community_answers"("voteScore");

-- CreateIndex
CREATE INDEX "community_answers_isDeleted_idx" ON "community_answers"("isDeleted");

-- CreateIndex
CREATE INDEX "community_votes_targetType_targetId_idx" ON "community_votes"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "community_votes_userId_targetType_targetId_key" ON "community_votes"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "community_groups_inviteCode_key" ON "community_groups"("inviteCode");

-- CreateIndex
CREATE INDEX "community_groups_visibility_updatedAt_idx" ON "community_groups"("visibility", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "community_group_members_userId_idx" ON "community_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_group_members_groupId_userId_key" ON "community_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "community_conversations_groupId_updatedAt_idx" ON "community_conversations"("groupId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "community_messages_conversationId_createdAt_idx" ON "community_messages"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_messages_conversationId_senderId_createdAt_idx" ON "community_messages"("conversationId", "senderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_messages_senderId_idx" ON "community_messages"("senderId");

-- CreateIndex
CREATE INDEX "community_messages_type_idx" ON "community_messages"("type");

-- CreateIndex
CREATE INDEX "community_messages_isDeleted_idx" ON "community_messages"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "message_read_receipts_messageId_userId_key" ON "message_read_receipts"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_delivery_receipts_messageId_userId_key" ON "message_delivery_receipts"("messageId", "userId");

-- CreateIndex
CREATE INDEX "community_reports_reporterUserId_idx" ON "community_reports"("reporterUserId");

-- CreateIndex
CREATE INDEX "community_reports_targetType_targetId_createdAt_idx" ON "community_reports"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_reports_status_idx" ON "community_reports"("status");

-- CreateIndex
CREATE INDEX "blog_posts_authorId_idx" ON "blog_posts"("authorId");

-- CreateIndex
CREATE INDEX "blog_posts_topic_idx" ON "blog_posts"("topic");

-- CreateIndex
CREATE INDEX "blog_posts_likeCount_idx" ON "blog_posts"("likeCount");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_isDeleted_idx" ON "blog_posts"("isDeleted");

-- CreateIndex
CREATE INDEX "blog_posts_createdAt_idx" ON "blog_posts"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_topic_createdAt_idx" ON "blog_posts"("topic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_authorId_createdAt_idx" ON "blog_posts"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_status_isDeleted_createdAt_idx" ON "blog_posts"("status", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "blog_comments_blogId_createdAt_idx" ON "blog_comments"("blogId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "blog_comments_blogId_parentId_createdAt_idx" ON "blog_comments"("blogId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "blog_comments_authorId_idx" ON "blog_comments"("authorId");

-- CreateIndex
CREATE INDEX "blog_comments_parentId_idx" ON "blog_comments"("parentId");

-- CreateIndex
CREATE INDEX "blog_comments_isDeleted_idx" ON "blog_comments"("isDeleted");

-- CreateIndex
CREATE INDEX "blog_likes_userId_idx" ON "blog_likes"("userId");

-- CreateIndex
CREATE INDEX "blog_likes_targetType_targetId_idx" ON "blog_likes"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_likes_userId_targetType_targetId_key" ON "blog_likes"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_isActive_idx" ON "admins"("isActive");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_createdAt_idx" ON "admin_audit_logs"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_guestId_idx" ON "analytics_events"("guestId");

-- CreateIndex
CREATE INDEX "analytics_events_eventName_idx" ON "analytics_events"("eventName");

-- CreateIndex
CREATE INDEX "analytics_events_source_idx" ON "analytics_events"("source");

-- CreateIndex
CREATE INDEX "analytics_events_eventName_createdAt_idx" ON "analytics_events"("eventName", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_userId_createdAt_idx" ON "analytics_events"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_guestId_createdAt_idx" ON "analytics_events"("guestId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "academies_slug_key" ON "academies"("slug");

-- CreateIndex
CREATE INDEX "academies_ownerId_idx" ON "academies"("ownerId");

-- CreateIndex
CREATE INDEX "academies_isApproved_kycVerified_idx" ON "academies"("isApproved", "kycVerified");

-- CreateIndex
CREATE INDEX "academies_isApproved_isActive_idx" ON "academies"("isApproved", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE INDEX "products_averageRating_idx" ON "products"("averageRating");

-- CreateIndex
CREATE INDEX "products_seller_idx" ON "products"("seller");

-- CreateIndex
CREATE INDEX "products_sellerType_idx" ON "products"("sellerType");

-- CreateIndex
CREATE INDEX "products_condition_idx" ON "products"("condition");

-- CreateIndex
CREATE INDEX "products_isActive_category_idx" ON "products"("isActive", "category");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_productVariantId_key" ON "inventory"("productVariantId");

-- CreateIndex
CREATE INDEX "carts_userId_idx" ON "carts"("userId");

-- CreateIndex
CREATE INDEX "carts_expiresAt_idx" ON "carts"("expiresAt");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");

-- CreateIndex
CREATE INDEX "orders_fulfillmentStatus_idx" ON "orders"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_key" ON "wishlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlistId_productId_key" ON "wishlist_items"("wishlistId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_payment_transactions_idempotencyKey_key" ON "shop_payment_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "shop_payment_transactions_orderId_idx" ON "shop_payment_transactions"("orderId");

-- CreateIndex
CREATE INDEX "shop_payment_transactions_gatewayOrderId_idx" ON "shop_payment_transactions"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "shop_payment_transactions_gatewayPaymentId_idx" ON "shop_payment_transactions"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "shop_payment_transactions_status_idx" ON "shop_payment_transactions"("status");

-- CreateIndex
CREATE INDEX "shop_payment_transactions_status_lastRetryAt_idx" ON "shop_payment_transactions"("status", "lastRetryAt");

-- CreateIndex
CREATE INDEX "email_verifications_email_idx" ON "email_verifications"("email");

-- CreateIndex
CREATE INDEX "email_verifications_email_verified_idx" ON "email_verifications"("email", "verified");

-- CreateIndex
CREATE INDEX "email_verifications_expiresAt_idx" ON "email_verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "outbox_messages_status_nextAttemptAt_idx" ON "outbox_messages"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_eventId_key" ON "payment_webhook_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_isActive_validUntil_idx" ON "promo_codes"("isActive", "validUntil");

-- CreateIndex
CREATE INDEX "promo_code_usages_promoCodeId_idx" ON "promo_code_usages"("promoCodeId");

-- CreateIndex
CREATE INDEX "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_type_key" ON "rate_limits"("key", "type");

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "scholarships_sportSlug_idx" ON "scholarships"("sportSlug");

-- CreateIndex
CREATE INDEX "scholarships_city_idx" ON "scholarships"("city");

-- CreateIndex
CREATE UNIQUE INDEX "scholarships_sportSlug_name_key" ON "scholarships"("sportSlug", "name");

-- CreateIndex
CREATE INDEX "universities_sportSlug_idx" ON "universities"("sportSlug");

-- CreateIndex
CREATE INDEX "universities_city_idx" ON "universities"("city");

-- CreateIndex
CREATE UNIQUE INDEX "universities_sportSlug_name_key" ON "universities"("sportSlug", "name");

-- CreateIndex
CREATE INDEX "athlete_stories_sportSlug_idx" ON "athlete_stories"("sportSlug");

-- CreateIndex
CREATE INDEX "athlete_stories_level_idx" ON "athlete_stories"("level");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_sportSlug_idx" ON "tournaments"("sportSlug");

-- CreateIndex
CREATE INDEX "tournaments_city_idx" ON "tournaments"("city");

-- CreateIndex
CREATE INDEX "tournaments_isCurated_idx" ON "tournaments"("isCurated");

-- CreateIndex
CREATE INDEX "tournaments_isCurated_sportSlug_idx" ON "tournaments"("isCurated", "sportSlug");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_sportSlug_name_key" ON "tournaments"("sportSlug", "name");

-- CreateIndex
CREATE INDEX "tournament_editions_sportSlug_idx" ON "tournament_editions"("sportSlug");

-- CreateIndex
CREATE INDEX "tournament_editions_sportSlug_startDate_idx" ON "tournament_editions"("sportSlug", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_editions_sportSlug_name_startDate_key" ON "tournament_editions"("sportSlug", "name", "startDate");

-- CreateIndex
CREATE INDEX "concierge_request_documents_requestId_idx" ON "concierge_request_documents"("requestId");

-- CreateIndex
CREATE INDEX "pathway_expert_verifications_sportSlug_idx" ON "pathway_expert_verifications"("sportSlug");

-- CreateIndex
CREATE UNIQUE INDEX "pathway_expert_verifications_sportSlug_expertId_key" ON "pathway_expert_verifications"("sportSlug", "expertId");

-- CreateIndex
CREATE UNIQUE INDEX "user_pathway_profiles_userId_dependentId_key" ON "user_pathway_profiles"("userId", "dependentId");

-- CreateIndex
CREATE INDEX "sport_pathways_sportSlug_idx" ON "sport_pathways"("sportSlug");

-- CreateIndex
CREATE INDEX "sport_pathways_cacheKey_idx" ON "sport_pathways"("cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "sport_base_paths_sportSlug_key" ON "sport_base_paths"("sportSlug");

-- CreateIndex
CREATE UNIQUE INDEX "sport_state_paths_sportSlug_stateSlug_key" ON "sport_state_paths"("sportSlug", "stateSlug");

-- CreateIndex
CREATE UNIQUE INDEX "federations_slug_key" ON "federations"("slug");

-- CreateIndex
CREATE INDEX "federations_sportSlug_idx" ON "federations"("sportSlug");

-- CreateIndex
CREATE INDEX "plan_check_ins_userId_idx" ON "plan_check_ins"("userId");

-- CreateIndex
CREATE INDEX "plan_check_ins_checkInDueAt_idx" ON "plan_check_ins"("checkInDueAt");

-- CreateIndex
CREATE INDEX "plan_check_ins_status_idx" ON "plan_check_ins"("status");

-- CreateIndex
CREATE INDEX "plan_check_ins_userId_status_createdAt_idx" ON "plan_check_ins"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "screening_requests_parentId_idx" ON "screening_requests"("parentId");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_push_subscriptions" ADD CONSTRAINT "user_push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_refund_methods" ADD CONSTRAINT "user_refund_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_payment_history" ADD CONSTRAINT "player_payment_history_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_own_venues" ADD CONSTRAINT "coach_own_venues_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_sport_pricing" ADD CONSTRAINT "coach_sport_pricing_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availability" ADD CONSTRAINT "coach_availability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_sport_availability" ADD CONSTRAINT "coach_sport_availability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_documents" ADD CONSTRAINT "coach_documents_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_blocked_dates" ADD CONSTRAINT "coach_blocked_dates_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_payout_methods" ADD CONSTRAINT "coach_payout_methods_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_pricing" ADD CONSTRAINT "venue_sport_pricing_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sport_images" ADD CONSTRAINT "venue_sport_images_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_opening_hours" ADD CONSTRAINT "venue_opening_hours_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_coaches" ADD CONSTRAINT "venue_coaches_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_documents" ADD CONSTRAINT "venue_documents_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_payout_methods" ADD CONSTRAINT "venue_payout_methods_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_legs" ADD CONSTRAINT "booking_payment_legs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_availability_windows" ADD CONSTRAINT "expert_availability_windows_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_payout_methods" ADD CONSTRAINT "expert_payout_methods_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guidance_chat_messages" ADD CONSTRAINT "guidance_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "guidance_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_chat_messages" ADD CONSTRAINT "roadmap_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "roadmap_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_blocked_users" ADD CONSTRAINT "community_blocked_users_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "community_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_answers" ADD CONSTRAINT "community_answers_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_group_members" ADD CONSTRAINT "community_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "community_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "community_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "community_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_delivery_receipts" ADD CONSTRAINT "message_delivery_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "community_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_request_documents" ADD CONSTRAINT "concierge_request_documents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "concierge_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
