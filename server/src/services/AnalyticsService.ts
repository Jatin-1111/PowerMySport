import { Booking } from "../models/Booking";
import { Venue } from "../models/Venue";
import { Coach } from "../models/Coach";

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
  const venues = await Venue.find({ ownerId });
  const venueIds = venues.map((v) => v._id);

  // Build date filter
  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = startDate;
    if (endDate) dateFilter.date.$lte = endDate;
  }

  // Get all bookings for these venues
  const bookings = await Booking.find({
    venueId: { $in: venueIds },
    ...dateFilter,
  }).populate("venueId");

  // Calculate totals
  let totalRevenue = 0;
  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");
  const noShowBookings = bookings.filter((b) => b.status === "NO_SHOW");

  // Calculate revenue (only from COMPLETED and NO_SHOW bookings)
  const paidBookings = [...completedBookings, ...noShowBookings];
  paidBookings.forEach((booking) => {
    const venuePayment = booking.payments.find(
      (p) => p.userType === "VENUE_LISTER" && p.status === "PAID",
    );
    if (venuePayment) {
      totalRevenue += venuePayment.amount;
    }
  });

  // Revenue by venue
  const revenueByVenue = venues.map((venue) => {
    const venueBookings = paidBookings.filter(
      (b) => b.venueId._id.toString() === venue._id.toString(),
    );

    const revenue = venueBookings.reduce((sum, booking) => {
      const payment = booking.payments.find(
        (p) => p.userType === "VENUE_LISTER" && p.status === "PAID",
      );
      return sum + (payment?.amount || 0);
    }, 0);

    return {
      venueId: venue._id.toString(),
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
      (p) => p.userType === "VENUE_LISTER" && p.status === "PAID",
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
  // Build date filter
  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = startDate;
    if (endDate) dateFilter.date.$lte = endDate;
  }

  // Get all bookings for this coach
  const bookings = await Booking.find({
    coachId,
    ...dateFilter,
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
      (p) => p.userType === "COACH" && p.status === "PAID",
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
      (p) => p.userType === "COACH" && p.status === "PAID",
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
  const coach = await Coach.findById(coachId);

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
  // Build date filter
  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = startDate;
    if (endDate) dateFilter.date.$lte = endDate;
  }

  const [bookings, totalVenues, totalCoaches] = await Promise.all([
    Booking.find(dateFilter),
    Venue.countDocuments({ approvalStatus: "APPROVED" }),
    Coach.countDocuments(),
  ]);

  const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
  const paidBookings = bookings.filter(
    (b) => b.status === "COMPLETED" || b.status === "NO_SHOW",
  );

  const totalRevenue = paidBookings.reduce((sum, booking) => {
    const bookingTotal = booking.payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0);
    return sum + bookingTotal;
  }, 0);

  // Revenue by month
  const monthlyData = new Map<string, { revenue: number; bookings: number }>();

  paidBookings.forEach((booking) => {
    const monthKey = booking.date.toISOString().slice(0, 7);
    const bookingRevenue = booking.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);

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
