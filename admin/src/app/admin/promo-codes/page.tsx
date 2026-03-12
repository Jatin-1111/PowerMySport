"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  PromoCodeRecord,
  PromoCodeStats,
  adminApi,
} from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

const emptyForm = {
  code: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
  discountValue: "",
  applicableTo: "ALL" as "ALL" | "VENUE_ONLY" | "COACH_ONLY",
  validFrom: "",
  validUntil: "",
  minBookingAmount: "",
  maxDiscountAmount: "",
  maxUsageTotal: "",
  maxUsagePerUser: "",
};

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<{
    id: string;
    stats: PromoCodeStats;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.listPromoCodes();
      if (response.success && response.data) {
        setCodes(response.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const handleDeactivate = async (codeId: string) => {
    if (!window.confirm("Deactivate this promo code?")) return;
    setBusyId(codeId);
    try {
      await adminApi.deactivatePromoCode(codeId);
      await loadCodes();
    } finally {
      setBusyId(null);
    }
  };

  const handleViewStats = async (codeId: string) => {
    if (selectedStats?.id === codeId) {
      setSelectedStats(null);
      return;
    }
    setLoadingStats(codeId);
    try {
      const response = await adminApi.getPromoCodeStats(codeId);
      if (response.success && response.data) {
        setSelectedStats({ id: codeId, stats: response.data });
      }
    } finally {
      setLoadingStats(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const discountValue = Number(form.discountValue);
    if (!form.code.trim() || !form.description.trim()) {
      setFormError("Code and description are required.");
      return;
    }
    if (!discountValue || discountValue <= 0) {
      setFormError("Discount value must be positive.");
      return;
    }
    if (form.discountType === "PERCENTAGE" && discountValue > 100) {
      setFormError("Percentage discount cannot be greater than 100.");
      return;
    }
    if (!form.validFrom || !form.validUntil) {
      setFormError("Valid-from and valid-until dates are required.");
      return;
    }
    const validFromDate = new Date(`${form.validFrom}T00:00:00.000Z`);
    const validUntilDate = new Date(`${form.validUntil}T23:59:59.999Z`);

    if (
      Number.isNaN(validFromDate.getTime()) ||
      Number.isNaN(validUntilDate.getTime())
    ) {
      setFormError("Please provide valid dates.");
      return;
    }

    if (validUntilDate <= validFromDate) {
      setFormError("Valid-until must be after valid-from.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Parameters<typeof adminApi.createPromoCode>[0] = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discountType: form.discountType,
        discountValue,
        applicableTo: form.applicableTo,
        validFrom: validFromDate.toISOString(),
        validUntil: validUntilDate.toISOString(),
        ...(form.minBookingAmount
          ? { minBookingAmount: Number(form.minBookingAmount) }
          : {}),
        ...(form.maxDiscountAmount
          ? { maxDiscountAmount: Number(form.maxDiscountAmount) }
          : {}),
        ...(form.maxUsageTotal
          ? { maxUsageTotal: Number(form.maxUsageTotal) }
          : {}),
        ...(form.maxUsagePerUser
          ? { maxUsagePerUser: Number(form.maxUsagePerUser) }
          : {}),
      };

      const response = await adminApi.createPromoCode(payload);
      if (response.success) {
        setForm(emptyForm);
        setShowForm(false);
        await loadCodes();
      } else {
        setFormError(response.message || "Failed to create promo code.");
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Promo Codes"
        subtitle="Create and manage discount codes for bookings."
      />

      <div className="flex justify-end">
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
          }}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Promo Code"}
        </button>
      </div>

      {showForm && (
        <Card className="bg-white">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Create Promo Code
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Code *
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. SPORT20"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Description *
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. 20% off all venues"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Discount Type *
                </label>
                <select
                  className={inputCls}
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountType: e.target.value as
                        | "PERCENTAGE"
                        | "FIXED_AMOUNT",
                    }))
                  }
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Discount Value *
                </label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder={
                    form.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 200"
                  }
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountValue: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Applicable To
                </label>
                <select
                  className={inputCls}
                  value={form.applicableTo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      applicableTo: e.target.value as
                        | "ALL"
                        | "VENUE_ONLY"
                        | "COACH_ONLY",
                    }))
                  }
                >
                  <option value="ALL">All</option>
                  <option value="VENUE_ONLY">Venue Only</option>
                  <option value="COACH_ONLY">Coach Only</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Min Booking Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="Optional"
                  value={form.minBookingAmount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minBookingAmount: e.target.value,
                    }))
                  }
                />
              </div>
              {form.discountType === "PERCENTAGE" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="Optional"
                    value={form.maxDiscountAmount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxDiscountAmount: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Max Total Uses
                </label>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Unlimited if empty"
                  value={form.maxUsageTotal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxUsageTotal: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Max Uses Per User
                </label>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Unlimited if empty"
                  value={form.maxUsagePerUser}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxUsagePerUser: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Valid From *
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.validFrom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validFrom: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Valid Until *
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validUntil: e.target.value }))
                  }
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600 font-medium">{formError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                  setFormError(null);
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Code"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="bg-white space-y-4">
        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading promo codes...
          </div>
        ) : codes.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No promo codes yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Code",
                    "Description",
                    "Discount",
                    "Applies To",
                    "Valid",
                    "Usage",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codes.map((pc) => (
                  <>
                    <tr key={pc._id}>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900">
                        {pc.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-48">
                        {pc.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        {pc.discountType === "PERCENTAGE"
                          ? `${pc.discountValue}%`
                          : `₹${pc.discountValue}`}
                        {pc.maxDiscountAmount
                          ? ` (cap ₹${pc.maxDiscountAmount})`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {pc.applicableTo}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(pc.validFrom).toLocaleDateString()} –{" "}
                        {new Date(pc.validUntil).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {pc.currentUsageCount}
                        {pc.maxUsageTotal ? ` / ${pc.maxUsageTotal}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            pc.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {pc.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewStats(pc._id)}
                            disabled={loadingStats === pc._id}
                            className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                          >
                            {loadingStats === pc._id
                              ? "..."
                              : selectedStats?.id === pc._id
                                ? "Hide Stats"
                                : "Stats"}
                          </button>
                          {pc.isActive && (
                            <button
                              onClick={() => handleDeactivate(pc._id)}
                              disabled={busyId === pc._id}
                              className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {selectedStats?.id === pc._id && (
                      <tr key={`${pc._id}-stats`}>
                        <td
                          colSpan={8}
                          className="bg-slate-50 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap gap-6">
                            <div>
                              <span className="text-xs text-slate-500 uppercase tracking-wide">
                                Total Uses
                              </span>
                              <p className="text-lg font-bold text-slate-900">
                                {selectedStats.stats.totalUsage}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 uppercase tracking-wide">
                                Total Discount Given
                              </span>
                              <p className="text-lg font-bold text-slate-900">
                                ₹{selectedStats.stats.totalDiscountGiven}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500 uppercase tracking-wide">
                                Unique Users
                              </span>
                              <p className="text-lg font-bold text-slate-900">
                                {selectedStats.stats.uniqueUsers}
                              </p>
                            </div>
                          </div>
                          {selectedStats.stats.recentUsages.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                                Recent Usages
                              </p>
                              <ul className="space-y-0.5 text-xs text-slate-600">
                                {selectedStats.stats.recentUsages.map(
                                  (u, i) => (
                                    <li key={i}>
                                      User {u.userId.slice(-6)} — ₹
                                      {u.discountApplied} on{" "}
                                      {new Date(u.usedAt).toLocaleDateString()}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
