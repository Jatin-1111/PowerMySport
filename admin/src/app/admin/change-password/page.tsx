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
      toast.error(
        error instanceof Error ? error.message : "Failed to change password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-8 text-white shadow-lg mb-6">
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Change Password</h1>
            <p className="text-sm text-slate-200">
              First login detected. Please set your new password.
            </p>
          </div>
          <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        </div>

        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 transition-all"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 transition-all"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 transition-all"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
