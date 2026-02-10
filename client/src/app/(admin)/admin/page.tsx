"use client";

import { Card } from "@/modules/shared/ui/Card";
import { PlatformStats, statsApi } from "@/modules/analytics/services/stats";
import {
  Building2,
  Calendar,
  Users,
  IndianRupee,
  AlertCircle,
  MessageSquare,
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
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">
        Admin Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Users</p>
            <Users size={24} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalUsers}
          </p>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Venues</p>
            <Building2 size={24} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalVenues}
          </p>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total Bookings</p>
            <Calendar size={24} className="text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {stats.totalBookings}
          </p>
        </Card>

        <Card className="bg-white">
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
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 mb-6">
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
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-xl font-bold mb-4 text-deep-slate">
          Quick Actions
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="/admin/inquiries"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <MessageSquare size={40} className="text-blue-500" />
            </div>
            <p className="font-semibold">Review Inquiries</p>
          </a>
          <a
            href="/admin/users"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Users size={40} className="text-green-500" />
            </div>
            <p className="font-semibold">Manage Users</p>
          </a>
          <a
            href="/admin/bookings"
            className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-center"
          >
            <div className="text-3xl mb-2 flex justify-center">
              <Calendar size={40} className="text-purple-500" />
            </div>
            <p className="font-semibold">View Bookings</p>
          </a>
        </div>
      </div>
    </div>
  );
}
