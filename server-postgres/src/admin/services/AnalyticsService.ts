import type { BookingPaymentLeg } from "@prisma/client";
import prisma from "../../lib/prisma";

// NOTE: despite the file name, this service does not read the analytics_events
// table — it derives revenue/booking analytics from bookings + payment legs.
// The monthly roll-ups below are computed in memory (as in the Mongo version)
// to keep the return shapes byte-for-byte identical.
// TODO(prisma): for large datasets these month buckets could be pushed into
// Postgres via `$queryRaw` with `date_trunc('month', date)` + a SUM over the
// paid legs, but that is an optimization — the in-memory port preserves the
// exact output contract the frontends depend on.

const getBookingVenueId = (venueRef: unknown): string | null => {
  if (!venueRef) return null;
  if (typeof venueRef === "object" && venueRef !== null && "_id" in venueRef) {
    const populatedVenue = venueRef as { _id: { toString(): string } };
    return populatedVenue._id.toString();
  }
  if (
    typeof (venueRef as { toString?: () => string }).toString === "function"
  ) {
    return (venueRef as { toString: () => string }).toString();
  }
  return null;
};

// Build a Prisma `date` range filter mirroring the Mongo $gte/$lte usage.
const buildDateWhere = (
  startDate?: Date,
  endDate?: Date,
): { date?: { gte?: Date; lte?: Date } } => {
  if (!startDate && !endDate) return {};
  const date: { gte?: Date; lte?: Date } = {};
  if (startDate) date.gte = startDate;
  if (endDate) date.lte = endDate;
  return { date };
};

/**
 * Get revenue analytics for a venue lister
 * Shows total earnings, booking counts, and trends
 */
export const getVenueListerAnalytics = async (
  ownerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  revenueByVenue: Array<{
    venueId: string;
    venueName: string;
    revenue: number;
    bookings: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
}> => {
  // Get all venues for this owner
  const venues = await prisma.venue.findMany({ where: { ownerId } });
  const venueIds = venues.map((v) => v.id);

  // Get all bookings for these venues (with their payment legs).
  const bookings = await prisma.booking.findMany({
    where: {
      venueId: { in: venueIds },
      ...buildDateWhere(startDate, endDate),
    },
    include: { payments: true },
  });

  // Calculate totals
  let totalRevenue = 0;
  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");
  const noShowBookings = bookings.filter((b) => b.status === "NO_SHOW");

  // Calculate revenue (only from COMPLETED and NO_SHOW bookings)
  const paidBookings = [...completedBookings, ...noShowBookings];
  paidBookings.forEach((booking) => {
    const venuePayment = booking.payments.find(
      (payment: BookingPaymentLeg) =>
        payment.userType === "VenueLister" && payment.status === "PAID",
    );
    if (venuePayment) {
      totalRevenue += venuePayment.amount;
    }
  });

  // Revenue by venue
  const revenueByVenue = venues.map((venue) => {
    const venueBookings = paidBookings.filter(
      (b) => getBookingVenueId(b.venueId) === venue.id.toString(),
    );

    const revenue = venueBookings.reduce((sum, booking) => {
      const payment = booking.payments.find(
        (p: BookingPaymentLeg) =>
          p.userType === "VenueLister" && p.status === "PAID",
      );
      return sum + (payment?.amount || 0);
    }, 0);

    return {
      venueId: venue.id.toString(),
      venueName: venue.name,
      revenue,
      bookings: venueBookings.length,
    };
  });

  // Revenue by month
  const monthlyData = new Map<string, { revenue: number; bookings: number }>();

  paidBookings.forEach((booking) => {
    const monthKey = booking.date.toISOString().slice(0, 7); // YYYY-MM
    const venuePayment = booking.payments.find(
      (p: BookingPaymentLeg) =>
        p.userType === "VenueLister" && p.status === "PAID",
    );

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: 0, bookings: 0 });
    }

    const data = monthlyData.get(monthKey)!;
    data.revenue += venuePayment?.amount || 0;
    data.bookings += 1;
  });

  const revenueByMonth = Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalRevenue,
    totalBookings: bookings.length,
    completedBookings: completedBookings.length,
    cancelledBookings: cancelledBookings.length,
    noShowBookings: noShowBookings.length,
    revenueByVenue,
    revenueByMonth,
  };
};

/**
 * Get revenue analytics for a coach
 * Shows total earnings, booking counts, and trends
 */
export const getCoachAnalytics = async (
  coachId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{
  totalRevenue: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
  averageRating: number;
  totalReviews: number;
}> => {
  // Get all bookings for this coach (with their payment legs).
  const bookings = await prisma.booking.findMany({
    where: {
      coachId,
      ...buildDateWhere(startDate, endDate),
    },
    include: { payments: true },
  });

  // Calculate totals
  let totalRevenue = 0;
  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");
  const noShowBookings = bookings.filter((b) => b.status === "NO_SHOW");

  // Calculate revenue (only from COMPLETED and NO_SHOW bookings)
  const paidBookings = [...completedBookings, ...noShowBookings];
  paidBookings.forEach((booking) => {
    const coachPayment = booking.payments.find(
      (p: BookingPaymentLeg) => p.userType === "Coach" && p.status === "PAID",
    );
    if (coachPayment) {
      totalRevenue += coachPayment.amount;
    }
  });

  // Revenue by month
  const monthlyData = new Map<string, { revenue: number; bookings: number }>();

  paidBookings.forEach((booking) => {
    const monthKey = booking.date.toISOString().slice(0, 7); // YYYY-MM
    const coachPayment = booking.payments.find(
      (p: BookingPaymentLeg) => p.userType === "Coach" && p.status === "PAID",
    );

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: 0, bookings: 0 });
    }

    const data = monthlyData.get(monthKey)!;
    data.revenue += coachPayment?.amount || 0;
    data.bookings += 1;
  });

  const revenueByMonth = Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Get coach rating info
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });

  return {
    totalRevenue,
    totalBookings: bookings.length,
    completedBookings: completedBookings.length,
    cancelledBookings: cancelledBookings.length,
    noShowBookings: noShowBookings.length,
    revenueByMonth,
    averageRating: coach?.rating || 0,
    totalReviews: coach?.reviewCount || 0,
  };
};

/**
 * Get admin dashboard analytics
 * Platform-wide statistics
 */
export const getAdminAnalytics = async (
  startDate?: Date,
  endDate?: Date,
): Promise<{
  totalRevenue: number;
  totalBookings: number;
  totalVenues: number;
  totalCoaches: number;
  completedBookings: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
}> => {
  const dateWhere = buildDateWhere(startDate, endDate);

  const [bookings, totalVenues, totalCoaches] = await Promise.all([
    prisma.booking.findMany({ where: dateWhere, include: { payments: true } }),
    prisma.venue.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.coach.count(),
  ]);

  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const paidBookings = bookings.filter(
    (b) => b.status === "COMPLETED" || b.status === "NO_SHOW",
  );

  const totalRevenue = paidBookings.reduce((sum, booking) => {
    const bookingTotal = booking.payments
      .filter((p: BookingPaymentLeg) => p.status === "PAID")
      .reduce((s: number, p: BookingPaymentLeg) => s + p.amount, 0);
    return sum + bookingTotal;
  }, 0);

  // Revenue by month
  const monthlyData = new Map<string, { revenue: number; bookings: number }>();

  paidBookings.forEach((booking) => {
    const monthKey = booking.date.toISOString().slice(0, 7);
    const bookingRevenue = booking.payments
      .filter((p: BookingPaymentLeg) => p.status === "PAID")
      .reduce((sum: number, p: BookingPaymentLeg) => sum + p.amount, 0);

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: 0, bookings: 0 });
    }

    const data = monthlyData.get(monthKey)!;
    data.revenue += bookingRevenue;
    data.bookings += 1;
  });

  const revenueByMonth = Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalRevenue,
    totalBookings: bookings.length,
    totalVenues,
    totalCoaches,
    completedBookings: completedBookings.length,
    revenueByMonth,
  };
};
