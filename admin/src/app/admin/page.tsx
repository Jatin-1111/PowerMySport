"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { PlatformStats, statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { Building2, Calendar, IndianRupee, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalVenues: 0,
    totalBookings: 0,
    pendingInquiries: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getPlatformStats();
      if (response.success && response.data) {
        setStats(response.data);
        return;
      }

      setError(response.message || "Failed to load dashboard stats.");
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      setError("Failed to load dashboard stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Dashboard"
          subtitle="Monitor platform statistics and manage all aspects of PowerMySport."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={fetchStats}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Dashboard"
        subtitle="Monitor platform statistics and manage all aspects of PowerMySport."
      />

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Users</p>
            <Users size={24} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalUsers}
          </p>
        </Card>

        <Card className="bg-white hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Venues</p>
            <Building2 size={24} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalVenues}
          </p>
        </Card>

        <Card className="bg-white hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Bookings</p>
            <Calendar size={24} className="text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalBookings}
          </p>
        </Card>

        <Card className="bg-white hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Revenue</p>
            <IndianRupee size={24} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-power-orange">
            {stats.revenue.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">
          Quick Actions
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/admin/users"
            className="p-5 border border-slate-200 rounded-xl hover:shadow-md hover:border-power-orange transition-all text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Users size={40} className="text-green-500" />
            </div>
            <p className="font-semibold text-slate-900">Manage Users</p>
          </Link>
          <Link
            href="/admin/bookings"
            className="p-5 border border-slate-200 rounded-xl hover:shadow-md hover:border-power-orange transition-all text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Calendar size={40} className="text-purple-500" />
            </div>
            <p className="font-semibold text-slate-900">View Bookings</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}
