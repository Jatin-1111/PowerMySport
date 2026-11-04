"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { PromoCodeRecord, PromoCodeStats, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { Fragment, useCallback, useEffect, useState } from "react";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";

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

  const [pendingDeactivate, setPendingDeactivate] = useState<PromoCodeRecord | null>(null);

  const handleDeactivate = async (codeId: string) => {
    setBusyId(codeId);
    try {
      await adminApi.deactivatePromoCode(codeId);
      await loadCodes();
    } finally {
      setBusyId(null);
      setPendingDeactivate(null);
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

    if (Number.isNaN(validFromDate.getTime()) || Number.isNaN(validUntilDate.getTime())) {
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
        ...(form.minBookingAmount ? { minBookingAmount: Number(form.minBookingAmount) } : {}),
        ...(form.maxDiscountAmount ? { maxDiscountAmount: Number(form.maxDiscountAmount) } : {}),
        ...(form.maxUsageTotal ? { maxUsageTotal: Number(form.maxUsageTotal) } : {}),
        ...(form.maxUsagePerUser ? { maxUsagePerUser: Number(form.maxUsagePerUser) } : {}),
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

  const inputCls = fieldClass;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Commerce"
        title="Promo codes"
        subtitle="Discount codes players can apply at checkout."
        action={
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className={showForm ? btn("outline") : btn("accent")}
          >
            {showForm ? "Cancel" : "New promo code"}
          </button>
        }
      />

      {showForm && (
        <Panel title="Create promo code">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Code *</label>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description *
                </label>
                <input
                  className={inputCls}
                  placeholder="e.g. 20% off all venues"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Discount Type *
                </label>
                <select
                  className={inputCls}
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountType: e.target.value as "PERCENTAGE" | "FIXED_AMOUNT",
                    }))
                  }
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Discount Value *
                </label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder={form.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 200"}
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Applicable To
                </label>
                <select
                  className={inputCls}
                  value={form.applicableTo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      applicableTo: e.target.value as "ALL" | "VENUE_ONLY" | "COACH_ONLY",
                    }))
                  }
                >
                  <option value="ALL">All</option>
                  <option value="VENUE_ONLY">Venue Only</option>
                  <option value="COACH_ONLY">Coach Only</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
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
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Max Total Uses
                </label>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Unlimited if empty"
                  value={form.maxUsageTotal}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsageTotal: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Max Uses Per User
                </label>
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Unlimited if empty"
                  value={form.maxUsagePerUser}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsagePerUser: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valid From *
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valid Until *
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                  setFormError(null);
                }}
                className={btn("outline")}
              >
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={btn("primary")}>
                {submitting ? "Creating…" : "Create code"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel flush>
        {loading ? (
          <SkeletonBlock rows={6} label="Loading promo codes" />
        ) : codes.length === 0 ? (
          <EmptyState
            title="No promo codes yet"
            description="Create one to offer players a discount."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end px-5">
              <ExportCsvButton
                filename="promo-codes.csv"
                rows={codes}
                columns={[
                  { header: "Code", value: (pc) => pc.code },
                  { header: "Description", value: (pc) => pc.description },
                  { header: "Discount Type", value: (pc) => pc.discountType },
                  { header: "Discount Value", value: (pc) => pc.discountValue },
                  { header: "Applies To", value: (pc) => pc.applicableTo },
                  {
                    header: "Valid From",
                    value: (pc) => new Date(pc.validFrom).toISOString(),
                  },
                  {
                    header: "Valid Until",
                    value: (pc) => new Date(pc.validUntil).toISOString(),
                  },
                  {
                    header: "Usage",
                    value: (pc) => pc.currentUsageCount,
                  },
                  {
                    header: "Max Usage Total",
                    value: (pc) => pc.maxUsageTotal ?? "",
                  },
                  {
                    header: "Status",
                    value: (pc) => (pc.isActive ? "Active" : "Inactive"),
                  },
                ]}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      "Code",
                      "Description",
                      "Discount",
                      "Applies to",
                      "Valid",
                      "Usage",
                      "Status",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((pc) => (
                    <Fragment key={pc._id}>
                      <tr>
                        <td className="font-mono font-semibold text-slate-900">{pc.code}</td>
                        <td>{pc.description}</td>
                        <td className="whitespace-nowrap">
                          {pc.discountType === "PERCENTAGE"
                            ? `${pc.discountValue}%`
                            : `₹${pc.discountValue}`}
                          {pc.maxDiscountAmount ? ` (cap ₹${pc.maxDiscountAmount})` : ""}
                        </td>
                        <td>{pc.applicableTo}</td>
                        <td className="whitespace-nowrap">
                          {new Date(pc.validFrom).toLocaleDateString()} –{" "}
                          {new Date(pc.validUntil).toLocaleDateString()}
                        </td>
                        <td>
                          {pc.currentUsageCount}
                          {pc.maxUsageTotal ? ` / ${pc.maxUsageTotal}` : ""}
                        </td>
                        <td>
                          <StatusBadge
                            status={pc.isActive ? "Active" : "Inactive"}
                            tone={pc.isActive ? "green" : "slate"}
                            size="sm"
                          />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewStats(pc._id)}
                              disabled={loadingStats === pc._id}
                              className={btn("outline", "sm")}
                            >
                              {loadingStats === pc._id
                                ? "..."
                                : selectedStats?.id === pc._id
                                  ? "Hide stats"
                                  : "Stats"}
                            </button>
                            {pc.isActive && (
                              <button
                                onClick={() => setPendingDeactivate(pc)}
                                disabled={busyId === pc._id}
                                className={btn("dangerOutline", "sm")}
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {selectedStats?.id === pc._id && (
                        <tr key={`${pc._id}-stats`}>
                          <td colSpan={8} className="bg-slate-50 px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-6">
                              <div>
                                <span className="text-xs text-slate-500">Total Uses</span>
                                <p className="text-lg font-semibold text-slate-900">
                                  {selectedStats.stats.totalUsage}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Total Discount Given</span>
                                <p className="text-lg font-semibold text-slate-900">
                                  ₹{selectedStats.stats.totalDiscountGiven}
                                </p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Unique Users</span>
                                <p className="text-lg font-semibold text-slate-900">
                                  {selectedStats.stats.uniqueUsers}
                                </p>
                              </div>
                            </div>
                            {selectedStats.stats.recentUsages.length > 0 && (
                              <div className="mt-3">
                                <p className="mb-1 text-xs font-semibold text-slate-500">
                                  Recent Usages
                                </p>
                                <ul className="space-y-0.5 text-xs text-slate-600">
                                  {selectedStats.stats.recentUsages.map((u, i) => (
                                    <li key={i}>
                                      {u.userName}
                                      {u.userEmail && ` (${u.userEmail})`} — ₹{u.discountApplied} on{" "}
                                      {new Date(u.usedAt).toLocaleDateString()}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <ConfirmModal
        open={pendingDeactivate !== null}
        variant="danger"
        title={`Deactivate ${pendingDeactivate?.code ?? "this code"}?`}
        description="Players will no longer be able to apply it at checkout."
        confirmLabel="Deactivate"
        loading={busyId !== null}
        onConfirm={() => pendingDeactivate && handleDeactivate(pendingDeactivate._id)}
        onCancel={() => setPendingDeactivate(null)}
      />
    </div>
  );
}
