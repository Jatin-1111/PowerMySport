"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Admin, adminApi } from "@/modules/admin/services/admin";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/modules/shared/ui/Panel";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";

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

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Name", value: profile?.name || "Not set" },
    { label: "Email", value: profile?.email || "Not set" },
    { label: "Role", value: profile?.role || "Not set" },
    {
      label: "Status",
      value: (
        <StatusBadge
          status={profile?.isActive ? "Active" : "Inactive"}
          tone={profile?.isActive ? "green" : "slate"}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Overview"
        title="Profile"
        subtitle="Your admin account and the role it runs under."
      />

      {loading ? (
        <SkeletonBlock rows={4} label="Loading profile" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={loadProfile} />
      ) : (
        <Panel className="max-w-2xl" title="Account">
          <dl className="divide-y divide-slate-100">
            {fields.map((field) => (
              <div
                key={field.label}
                className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                <dt className="text-sm text-slate-500">{field.label}</dt>
                <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </div>
  );
}
