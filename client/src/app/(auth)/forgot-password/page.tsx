"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/modules/shared/ui/Card";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import Link from "next/link";
import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Email is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.forgotPassword(email);
      if (response.success) {
        setSuccess(true);
      } else {
        toast.error(response.message || "Failed to send reset email");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SlideUp duration={0.6} yOffset={20}>
      <Card className="glass-panel-heavy premium-shadow w-full border-0">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Forgot Password
          </h1>
          {!success && (
            <p className="mt-2 text-center text-sm text-slate-600 sm:text-base dark:text-slate-300">
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </p>
          )}
        </CardHeader>

        <CardContent>
          {!success ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white/50 px-4 py-3 text-slate-900 backdrop-blur-sm transition-all focus:outline-none focus:ring-2 dark:border-slate-600"
                    placeholder="your@email.com"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  className="premium-shadow w-full"
                >
                  {isSubmitting ? "Sending..." : "Send Reset Instructions"}
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
                  Password reset instructions have been sent to your email!
                </p>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-power-orange font-semibold transition-colors hover:text-orange-600"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </SlideUp>
  );
}
