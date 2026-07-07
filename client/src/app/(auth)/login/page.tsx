"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "next" is what the community app (and other satellite apps) send when
  // bouncing an unauthenticated user back to login; "redirect" is used
  // internally within this app.
  const redirectTo =
    searchParams.get("redirect") || searchParams.get("next") || null;
  const { user, setUser, setToken, setLoading } = useAuthStore();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getDefaultRedirect = (role: string) => {
    if (role === "VenueLister") return "/venue-lister/inventory";
    if (role === "Coach") return "/coach/verification";
    if (role === "Academy") return "/academy";
    if (role === "EXPERT") return "/expert/dashboard";
    if (role === "Admin") return "/admin/users";
    return "/";
  };

  // router.push only handles internal app routes. A redirect target from an
  // external origin (e.g. community.powermysport.com) needs a full navigation
  // so the browser actually leaves this app and carries the auth cookie along.
  const goToRedirect = (target: string) => {
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }
    router.push(target);
  };

  useEffect(() => {
    if (user) {
      goToRedirect(redirectTo || getDefaultRedirect(user.role));
    }
  }, [user, router, redirectTo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
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
        goToRedirect(redirectTo || getDefaultRedirect(response.data.user.role));
      } else {
        toast.error(response.message || "Login failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Login failed");
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
        toast.error("No credential received from Google");
        return;
      }
      const response = await authApi.googleLogin({
        credential: credentialResponse.credential,
        action: "login",
      });
      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        goToRedirect(redirectTo || getDefaultRedirect(response.data.user.role));
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "h-11 w-full rounded-xl border px-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:ring-2";
  const inputOk =
    "border-slate-200 dark:border-slate-700 focus:border-power-orange focus:ring-power-orange/15";
  const inputErr =
    "border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/15";

  return (
    <GoogleOAuthProvider
      clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
    >
      <div className="space-y-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Sign in
          </p>
          <h1 className="mt-1.5 font-title text-[1.75rem] font-black leading-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={`${inputBase} ${errors.email ? inputErr : inputOk}`}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-power-orange transition-colors hover:text-orange-600"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`${inputBase} pr-11 ${errors.password ? inputErr : inputOk}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="w-full"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </motion.form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-slate-400 dark:bg-slate-950 dark:text-slate-500">
              or continue with
            </span>
          </div>
        </div>

        {/* Google */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google login failed")}
          />
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-power-orange transition-colors hover:text-orange-600"
          >
            Create one
          </Link>
        </p>
      </div>
    </GoogleOAuthProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
