"use client";

import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { Lock } from "lucide-react";
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
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="bg-power-orange-solid flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white">
            PMS
          </span>
          <span className="text-base font-semibold text-slate-900">PowerMySport</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          This is your first sign-in. Choose a password before you continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={formData.currentPassword}
              onChange={handleChange}
              required
              className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:outline-none focus:ring-2"
              placeholder="Enter your current password"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={formData.newPassword}
              onChange={handleChange}
              required
              className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:outline-none focus:ring-2"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-500 hover:border-slate-400 focus:outline-none focus:ring-2"
              placeholder="Re-enter the new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-deep-slate w-full rounded-lg py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
                Updating…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Lock size={16} aria-hidden />
                Update password
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
