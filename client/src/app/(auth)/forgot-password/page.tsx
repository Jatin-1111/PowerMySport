"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { authApi } from "@/lib/auth";
import Link from "next/link";
import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.forgotPassword(email);
      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.message || "Failed to send reset email");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Failed to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md w-full">
      <CardHeader>
        <h1 className="text-3xl font-bold text-center text-slate-900">
          Forgot Password
        </h1>
        {!success && (
          <p className="text-center text-slate-600 mt-2">
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all ${
                    error ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="your@email.com"
                />
                {error && (
                  <p className="text-red-500 text-sm mt-1.5">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send Reset Instructions"}
              </Button>
            </form>

            <p className="text-center mt-6 text-slate-600">
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
              <p className="text-green-800 text-center">
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
  );
}
