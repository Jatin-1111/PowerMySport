"use client";

import { adminApi } from "@/lib/admin";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await adminApi.login(formData);

      if (response.success && response.data) {
        // Store admin data
        localStorage.setItem("admin", JSON.stringify(response.data.admin));
        localStorage.setItem("token", response.data.token);

        // Redirect to admin dashboard
        router.push("/admin");
      } else {
        setError(response.message || "Login failed");
      }
    } catch (error: any) {
      console.error("Admin login failed:", error);
      setError(
        error.response?.data?.message ||
          "Invalid credentials. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-deep-slate mb-2">
            Admin Login
          </h1>
          <p className="text-muted-foreground">
            PowerMySport Administration Panel
          </p>
        </div>

        <div className="bg-card rounded-lg p-8 border border-border shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="admin@powermysport.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-error-red/10 border border-error-red text-error-red px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-deep-slate text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Logging in..." : "Login to Admin Panel"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-power-orange hover:underline"
            >
              ← Back to Main Site
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>🔒 Secure admin access only</p>
        </div>
      </div>
    </div>
  );
}
