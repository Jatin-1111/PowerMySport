"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/modules/shared/ui/Card";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken, setLoading, setError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          router.push("/coach/verification");
        } else if (response.data.user.role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/dashboard/my-bookings");
        }
      } else {
        setError(response.message || "Login failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Login failed");
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
          router.push("/coach/verification");
        } else {
          router.push("/dashboard/my-bookings");
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "Google login failed");
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
          <h1 className="text-3xl font-bold text-center text-white">
            Welcome Back
          </h1>
          <p className="text-center mt-2 text-white">
            Sign in to continue to PowerMySport
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
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
              <label className="block text-sm font-medium mb-2 text-white">
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

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-power-orange hover:text-orange-600 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              className="w-full"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
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
              onError={() => setError("Google login failed")}
            />
          </div>

          <p className="text-center mt-6 text-white">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </GoogleOAuthProvider>
  );
}
