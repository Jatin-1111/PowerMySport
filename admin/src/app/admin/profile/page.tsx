"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
        return;
      }

      setError(response.message || "Failed to load profile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return <div className="py-12 text-center">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Profile"
          subtitle="View your account and role permissions."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadProfile}
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
        title="Profile"
        subtitle="View your account and role permissions."
      />

      <Card className="bg-white">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Name</p>
            <p className="text-base font-semibold text-slate-900">
              {profile?.name || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="text-base font-semibold text-slate-900">
              {profile?.email || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Role</p>
            <p className="text-base font-semibold text-slate-900">
              {profile?.role || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="text-base font-semibold text-slate-900">
              {profile?.isActive ? "Active" : "Inactive"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
