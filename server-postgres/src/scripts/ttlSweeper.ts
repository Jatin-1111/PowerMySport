/**
 * TTL sweeper — Postgres has no native TTL indexes, so this replaces the
 * Mongoose `expireAfterSeconds` indexes that used to auto-delete expired docs.
 *
 * Run it on a schedule (node-cron in server.ts, or an external cron / ECS
 * scheduled task). It is idempotent and safe to run frequently.
 *
 * Collections that had Mongo TTL indexes:
 *   - notifications           (expiresAt, 0s)          -> soft/hard expire
 *   - booking_slot_locks      (lastLockedAt, 7d)
 *   - booking_invitations     (updatedAt, 30d, DECLINED/EXPIRED only)
 *   - scheduled_notifications (sentAt, 30d, SENT only)
 *   - email_verifications     (expiresAt, 3600s)
 *   - rate_limits             (resetAt, 0s)
 *   - carts                   (expiresAt, 0s)
 */
import prisma from "../lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

export async function sweepTtl(now = new Date()): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  // notifications past expiresAt
  results.notifications = (
    await prisma.notification.deleteMany({
      where: { expiresAt: { not: null, lte: now } },
    })
  ).count;

  // slot locks older than 7 days
  results.bookingSlotLocks = (
    await prisma.bookingSlotLock.deleteMany({
      where: { lastLockedAt: { lte: new Date(now.getTime() - 7 * DAY) } },
    })
  ).count;

  // declined/expired invitations older than 30 days
  results.bookingInvitations = (
    await prisma.bookingInvitation.deleteMany({
      where: {
        status: { in: ["DECLINED", "EXPIRED"] },
        updatedAt: { lte: new Date(now.getTime() - 30 * DAY) },
      },
    })
  ).count;

  // sent scheduled notifications older than 30 days
  results.scheduledNotifications = (
    await prisma.scheduledNotification.deleteMany({
      where: {
        status: "SENT",
        sentAt: { not: null, lte: new Date(now.getTime() - 30 * DAY) },
      },
    })
  ).count;

  // expired email verifications
  results.emailVerifications = (
    await prisma.emailVerification.deleteMany({
      where: { expiresAt: { lte: now } },
    })
  ).count;

  // expired rate-limit buckets
  results.rateLimits = (
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } })
  ).count;

  // expired carts
  results.carts = (
    await prisma.cart.deleteMany({ where: { expiresAt: { lte: now } } })
  ).count;

  return results;
}

// Allow running standalone: `npm run ttl:sweep`
if (require.main === module) {
  sweepTtl()
    .then((r) => {
      console.log("🧹 TTL sweep complete:", r);
    })
    .catch((e) => {
      console.error("TTL sweep failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
