"use client";

import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { ArrowLeft, Eye, EyeOff, Lock, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await adminApi.login(formData);

      if (response.success && response.data) {
        // Store admin data
        localStorage.setItem("admin", JSON.stringify(response.data.admin));
        localStorage.setItem("token", response.data.token);

        if (response.data.admin.mustChangePassword) {
          router.push("/admin/change-password");
        } else {
          router.push("/admin");
        }
      } else {
        toast.error(response.message || "Login failed");
      }
    } catch (error) {
      console.error("Admin login failed:", error);
      toast.error(getErrorMessage(error, "Invalid credentials. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header Card */}
        <div className="bg-linear-to-br relative mb-6 overflow-hidden rounded-2xl from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Admin Portal</h1>
            <p className="text-sm text-slate-200">PowerMySport Administration Panel</p>
          </div>
          <div className="bg-power-orange/20 pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        </div>

        {/* Login Form Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="focus:ring-power-orange/50 focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all focus:outline-none focus:ring-2"
                placeholder="teams@powermysport.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="focus:ring-power-orange/50 focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-all focus:outline-none focus:ring-2"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Logging in...
                </span>
              ) : (
                "Login to Admin Panel"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-power-orange inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-orange-600"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Main Site
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
            <Lock size={14} className="text-slate-400" />
            <span>Secure admin access only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
