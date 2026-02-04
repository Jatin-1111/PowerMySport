"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken, setLoading, setError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setLoading(true);
    try {
      const response = await authApi.login(formData);
      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // Redirect based on role
        if (response.data.user.role === "PLAYER") {
          router.push("/dashboard/my-bookings");
        } else if (response.data.user.role === "VENUE_LISTER") {
          router.push("/venue-lister/inventory");
        } else if (response.data.user.role === "COACH") {
          router.push("/coach/profile");
        } else if (response.data.user.role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/dashboard/my-bookings");
        }
      } else {
        setError(response.message || "Login failed");
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-8 border border-border">
      <h1 className="text-3xl font-bold mb-6 text-center text-deep-slate">
        Login
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground ${
              errors.email ? "border-error-red" : "border-border"
            }`}
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="text-error-red text-sm mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground ${
              errors.password ? "border-error-red" : "border-border"
            }`}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-error-red text-sm mt-1">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-power-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="text-center mt-6 text-muted-foreground">
        Don't have an account?{" "}
        <Link
          href="/register"
          className="text-power-orange font-semibold hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
