"use client";

import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { Lock, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function AdminChangePasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const adminRaw = localStorage.getItem("admin");
    if (!adminRaw) {
      router.replace("/admin/login");
      return;
    }

    try {
      const admin = JSON.parse(adminRaw) as { mustChangePassword?: boolean };
      if (!admin.mustChangePassword) {
        router.replace("/admin");
      }
    } catch {
      router.replace("/admin/login");
    }
  }, [router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.currentPassword || !formData.newPassword) {
      toast.error("Current and new passwords are required.");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await adminApi.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      if (!response.success || !response.data) {
        toast.error(response.message || "Failed to change password.");
        return;
      }

      const adminRaw = localStorage.getItem("admin");
      if (adminRaw) {
        try {
          const admin = JSON.parse(adminRaw) as Record<string, unknown>;
          admin.mustChangePassword = false;
          localStorage.setItem("admin", JSON.stringify(admin));
        } catch {
          localStorage.setItem("admin", JSON.stringify(response.data));
        }
      }

      toast.success("Password updated successfully.");
      router.replace("/admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Change Password</h1>
            <p className="text-sm text-slate-200">
              First login detected. Please set your new password.
            </p>
          </div>
          <div className="bg-power-orange/20 pointer-events-none absolute -top-16 -right-20 h-48 w-48 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="focus:ring-power-orange/50 focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all focus:ring-2 focus:outline-none"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="focus:ring-power-orange/50 focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all focus:ring-2 focus:outline-none"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="focus:ring-power-orange/50 focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all focus:ring-2 focus:outline-none"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Lock size={16} />
                  Update Password
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
