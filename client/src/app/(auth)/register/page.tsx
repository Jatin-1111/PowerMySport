"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") || "user";
  const { setUser, setToken, setLoading, setError } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: roleParam as "user" | "vendor",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.phone) newErrors.phone = "Phone is required";
    if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setLoading(true);
    try {
      const response = await authApi.register(formData);
      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        router.push(
          response.data.user.role === "vendor"
            ? "/vendor/inventory"
            : "/bookings",
        );
      } else {
        setError(response.message || "Registration failed");
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg p-8 border border-border">
      <h1 className="text-3xl font-bold mb-6 text-center text-deep-slate">
        Create Account
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground ${
              errors.name ? "border-error-red" : "border-border"
            }`}
            placeholder="John Doe"
          />
          {errors.name && (
            <p className="text-error-red text-sm mt-1">{errors.name}</p>
          )}
        </div>

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
            Phone
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground ${
              errors.phone ? "border-error-red" : "border-border"
            }`}
            placeholder="9876543210"
          />
          {errors.phone && (
            <p className="text-error-red text-sm mt-1">{errors.phone}</p>
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Account Type
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
          >
            <option value="user">Sports Enthusiast</option>
            <option value="vendor">Venue Owner</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-power-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-center mt-6 text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-power-orange font-semibold hover:underline"
        >
          Login
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
