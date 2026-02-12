"use client";

import { Card } from "@/modules/shared/ui/Card";
import { bookingApi } from "@/modules/booking/services/booking";
import { venueApi } from "@/modules/venue/services/venue";
import { Booking, Venue } from "@/types";
import { formatCurrency } from "@/utils/format";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function VenueListerDashboard() {
  const [stats, setStats] = useState({
    totalVenues: 0,
    totalBookings: 0,
    totalEarnings: 0,
    pendingBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [primaryVenue, setPrimaryVenue] = useState<Venue | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [venuesRes, bookingsRes] = await Promise.all([
          venueApi.getMyVenues(),
          bookingApi.getMyBookings(),
        ]);

        const venues = venuesRes.success ? venuesRes.data || [] : [];
        const bookings = bookingsRes.success ? bookingsRes.data || [] : [];

        // Calculate stats
        const confirmedBookings = bookings.filter(
          (b) => b.status === "CONFIRMED",
        );
        const earnings = confirmedBookings.reduce((sum, b) => {
          const venuePayment = b.payments.find(
            (p) => p.userType === "VENUE_LISTER",
          );
          return (
            sum +
            (venuePayment?.status === "PAID" // Note: status is PAID not COMPLETED in types
              ? venuePayment.amount
              : 0)
          );
        }, 0);

        setStats({
          totalVenues: venues.length,
          totalBookings: bookings.length,
          totalEarnings: earnings,
          pendingBookings: bookings.filter(
            (b) => b.status === "PENDING_PAYMENT",
          ).length,
        });

        setRecentBookings(bookings.slice(0, 5));

        if (venues.length > 0) {
          const sorted = [...venues].sort((a, b) =>
            (a.createdAt || "").localeCompare(b.createdAt || ""),
          );
          setPrimaryVenue(sorted[0]);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  const getDisplayPrice = (venue: Venue) => {
    if (venue.sportPricing) {
      const values = Object.values(venue.sportPricing).filter(
        (value) => typeof value === "number" && value >= 0,
      );
      if (values.length > 0) {
        return Math.min(...values);
      }
    }
    return venue.pricePerHour;
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Total Venues</p>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalVenues}
          </p>
        </Card>

        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Total Bookings</p>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalBookings}
          </p>
        </Card>

        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Total Earnings</p>
          <p className="text-3xl font-bold text-power-orange">
            {formatCurrency(stats.totalEarnings)}
          </p>
        </Card>

        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Pending Bookings</p>
          <p className="text-3xl font-bold text-yellow-600">
            {stats.pendingBookings}
          </p>
        </Card>
      </div>

      {primaryVenue && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Your First Venue
          </h2>
          <Card className="bg-white border border-slate-200 p-0 overflow-hidden">
            {primaryVenue.coverPhotoUrl ||
            (primaryVenue.images && primaryVenue.images.length > 0) ? (
              <img
                src={primaryVenue.coverPhotoUrl || primaryVenue.images[0]}
                alt={primaryVenue.name}
                className="h-40 w-full object-cover"
              />
            ) : null}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {primaryVenue.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    <MapPin size={16} className="text-power-orange" />
                    {primaryVenue.address || "Location on file"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-slate-500">
                    Starting at
                  </p>
                  <p className="text-lg font-bold text-power-orange">
                    {formatCurrency(getDisplayPrice(primaryVenue))}/hr
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {primaryVenue.sports.map((sport) => (
                  <span
                    key={sport}
                    className="text-xs bg-power-orange/10 text-power-orange px-2 py-1 rounded-full"
                  >
                    {sport}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <Link
                  href="/venue-lister/inventory"
                  className="inline-flex items-center gap-2 text-sm text-power-orange font-semibold hover:text-orange-600"
                >
                  Manage this venue
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="text-xl font-bold mb-4 text-slate-900">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/venue-lister/inventory"
          className="flex items-center justify-between p-6 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors group"
        >
          <div>
            <h3 className="text-lg font-bold mb-1">Manage Inventory</h3>
            <p className="text-slate-300 text-sm">Add or edit your venues</p>
          </div>
          <ArrowRight
            size={24}
            className="group-hover:translate-x-2 transition-transform"
          />
        </Link>
        <Link
          href="/venue-lister/vendor-bookings"
          className="flex items-center justify-between p-6 bg-power-orange text-white rounded-lg hover:bg-orange-600 transition-colors group"
        >
          <div>
            <h3 className="text-lg font-bold mb-1">View Bookings</h3>
            <p className="text-orange-100 text-sm">Check upcoming sessions</p>
          </div>
          <ArrowRight
            size={24}
            className="group-hover:translate-x-2 transition-transform"
          />
        </Link>
      </div>
    </div>
  );
}
