"use client";

import { Card } from "@/components/ui/Card";
import { PlatformStats, statsApi } from "@/lib/stats";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalVenues: 0,
    totalBookings: 0,
    pendingInquiries: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await statsApi.getPlatformStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">
        Admin Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Users</p>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalUsers}
          </p>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Venues</p>
            <span className="text-2xl">🏟️</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalVenues}
          </p>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Bookings</p>
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalBookings}
          </p>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Revenue</p>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-3xl font-bold text-power-orange">
            ₹{stats.revenue.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Pending Inquiries Alert */}
      {stats.pendingInquiries > 0 && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-800">
                {stats.pendingInquiries} Pending Venue Inquiries
              </p>
              <p className="text-sm text-yellow-700">
                Review and approve venue listing requests
              </p>
            </div>
            <a
              href="/admin/inquiries"
              className="ml-auto bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
            >
              Review Now
            </a>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-deep-slate">
          Quick Actions
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="/admin/inquiries"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <span className="text-3xl block mb-2">📝</span>
            <p className="font-semibold">Review Inquiries</p>
          </a>
          <a
            href="/admin/users"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <span className="text-3xl block mb-2">👥</span>
            <p className="font-semibold">Manage Users</p>
          </a>
          <a
            href="/admin/bookings"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <span className="text-3xl block mb-2">📅</span>
            <p className="font-semibold">View Bookings</p>
          </a>
        </div>
      </div>
    </div>
  );
}


