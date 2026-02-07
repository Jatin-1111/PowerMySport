"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { authApi } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") || "PLAYER";
  const { setUser, setToken, setLoading, setError } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: roleParam as "PLAYER" | "VENUE_LISTER" | "COACH",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

        // Route based on role
        const roleRoutes = {
          PLAYER: "/dashboard/my-bookings",
          VENUE_LISTER: "/venue-lister/inventory",
          COACH: "/coach/profile",
          ADMIN: "/admin",
        };
        router.push(
          roleRoutes[response.data.user.role] || "/dashboard/my-bookings",
        );
      } else {
        setError(response.message || "Registration failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: {
    credential?: string;
  }) => {
    try {
      setLoading(true);
      if (!credentialResponse.credential) {
        setError("No credential received from Google");
        return;
      }
      // Decode JWT token from Google
      const decoded = JSON.parse(
        atob(credentialResponse.credential.split(".")[1]),
      );

      const response = await authApi.googleLogin({
        googleId: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        photoUrl: decoded.picture,
        role: formData.role,
      });

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
        } else {
          router.push("/dashboard/my-bookings");
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Google registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider
      clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
    >
      <Card className="max-w-md w-full">
        <CardHeader>
          <h1 className="text-3xl font-bold text-center text-slate-900">
            Create Account
          </h1>
          <p className="text-center text-slate-600 mt-2">
            Join PowerMySport and start your journey
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all ${
                  errors.name ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1.5">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all ${
                  errors.email ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1.5">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all ${
                  errors.phone ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="9876543210"
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1.5">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all ${
                    errors.password ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1.5">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Account Type
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
              >
                <option value="PLAYER">Player (Book Venues & Coaches)</option>
                <option value="COACH">Coach (Offer Coaching Services)</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Want to list your venue?{" "}
                <a
                  href="/onboarding"
                  className="text-power-orange hover:text-orange-600 transition-colors"
                >
                  Submit an inquiry
                </a>
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              className="w-full"
            >
              {isSubmitting ? "Creating account..." : "Register"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-slate-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google registration failed")}
            />
          </div>

          <p className="text-center mt-6 text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
            >
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </GoogleOAuthProvider>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}


