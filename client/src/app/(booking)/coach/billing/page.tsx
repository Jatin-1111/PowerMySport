"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  CalendarRange,
  Loader2,
  PencilLine,
  Plus,
  Sparkles,
  Ticket,
  TrendingUp,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CoachSubscriptionPackage,
  CoachSubscriptionPackageCreateInput,
  CoachSubscriptionPackageFrequency,
} from "@/types";

const FREQUENCY_OPTIONS: Array<{
  value: CoachSubscriptionPackageFrequency;
  label: string;
  cadence: string;
  description: string;
}> = [
  {
    value: "MONTHLY",
    label: "Monthly",
    cadence: "/ month",
    description: "Best for flexible recurring coaching access.",
  },
  {
    value: "QUARTERLY",
    label: "Quarterly",
    cadence: "/ 3 months",
    description: "Good balance between commitment and affordability.",
  },
  {
    value: "YEARLY",
    label: "Yearly",
    cadence: "/ year",
    description: "Ideal for premium annual coaching plans.",
  },
];

const DEFAULT_FORM = {
  name: "",
  description: "",
  frequency: "MONTHLY" as CoachSubscriptionPackageFrequency,
  priceRupees: "",
  featuresText: "",
  maxStudents: "",
  maxSessions: "",
  isActive: true,
};

type PackageFormState = typeof DEFAULT_FORM;

type PackageFormField = keyof PackageFormState;

type PackageFormErrors = Partial<Record<PackageFormField, string>>;

const formatCurrencyFromPaise = (value?: number) => {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
};

const formatRupees = (value?: number) => {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
};

const parseFeatureList = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const parseOptionalWholeNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return NaN;
  }

  return parsed;
};

const buildFormErrors = (form: PackageFormState): PackageFormErrors => {
  const errors: PackageFormErrors = {};

  if (form.name.trim().length < 3) {
    errors.name = "Use a clear name with at least 3 characters.";
  } else if (form.name.trim().length > 80) {
    errors.name = "Keep the package name under 80 characters.";
  }

  if (form.description.trim().length > 500) {
    errors.description = "Description cannot exceed 500 characters.";
  }

  const parsedPrice = Number(form.priceRupees);
  if (!form.priceRupees.trim()) {
    errors.priceRupees = "Enter a price in INR.";
  } else if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    errors.priceRupees = "Enter a valid price greater than 0.";
  }

  const maxStudents = parseOptionalWholeNumber(form.maxStudents);
  if (Number.isNaN(maxStudents)) {
    errors.maxStudents = "Use a whole number of at least 1, or leave it blank.";
  }

  const maxSessions = parseOptionalWholeNumber(form.maxSessions);
  if (Number.isNaN(maxSessions)) {
    errors.maxSessions = "Use a whole number of at least 1, or leave it blank.";
  }

  const features = parseFeatureList(form.featuresText);
  if (form.featuresText.trim() && features.length === 0) {
    errors.featuresText = "Add at least one feature or clear this field.";
  }

  return errors;
};

const buildPackagePayload = (
  form: PackageFormState,
): CoachSubscriptionPackageCreateInput => {
  const features = parseFeatureList(form.featuresText);
  const priceRupees = Number(form.priceRupees);

  const payload: CoachSubscriptionPackageCreateInput = {
    name: form.name.trim(),
    frequency: form.frequency,
    price: Math.round(priceRupees * 100),
    features,
    isActive: form.isActive,
  };

  const description = form.description.trim();
  if (description) {
    payload.description = description;
  }

  const maxStudents = parseOptionalWholeNumber(form.maxStudents);
  if (maxStudents !== null) {
    payload.maxStudents = maxStudents;
  }

  const maxSessions = parseOptionalWholeNumber(form.maxSessions);
  if (maxSessions !== null) {
    payload.maxSessions = maxSessions;
  }

  return payload;
};

const packageToForm = (pkg: CoachSubscriptionPackage): PackageFormState => ({
  name: pkg.name,
  description: pkg.description ?? "",
  frequency: pkg.frequency,
  priceRupees:
    typeof pkg.price === "number" && Number.isFinite(pkg.price)
      ? String(pkg.price / 100)
      : "",
  featuresText: pkg.features.join("\n"),
  maxStudents:
    typeof pkg.maxStudents === "number" ? String(pkg.maxStudents) : "",
  maxSessions:
    typeof pkg.maxSessions === "number" ? String(pkg.maxSessions) : "",
  isActive: pkg.isActive,
});

export default function CoachBillingPage() {
  const [packages, setPackages] = useState<CoachSubscriptionPackage[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);
  const [subscriptionRevenue, setSubscriptionRevenue] = useState<{
    total: number;
    count: number;
    byFrequency: Record<string, number>;
  }>({
    total: 0,
    count: 0,
    byFrequency: { MONTHLY: 0, QUARTERLY: 0, YEARLY: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<PackageFormState>(DEFAULT_FORM);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageToDelete, setPackageToDelete] =
    useState<CoachSubscriptionPackage | null>(null);
  const [touched, setTouched] = useState<Record<PackageFormField, boolean>>({
    name: false,
    description: false,
    frequency: false,
    priceRupees: false,
    featuresText: false,
    maxStudents: false,
    maxSessions: false,
    isActive: false,
  });

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const [packagesResult, subscriptionsResult, revenueResult] =
        await Promise.allSettled([
          coachApi.listMyPackages(),
          coachApi.getCoachActiveSubscriptions(),
          coachApi.getSubscriptionRevenue(),
        ]);

      if (packagesResult.status === "fulfilled") {
        setPackages(packagesResult.value.data?.packages || []);
      }

      if (subscriptionsResult.status === "fulfilled") {
        setActiveSubscriptions(
          subscriptionsResult.value.data?.subscriptions || [],
        );
      }

      if (revenueResult.status === "fulfilled") {
        setSubscriptionRevenue(
          revenueResult.value.data?.revenue || {
            total: 0,
            count: 0,
            byFrequency: { MONTHLY: 0, QUARTERLY: 0, YEARLY: 0 },
          },
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const formErrors = useMemo(() => buildFormErrors(form), [form]);
  const showError = (field: PackageFormField) =>
    submitAttempted || touched[field];
  const featureList = useMemo(
    () => parseFeatureList(form.featuresText),
    [form.featuresText],
  );
  const previewPrice = useMemo(() => {
    const value = Number(form.priceRupees);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [form.priceRupees]);

  const isFormValid = useMemo(() => {
    const price = Number(form.priceRupees);
    return (
      form.name.trim().length >= 3 &&
      Number.isFinite(price) &&
      price > 0 &&
      Object.keys(formErrors).length === 0
    );
  }, [form.name, form.priceRupees, formErrors]);

  const editingPackage = useMemo(
    () =>
      packages.find((pkg) => (pkg._id || pkg.id) === editingPackageId) ?? null,
    [editingPackageId, packages],
  );

  const isSaving = creating || updating;

  const packageCounts = useMemo(() => {
    const frequencyBreakdown = packages.reduce(
      (acc, pkg) => {
        acc[pkg.frequency] += 1;
        return acc;
      },
      { MONTHLY: 0, QUARTERLY: 0, YEARLY: 0 } as Record<
        CoachSubscriptionPackageFrequency,
        number
      >,
    );

    return {
      total: packages.length,
      active: packages.filter((pkg) => pkg.isActive).length,
      subscribers: activeSubscriptions.length,
      revenue: subscriptionRevenue.total,
      frequencyBreakdown,
    };
  }, [activeSubscriptions.length, packages, subscriptionRevenue.total]);

  const setField = <T extends PackageFormField>(
    field: T,
    value: PackageFormState[T],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: PackageFormField) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingPackageId(null);
    setSubmitAttempted(false);
    setTouched({
      name: false,
      description: false,
      frequency: false,
      priceRupees: false,
      featuresText: false,
      maxStudents: false,
      maxSessions: false,
      isActive: false,
    });
  };

  const startEditing = (pkg: CoachSubscriptionPackage) => {
    setEditingPackageId(pkg._id || pkg.id || null);
    setForm(packageToForm(pkg));
    setSubmitAttempted(false);
    setTouched({
      name: false,
      description: false,
      frequency: false,
      priceRupees: false,
      featuresText: false,
      maxStudents: false,
      maxSessions: false,
      isActive: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    setSubmitAttempted(true);

    if (Object.keys(formErrors).length > 0) {
      toast.error("Fix the highlighted fields before saving this package.");
      return;
    }

    if (editingPackageId) {
      setUpdating(true);
    } else {
      setCreating(true);
    }

    try {
      const payload = buildPackagePayload(form);
      const response = editingPackageId
        ? await coachApi.updatePackage(editingPackageId, payload)
        : await coachApi.createPackage(payload);

      if (!response.success) {
        throw new Error(response.message || "Save failed");
      }

      toast.success(editingPackageId ? "Package updated" : "Package created");
      resetForm();
      await loadPackages();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create package",
      );
    } finally {
      setCreating(false);
      setUpdating(false);
    }
  };

  const handleDeletePackage = async () => {
    if (!packageToDelete) {
      return;
    }

    const packageId = packageToDelete._id || packageToDelete.id;
    if (!packageId) {
      toast.error("Unable to delete this package right now.");
      setPackageToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const response = await coachApi.deletePackage(packageId);
      if (!response.success) {
        throw new Error(response.message || "Delete failed");
      }

      if ((editingPackageId ?? "") === packageId) {
        resetForm();
      }

      toast.success("Package deleted");
      setPackageToDelete(null);
      await loadPackages();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete package",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-3 px-2 py-2 sm:space-y-4 sm:px-3 sm:py-3 lg:px-4">
        <Card className="overflow-hidden border-white/70 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-md">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_45%,#fff5e8_100%)] p-4 sm:p-6">
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                <Sparkles size={12} /> Package builder
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                Create subscription packages that feel premium and easy to buy.
              </h1>
              <p className="max-w-2xl text-xs leading-5 text-slate-600 sm:text-sm lg:text-base">
                Shape monthly, quarterly, or yearly packages with clear pricing,
                precise limits, and a polished player-facing preview. The price
                you enter is converted to paise on save, so the backend gets
                clean numeric data.
              </p>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-turf-green/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
          </div>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Total packages",
              value: packageCounts.total,
              icon: Ticket,
            },
            {
              label: "Active packages",
              value: packageCounts.active,
              icon: CheckCircle2,
            },
            {
              label: "Monthly plans",
              value: packageCounts.frequencyBreakdown.MONTHLY,
              icon: CalendarRange,
            },
            {
              label: "Yearly plans",
              value: packageCounts.frequencyBreakdown.YEARLY,
              icon: TrendingUp,
            },
            {
              label: "Active subscribers",
              value: packageCounts.subscribers,
              icon: Users,
            },
            {
              label: "Revenue",
              value: formatCurrencyFromPaise(packageCounts.revenue),
              icon: Coins,
            },
          ].map((item) => (
            <Card
              key={item.label}
              className="border-slate-200 bg-white/90 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 sm:text-sm">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">
                    {item.value}
                  </p>
                </div>
                <span className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                  <item.icon size={16} />
                </span>
              </div>
            </Card>
          ))}
        </div>

        {activeSubscriptions.length > 0 ? (
          <Card className="border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
                  Active subscribers
                </h2>
                <p className="text-xs text-slate-600 sm:text-sm">
                  Players currently subscribed to your packages.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {activeSubscriptions.length} active
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {activeSubscriptions.map((subscription: any) => {
                const packageData = subscription.packageId as
                  | { name?: string; frequency?: string }
                  | string
                  | null
                  | undefined;
                const userData = subscription.userId as
                  | { name?: string; email?: string }
                  | string
                  | null
                  | undefined;

                return (
                  <div
                    key={subscription.id || subscription._id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {typeof userData === "string"
                          ? "Player"
                          : userData?.name || userData?.email || "Player"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {typeof packageData === "string"
                          ? "Subscription package"
                          : packageData?.name || "Subscription package"}
                        {subscription.currentPeriodEnd
                          ? ` • Expires ${new Date(
                              subscription.currentPeriodEnd,
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {subscription.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        <div className="grid gap-3 lg:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-950 sm:text-2xl lg:text-2xl">
                    {editingPackage ? "Edit package" : "Build a package"}
                  </h2>
                  {editingPackage ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Editing existing package
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  Use concise names, clear inclusions, and realistic limits. The
                  live preview updates as you type.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Optimized for player conversion
              </span>
            </div>

            <div className="mt-2 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Package name
                  </label>
                  <Input
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    onBlur={() => markTouched("name")}
                    placeholder="Gold coaching membership"
                    className={`rounded-xl text-xs sm:text-sm ${showError("name") && formErrors.name ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Keep it specific and easy to scan.</span>
                    <span>{form.name.trim().length}/80</span>
                  </div>
                  {showError("name") && formErrors.name ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={12} /> {formErrors.name}
                    </p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Frequency
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3 items-stretch">
                    {FREQUENCY_OPTIONS.map((option) => {
                      const active = form.frequency === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setField("frequency", option.value)}
                          onBlur={() => markTouched("frequency")}
                          className={`w-full h-full rounded-2xl border p-4 text-left transition ${active ? "border-turf-green bg-turf-green/5 ring-4 ring-turf-green/10" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <div className="flex h-full flex-col justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-950 sm:text-sm">
                                {option.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {option.description}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] ${active ? "bg-turf-green text-white" : "bg-slate-100 text-slate-600"}`}
                              >
                                {option.cadence}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Choose the package cadence that best matches the commitment
                    you want.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Description
                  </label>
                  <Textarea
                    value={form.description}
                    onChange={(event) =>
                      setField("description", event.target.value)
                    }
                    onBlur={() => markTouched("description")}
                    placeholder="Explain who this package is for and what it unlocks."
                    rows={4}
                    className={`${showError("description") && formErrors.description ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Players read this before they buy.</span>
                    <span>{form.description.trim().length}/500</span>
                  </div>
                  {showError("description") && formErrors.description ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={14} /> {formErrors.description}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Price (INR)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    value={form.priceRupees}
                    onChange={(event) =>
                      setField("priceRupees", event.target.value)
                    }
                    onBlur={() => markTouched("priceRupees")}
                    placeholder="4999"
                    inputMode="decimal"
                    pattern="^\\d+(\\.\\d{1,2})?$"
                    aria-invalid={
                      showError("priceRupees") && !!formErrors.priceRupees
                    }
                    className={`${showError("priceRupees") && formErrors.priceRupees ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Stored as paise on save.</span>
                    <span>
                      ₹ {previewPrice ? formatRupees(previewPrice) : "0"}
                    </span>
                  </div>
                  {showError("priceRupees") && formErrors.priceRupees ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={14} /> {formErrors.priceRupees}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Package status
                  </label>
                  <button
                    type="button"
                    onClick={() => setField("isActive", !form.isActive)}
                    onBlur={() => markTouched("isActive")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition sm:px-4 sm:py-3 ${form.isActive ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-950 sm:text-sm">
                        {form.isActive ? "Published" : "Saved as inactive"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Inactive packages stay hidden from players.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${form.isActive ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
                    >
                      {form.isActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Max students
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={form.maxStudents}
                    onChange={(event) =>
                      setField("maxStudents", event.target.value)
                    }
                    onBlur={() => markTouched("maxStudents")}
                    placeholder="Unlimited"
                    className={`${showError("maxStudents") && formErrors.maxStudents ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Leave blank if the package should stay flexible.
                  </p>
                  {showError("maxStudents") && formErrors.maxStudents ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={14} /> {formErrors.maxStudents}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Max sessions
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={form.maxSessions}
                    onChange={(event) =>
                      setField("maxSessions", event.target.value)
                    }
                    onBlur={() => markTouched("maxSessions")}
                    placeholder="Unlimited"
                    className={`${showError("maxSessions") && formErrors.maxSessions ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Leave blank if you do not want to cap session count.
                  </p>
                  {showError("maxSessions") && formErrors.maxSessions ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={14} /> {formErrors.maxSessions}
                    </p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-900 sm:text-sm">
                    Features
                  </label>
                  <Textarea
                    value={form.featuresText}
                    onChange={(event) =>
                      setField("featuresText", event.target.value)
                    }
                    onBlur={() => markTouched("featuresText")}
                    placeholder={
                      "Examples:\n1-on-1 weekly coaching\nProgress tracking\nPriority WhatsApp support"
                    }
                    rows={5}
                    className={`${showError("featuresText") && formErrors.featuresText ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"}`}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span>
                      Enter one feature per line or separate with commas.
                    </span>
                    <span>{featureList.length} feature(s)</span>
                  </div>
                  {featureList.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featureList.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 sm:px-3 sm:py-1"
                        >
                          <Zap
                            size={10}
                            className="text-turf-green sm:block hidden"
                          />
                          <Zap
                            size={10}
                            className="text-turf-green sm:hidden"
                          />
                          {feature}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {showError("featuresText") && formErrors.featuresText ? (
                    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                      <AlertCircle size={12} /> {formErrors.featuresText}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 sm:text-sm">
                  You can always change a package later. Start with a simple,
                  easy-to-understand offer.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    variant="secondary"
                    onClick={resetForm}
                    disabled={creating}
                    className="w-full whitespace-nowrap sm:flex-1"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !isFormValid}
                    loading={isSaving}
                    fullWidth
                    icon={
                      !isSaving ? (
                        editingPackage ? (
                          <PencilLine size={14} />
                        ) : (
                          <Plus size={14} />
                        )
                      ) : undefined
                    }
                    className="bg-turf-green hover:bg-green-700 whitespace-nowrap sm:flex-1"
                  >
                    {editingPackage ? "Save changes" : "Create package"}
                  </Button>
                  {editingPackage ? (
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      disabled={isSaving}
                      className="w-full whitespace-nowrap sm:flex-1"
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Card className="xl:sticky xl:top-6 border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
                    Live preview
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    This is close to what players will see before subscribing.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 ${form.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {form.isActive ? "Visible" : "Hidden"}
                </span>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_40%,#fff8ef_100%)] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Package headline
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-950">
                      {form.name.trim() || "Your package name"}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {form.description.trim() ||
                        "Add a short description to explain who this package is for."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-sm sm:text-right">
                    <p className="text-2xl font-bold text-slate-950">
                      {previewPrice
                        ? formatCurrencyFromPaise(
                            Math.round(previewPrice * 100),
                          )
                        : "₹0"}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {FREQUENCY_OPTIONS.find(
                        (option) => option.value === form.frequency,
                      )?.label || "Monthly"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                    {form.frequency}
                  </span>
                  {Number.isInteger(parseOptionalWholeNumber(form.maxStudents)) ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      Up to {parseOptionalWholeNumber(form.maxStudents)}{" "}
                      students
                    </span>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      Flexible student count
                    </span>
                  )}
                  {Number.isInteger(parseOptionalWholeNumber(form.maxSessions)) ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      {parseOptionalWholeNumber(form.maxSessions)} sessions
                    </span>
                  ) : (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      Flexible session count
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Included features
                  </p>
                  <div className="mt-3 space-y-2">
                    {featureList.length > 0 ? (
                      featureList.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0 text-turf-green"
                          />
                          <span>{feature}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        Add features and they will appear here as bullets.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600">
                <div className="flex gap-3">
                  <Coins size={18} className="mt-0.5 text-power-orange" />
                  <p>
                    The number you enter is treated as INR in the form and
                    converted to paise before saving.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Users size={18} className="mt-0.5 text-turf-green" />
                  <p>
                    Keep the package focused. Three to five concrete benefits
                    usually convert better than a long list.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Publishing checklist
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    A good package is clear, narrow, and easy to understand in
                    under 10 seconds.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex gap-3">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  <p>
                    Use a short name that describes the outcome, not just the
                    billing cycle.
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  <p>
                    State the real limits if there are any. Vague limits create
                    support friction later.
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  <p>
                    Prefer outcomes and support details over generic marketing
                    copy.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card className="border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Your packages
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Review the packages you’ve published so far.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading packages...
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-10">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">
                  No packages yet
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Create your first package above. Keep it simple, clear, and
                  easy to buy.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => {
                const priceLabel = formatCurrencyFromPaise(pkg.price);
                const frequencyLabel =
                  FREQUENCY_OPTIONS.find(
                    (option) => option.value === pkg.frequency,
                  )?.label || pkg.frequency;

                return (
                  <div
                    key={pkg._id || pkg.id}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-slate-950">
                          {pkg.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {frequencyLabel} • {priceLabel}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pkg.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {pkg.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {pkg.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {pkg.description}
                      </p>
                    ) : null}

                    {pkg.features?.length ? (
                      <div className="mt-4 space-y-2">
                        {pkg.features.map((feature: string) => (
                          <div
                            key={feature}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <CheckCircle2
                              size={16}
                              className="mt-0.5 shrink-0 text-turf-green"
                            />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        No features listed yet.
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                      {typeof pkg.maxStudents === "number" ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Up to {pkg.maxStudents} students
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Unlimited students
                        </span>
                      )}
                      {typeof pkg.maxSessions === "number" ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {pkg.maxSessions} sessions
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Unlimited sessions
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(pkg)}
                        icon={<PencilLine size={14} />}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setPackageToDelete(pkg)}
                        icon={<Trash2 size={14} />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        isOpen={Boolean(packageToDelete)}
        onClose={() => setPackageToDelete(null)}
        onConfirm={handleDeletePackage}
        title="Delete package"
        message={`Delete ${packageToDelete?.name ?? "this package"}? This cannot be undone and players will stop seeing it immediately.`}
        confirmLabel="Delete package"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
