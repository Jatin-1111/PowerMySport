"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/modules/shared/ui/Card";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.resetPassword(token, formData.newPassword);
      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        toast.error(response.message || "Failed to reset password");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SlideUp duration={0.6} yOffset={20}>
      <Card className="glass-panel-heavy premium-shadow w-full border-0">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Reset Password
          </h1>
          {!success && (
            <p className="mt-2 text-center text-sm text-slate-600 sm:text-base dark:text-slate-300">
              Enter your new password below
            </p>
          )}
        </CardHeader>

        <CardContent>
          {!success ? (
            <>
              {!token && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-center font-semibold text-red-800">
                    Invalid or missing reset token. Please request a new password reset.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white/50 px-4 py-3 text-slate-900 backdrop-blur-sm transition-all focus:ring-2 focus:outline-none dark:border-slate-600"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      title="Toggle password visibility"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white/50 px-4 py-3 text-slate-900 backdrop-blur-sm transition-all focus:ring-2 focus:outline-none dark:border-slate-600"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      title="Toggle password visibility"
                      aria-label="Toggle password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !token}
                  variant="primary"
                  className="premium-shadow w-full"
                >
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>

              <p className="mt-6 text-center text-slate-600 dark:text-slate-300">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="text-power-orange font-semibold transition-colors hover:text-orange-600"
                >
                  Login
                </Link>
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-center font-semibold text-emerald-800">
                  Password reset successfully!
                </p>
                <p className="mt-2 text-center text-sm text-emerald-700">
                  Redirecting to login page...
                </p>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-power-orange font-semibold transition-colors hover:text-orange-600"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </SlideUp>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-10 text-sm text-slate-500">
          Loading reset form...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
