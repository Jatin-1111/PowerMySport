"use client";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { motion } from "framer-motion";
import { Award, Check, Eye, EyeOff, Target, Users2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

const ROLE_OPTIONS = [
  {
    value: "Parent" as const,
    label: "Parent",
    desc: "Manage your child's sports journey",
    Icon: Users2,
  },
  {
    value: "Player" as const,
    label: "Athlete",
    desc: "Book venues & play anywhere",
    Icon: Zap,
  },
  {
    value: "Coach" as const,
    label: "Coach",
    desc: "Offer training services",
    Icon: Target,
  },
  {
    value: "Expert" as const,
    label: "Expert",
    desc: "1:1 professional sessions",
    Icon: Award,
    badge: "Review required",
  },
];

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || null;
  const { user, setUser, setToken, setLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    userType: "Player" as "Parent" | "Player" | "Coach" | "Expert",
    serviceMode: "OWN_VENUE" as "OWN_VENUE" | "FREELANCE" | "HYBRID",
    acceptedTerms: false,
    acceptedPrivacy: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      if ((user as any).userType === "Parent") {
        router.push("/parent-onboarding");
      } else if (user.role === "Player") {
        router.push("/dashboard/my-bookings");
      } else if (user.role === "VenueLister") {
        router.push("/venue-lister/inventory");
      } else if (user.role === "Coach") {
        router.push("/coach/verification");
      } else if (user.role === "Academy") {
        router.push("/academy");
      } else if (user.role === "EXPERT") {
        router.push("/expert/onboarding");
      } else if (user.role === "Admin") {
        router.push("/admin/users");
      } else {
        router.push("/dashboard/my-bookings");
      }
    }
  }, [user, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const inputElement = e.target as HTMLInputElement;
    const nextValue = type === "checkbox" ? inputElement.checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    if (type === "checkbox" && nextValue === true) {
      setTimeout(() => { toast.dismiss(); }, 50);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.phone) newErrors.phone = "Phone is required";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!formData.acceptedTerms)
      newErrors.acceptedTerms = "You must accept Terms of Service";
    if (!formData.acceptedPrivacy)
      newErrors.acceptedPrivacy = "You must accept Privacy Policy";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setLoading(true);
    try {
      const roleMap: Record<string, string> = { Coach: "Coach", Expert: "EXPERT" };
      const payload = { ...formData, role: roleMap[formData.userType] || "Player" };
      // @ts-ignore - The API expects role, we derived it from userType
      const response = await authApi.register(payload);
      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        if (formData.userType === "Coach") {
          localStorage.setItem("coachServiceMode", formData.serviceMode);
        }
        if (redirectTo) {
          router.push(redirectTo);
        } else if (formData.userType === "Parent") {
          router.push("/parent-onboarding");
        } else if (response.data.user.role === "Coach") {
          router.push("/coach/verification");
        } else if (response.data.user.role === "VenueLister") {
          router.push("/venue-lister/inventory");
        } else if (response.data.user.role === "EXPERT") {
          router.push("/expert/onboarding");
        } else if (response.data.user.role === "Admin") {
          router.push("/admin/users");
        } else {
          router.push("/dashboard/my-bookings");
        }
      } else {
        toast.error(response.message || "Registration failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: {
    credential?: string;
  }) => {
    try {
      if (!formData.acceptedTerms || !formData.acceptedPrivacy) {
        setErrors((prev) => ({
          ...prev,
          acceptedTerms: formData.acceptedTerms ? "" : "You must accept Terms of Service",
          acceptedPrivacy: formData.acceptedPrivacy ? "" : "You must accept Privacy Policy",
        }));
        toast.error("Please accept Terms and Privacy Policy first");
        return;
      }
      setLoading(true);
      if (!credentialResponse.credential) {
        toast.error("No credential received from Google");
        return;
      }
      const googleRoleMap: Record<string, string> = { Coach: "Coach", Expert: "EXPERT" };
      const googleRole = (googleRoleMap[formData.userType] || "Player") as any;
      const response = await authApi.googleLogin({
        credential: credentialResponse.credential,
        role: googleRole,
        userType: formData.userType as any,
        action: "register",
        acceptedTerms: formData.acceptedTerms,
        acceptedPrivacy: formData.acceptedPrivacy,
      });
      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        if (formData.userType === "Coach") {
          localStorage.setItem("coachServiceMode", formData.serviceMode);
        }
        if (formData.userType === "Parent") {
          router.push("/parent-onboarding");
        } else if (response.data.user.role === "Coach") {
          router.push("/coach/verification");
        } else if (response.data.user.role === "VenueLister") {
          router.push("/venue-lister/inventory");
        } else if (response.data.user.role === "EXPERT") {
          router.push("/expert/onboarding");
        } else if (response.data.user.role === "Admin") {
          router.push("/admin/users");
        } else {
          router.push("/dashboard/my-bookings");
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Google registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    cn(
      "h-11 w-full rounded-xl border px-4 text-sm text-slate-900 dark:text-white",
      "placeholder:text-slate-400 dark:placeholder:text-slate-500",
      "bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:ring-2",
      errors[field]
        ? "border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/15"
        : "border-slate-200 dark:border-slate-700 focus:border-power-orange focus:ring-power-orange/15",
    );

  return (
    <GoogleOAuthProvider
      clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
    >
      <div className="space-y-7">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Create account
          </p>
          <h1 className="mt-1.5 font-title text-[1.75rem] font-black leading-tight text-slate-900 dark:text-white">
            Join the platform
          </h1>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          {/* Name + Email + Phone + Password — 2-column grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {/* Full name — full width */}
            <div className="col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Arjun Singh"
                className={inputClass("name")}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Email — full width */}
            <div className="col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={inputClass("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Phone — left col */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543210"
                className={inputClass("phone")}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Password — right col */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 8 chars"
                  className={cn(inputClass("password"), "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>
          </div>

          {/* Account type — role cards */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              I am a…
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((role) => {
                const selected = formData.userType === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        userType: role.value,
                      }))
                    }
                    className={cn(
                      "relative flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all",
                      selected
                        ? "border-power-orange bg-orange-50 dark:bg-orange-950/20"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                    )}
                  >
                    <role.Icon
                      size={18}
                      className={cn(
                        selected
                          ? "text-power-orange"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          selected
                            ? "text-power-orange"
                            : "text-slate-800 dark:text-slate-200",
                        )}
                      >
                        {role.label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        {role.desc}
                      </p>
                      {"badge" in role && (
                        <span className="mt-1.5 inline-block rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                          {role.badge}
                        </span>
                      )}
                    </div>
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-power-orange">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Want to list your venue?{" "}
              <Link
                href="/onboarding"
                className="font-semibold text-power-orange transition-colors hover:text-orange-600"
              >
                Start venue onboarding
              </Link>
            </p>
          </div>

          {/* Coach service mode */}
          {formData.userType === "Coach" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.28 }}
              className="space-y-1.5 overflow-hidden"
            >
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Coaching mode
              </label>
              <select
                name="serviceMode"
                value={formData.serviceMode}
                onChange={handleChange}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 transition-colors focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="OWN_VENUE">
                  Own Venue — coach at your location
                </option>
                <option value="FREELANCE">
                  Freelance — travel to players
                </option>
                <option value="HYBRID">Hybrid — own venue or travel</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formData.serviceMode === "OWN_VENUE" &&
                  "Your venue details will be stored for booking context."}
                {formData.serviceMode === "FREELANCE" &&
                  "Travel to players for coaching sessions."}
                {formData.serviceMode === "HYBRID" &&
                  "Coach at your venue or travel to players."}
              </p>
            </motion.div>
          )}

          {/* Terms */}
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={formData.acceptedTerms}
                onChange={handleChange}
                value="true"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-power-orange focus:ring-power-orange/50"
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-semibold text-power-orange transition-colors hover:text-orange-600"
                >
                  Terms of Service
                </Link>
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-xs text-red-500">{errors.acceptedTerms}</p>
            )}

            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="acceptedPrivacy"
                checked={formData.acceptedPrivacy}
                onChange={handleChange}
                value="true"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-power-orange focus:ring-power-orange/50"
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-semibold text-power-orange transition-colors hover:text-orange-600"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.acceptedPrivacy && (
              <p className="text-xs text-red-500">{errors.acceptedPrivacy}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="w-full"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
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
            onError={() => toast.error("Google registration failed")}
          />
        </div>

        {/* Sign-in link */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-power-orange transition-colors hover:text-orange-600"
          >
            Sign in
          </Link>
        </p>
      </div>
    </GoogleOAuthProvider>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-10 text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
