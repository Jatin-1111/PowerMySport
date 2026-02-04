"use client";

import React, { useEffect, useState } from "react";
import { venueApi } from "@/lib/venue";
import { bookingApi } from "@/lib/booking";
import { Venue, Booking } from "@/types";
import Link from "next/link";
import { formatCurrency } from "@/utils/format";

export default function VenueListerDashboard() {
  const [stats, setStats] = useState({
    totalVenues: 0,
    totalBookings: 0,
    totalEarnings: 0,
    pendingBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Total Venues</p>
          <p className="text-3xl font-bold text-deep-slate">
            {stats.totalVenues}
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Total Bookings</p>
          <p className="text-3xl font-bold text-deep-slate">
            {stats.totalBookings}
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
          <p className="text-3xl font-bold text-power-orange">
            {formatCurrency(stats.totalEarnings)}
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Pending Bookings</p>
          <p className="text-3xl font-bold text-yellow-600">
            {stats.pendingBookings}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-xl font-bold mb-4 text-deep-slate">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/venue-lister/inventory"
          className="flex items-center justify-between p-6 bg-deep-slate text-white rounded-lg hover:bg-gray-800 transition-colors group"
        >
          <div>
            <h3 className="text-lg font-bold mb-1">Manage Inventory</h3>
            <p className="text-gray-300 text-sm">Add or edit your venues</p>
          </div>
          <span className="text-2xl group-hover:translate-x-2 transition-transform">
            →
          </span>
        </Link>
        <Link
          href="/venue-lister/vendor-bookings"
          className="flex items-center justify-between p-6 bg-power-orange text-white rounded-lg hover:bg-orange-600 transition-colors group"
        >
          <div>
            <h3 className="text-lg font-bold mb-1">View Bookings</h3>
            <p className="text-orange-100 text-sm">Check upcoming sessions</p>
          </div>
          <span className="text-2xl group-hover:translate-x-2 transition-transform">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
