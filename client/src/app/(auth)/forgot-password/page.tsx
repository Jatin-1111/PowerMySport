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
      <Card className="w-full glass-panel-heavy premium-shadow border-0">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white sm:text-3xl">
            Forgot Password
          </h1>
          {!success && (
            <p className="text-center mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
              Enter your email address and we&apos;ll send you instructions to
              reset your password.
            </p>
          )}
        </CardHeader>

        <CardContent>
          {!success ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-white">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white/50 backdrop-blur-sm text-slate-900 transition-all"
                    placeholder="your@email.com"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  className="w-full premium-shadow"
                >
                  {isSubmitting ? "Sending..." : "Send Reset Instructions"}
                </Button>
              </form>

              <p className="text-center mt-6 text-slate-600 dark:text-slate-300">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
                >
                  Login
                </Link>
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-center font-semibold">
                  Password reset instructions have been sent to your email!
                </p>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
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
