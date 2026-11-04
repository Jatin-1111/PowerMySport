"use client";

import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
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

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-power-orange-solid focus:outline-none focus:ring-2 focus:ring-power-orange-solid/25";

  return (
    <div className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-deep-slate hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="bg-power-orange-solid flex size-10 items-center justify-center rounded-lg text-sm font-bold">
            PMS
          </span>
          <span className="text-base font-semibold">PowerMySport</span>
        </div>
        <div>
          <p className="max-w-[16ch] text-4xl font-semibold leading-tight">
            Run the platform from one place.
          </p>
          <p className="mt-4 max-w-[40ch] text-sm text-slate-400">
            Verifications, bookings, payouts and support queues for the PowerMySport team.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Lock size={14} aria-hidden />
          Authorised staff only
        </p>
      </aside>

      <div className="flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="bg-power-orange-solid flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white">
              PMS
            </span>
            <span className="text-base font-semibold text-slate-900">PowerMySport</span>
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">Sign in to admin</h1>
          <p className="mt-1.5 text-sm text-slate-600">Use your PowerMySport staff account.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputClass}
                placeholder="name@powermysport.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-deep-slate w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    aria-hidden
                    className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <Link
            href="/"
            className="text-power-orange-solid mt-8 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
