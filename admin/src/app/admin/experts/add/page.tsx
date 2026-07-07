"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  expertAdminApi,
  type AdminExpertAvailabilityWindow,
} from "@/modules/expert/services/expert";
import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import { AvailabilityEditor } from "@/modules/expert/components/AvailabilityEditor";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import { toast } from "@/lib/toast";
import {
  ArrowLeft,
  User,
  Briefcase,
  Calendar,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  sessionFee: z.string().min(1, "Fee must be greater than 0"),
  sessionMode: z.enum(["ONLINE", "IN_PERSON", "BOTH"]),
  city: z.string().optional(),
  sports: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().optional(),
  achievements: z.string().optional(),
  inPersonAddress: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddExpertPage() {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      sessionFee: "",
      sessionMode: "ONLINE",
      city: "",
      sports: [],
      expertise: [],
      languages: [],
      bio: "",
      achievements: "",
      inPersonAddress: "",
    },
    mode: "onTouched",
  });

  const sessionMode = watch("sessionMode");
  const showAddressField =
    sessionMode === "IN_PERSON" || sessionMode === "BOTH";

  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [duration, setDuration] = useState("60");
  const [windows, setWindows] = useState<AdminExpertAvailabilityWindow[]>([]);
  const [blackout, setBlackout] = useState<string[]>([]);

  const onSubmit = async (data: FormValues) => {
    for (const w of windows) {
      if (w.start >= w.end) {
        toast.error("An availability window has an invalid time range.");
        return;
      }
    }

    try {
      const res = await expertAdminApi.create({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        sessionFee: Number(data.sessionFee),
        sessionMode: data.sessionMode,
        city: data.city?.trim() || undefined,
        sports: data.sports || [],
        expertise: data.expertise || [],
        languages: data.languages || [],
        bio: data.bio?.trim() || undefined,
        achievements: data.achievements?.trim() || undefined,
        inPersonAddress: data.inPersonAddress?.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        photoKey: photoKey || undefined,
        sessionDurationMinutes: Number(duration) || 60,
        weeklyAvailability: windows,
        blackoutDates: blackout,
      });

      if (res.success) {
        toast.success("Expert created — login credentials emailed.");
        router.push("/admin/experts");
      } else {
        toast.error(res.message || "Failed to create expert.");
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create expert.";
      toast.error(msg);
    }
  };

  const InputField = ({
    label,
    field,
    type = "text",
    placeholder = "",
    min,
    required = false,
  }: {
    label: string;
    field: keyof FormValues;
    type?: string;
    placeholder?: string;
    min?: number;
    required?: boolean;
  }) => {
    const error = errors[field]?.message;
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          min={min}
          placeholder={placeholder}
          {...register(field)}
          className={cn(
            "w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-slate-200 focus:border-power-orange focus:ring-power-orange/20",
          )}
        />
        {error && (
          <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-500">
            <AlertCircle className="h-3 w-3" /> {error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-28">
      <AdminPageHeader
        badge="Admin"
        title="Add expert"
        subtitle="Create an expert profile. This provisions their login and emails temporary credentials."
      />

      <Link
        href="/admin/experts"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to experts
      </Link>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-8 lg:grid-cols-3"
      >
        <div className="space-y-8 lg:col-span-2">
          {/* Section 1: Personal Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Personal Details
                </h2>
                <p className="text-sm text-slate-500">
                  Basic information and contact details.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <InputField
                label="Full Name"
                field="name"
                placeholder="e.g. Rahul Dravid"
                required
              />
              <InputField
                label="Email Address"
                field="email"
                type="email"
                placeholder="e.g. expert@example.com"
                required
              />
              <InputField
                label="Phone Number"
                field="phone"
                placeholder="e.g. 9876543210"
                required
              />
              <InputField label="City" field="city" placeholder="e.g. Mumbai" />
            </div>
          </div>

          {/* Section 2: Professional Profile */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Professional Profile
                </h2>
                <p className="text-sm text-slate-500">
                  Service offerings, fees, and bio.
                </p>
              </div>
            </div>

            <div className="mb-6 grid gap-5 sm:grid-cols-2">
              <InputField
                label="Session Fee (₹)"
                field="sessionFee"
                type="number"
                min={0}
                placeholder="e.g. 1500"
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Session Mode
                </label>
                <select
                  {...register("sessionMode")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                >
                  <option value="ONLINE">Online</option>
                  <option value="IN_PERSON">In-person</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>

              {showAddressField && (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    In-person location
                  </label>
                  <input
                    placeholder="e.g. 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh"
                    {...register("inPersonAddress")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                  />
                  <p className="text-xs text-slate-500">
                    Shown to a client only after they've booked a session —
                    never on the public listing.
                  </p>
                </div>
              )}

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Sports
                </label>
                <Controller
                  name="sports"
                  control={control}
                  render={({ field }) => (
                    <SportsMultiSelect
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  )}
                />
                {errors.sports && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-500">
                    <AlertCircle className="h-3 w-3" /> {errors.sports.message}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Expertise
                </label>
                <Controller
                  name="expertise"
                  control={control}
                  render={({ field }) => (
                    <ExpertiseMultiSelect
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Languages
                </label>
                <Controller
                  name="languages"
                  control={control}
                  render={({ field }) => (
                    <LanguagesMultiSelect
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Bio
                </label>
                <textarea
                  rows={4}
                  {...register("bio")}
                  placeholder="Tell clients about this expert..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Achievements
                </label>
                <textarea
                  rows={3}
                  {...register("achievements")}
                  placeholder="List major accomplishments..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Photo Upload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Profile Photo
            </h3>
            <CoachPhotoUpload
              currentPhotoUrl={photoUrl || undefined}
              onPhotoReady={(url, key) => {
                setPhotoUrl(url || "");
                setPhotoKey(key);
              }}
            />
          </div>

          {/* Availability */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-power-orange" />
              <h3 className="text-sm font-bold text-slate-900">Availability</h3>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-slate-500">
              Set the expert's weekly hours so clients can book right away.
              Leave this blank to let them set it themselves later.
            </p>

            <div className="mb-6 flex flex-col gap-1.5 border-b border-slate-100 pb-6">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Session length (mins)
              </label>
              <input
                type="number"
                min={15}
                step={15}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <AvailabilityEditor
              windows={windows}
              blackout={blackout}
              onWindowsChange={setWindows}
              onBlackoutChange={setBlackout}
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:pl-64 lg:pl-72">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
            <p className="hidden text-sm text-slate-500 sm:block">
              Login credentials will be automatically emailed to the expert.
            </p>
            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              <Link
                href="/admin/experts"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-power-orange px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow disabled:opacity-60 disabled:hover:shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating...
                  </>
                ) : (
                  "Create Expert Profile"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
