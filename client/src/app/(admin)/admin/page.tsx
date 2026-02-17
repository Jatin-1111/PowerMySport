"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { PlatformStats, statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import {
  AlertCircle,
  Building2,
  Calendar,
  IndianRupee,
  MessageSquare,
  Users,
} from "lucide-react";
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

      {/* Pending Inquiries Alert */}
      {stats.pendingInquiries > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="text-yellow-700" />
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
      <Card className="bg-white">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">
          Quick Actions
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="/admin/inquiries"
            className="p-5 border border-slate-200 rounded-xl hover:shadow-md hover:border-power-orange transition-all text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <MessageSquare size={40} className="text-blue-500" />
            </div>
            <p className="font-semibold text-slate-900">Review Inquiries</p>
          </a>
          <a
            href="/admin/users"
            className="p-5 border border-slate-200 rounded-xl hover:shadow-md hover:border-power-orange transition-all text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Users size={40} className="text-green-500" />
            </div>
            <p className="font-semibold text-slate-900">Manage Users</p>
          </a>
          <a
            href="/admin/bookings"
            className="p-5 border border-slate-200 rounded-xl hover:shadow-md hover:border-power-orange transition-all text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Calendar size={40} className="text-purple-500" />
            </div>
            <p className="font-semibold text-slate-900">View Bookings</p>
          </a>
        </div>
      </Card>
    </div>
  );
}
