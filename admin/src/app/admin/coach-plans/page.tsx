"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { CoachPlan } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (value?: number) => {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function AdminCoachPlansPage() {
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    monthly: "",
    yearly: "",
    features: "",
    supportsOverrides: true,
    isActive: true,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    monthly: "",
    yearly: "",
    features: "",
    supportsOverrides: true,
    isActive: true,
  });

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.listCoachPlans();
      if (!response.success || !response.data?.plans) {
        throw new Error(response.message || "Failed to load coach plans");
      }

      setPlans(response.data.plans);
    } catch (e) {
      console.error(e);
      setError("Failed to load coach plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const totalActive = useMemo(
    () => plans.filter((plan) => plan.isActive).length,
    [plans],
  );

  const resetForm = () => {
    setForm({
      code: "",
      name: "",
      description: "",
      monthly: "",
      yearly: "",
      features: "",
      supportsOverrides: true,
      isActive: true,
    });
  };

  const handleCreatePlan = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required.");
      return;
    }

    const monthly = form.monthly ? Number(form.monthly) : undefined;
    const yearly = form.yearly ? Number(form.yearly) : undefined;

    if (monthly === undefined && yearly === undefined) {
      toast.error("Add monthly or yearly price.");
      return;
    }

    if (
      (monthly !== undefined && Number.isNaN(monthly)) ||
      (yearly !== undefined && Number.isNaN(yearly))
    ) {
      toast.error("Pricing values must be valid numbers.");
      return;
    }

    setSaving(true);
    try {
      const response = await adminApi.createCoachPlan({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        pricing: {
          ...(monthly !== undefined ? { monthly } : {}),
          ...(yearly !== undefined ? { yearly } : {}),
        },
        features: form.features
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        supportsOverrides: form.supportsOverrides,
        isActive: form.isActive,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to create coach plan");
      }

      toast.success("Coach plan created.");
      resetForm();
      await loadPlans();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Failed to create coach plan",
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePlanStatus = async (plan: CoachPlan) => {
    const planId = plan.id || plan._id;
    if (!planId) {
      toast.error("Plan id is missing.");
      return;
    }

    setSaving(true);
    try {
      const response = await adminApi.updateCoachPlan(planId, {
        isActive: !plan.isActive,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to update plan");
      }

      toast.success(`Plan ${plan.isActive ? "deactivated" : "activated"}.`);
      await loadPlans();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (plan: CoachPlan) => {
    const planId = plan.id || plan._id;
    if (!planId) {
      toast.error("Plan id is missing.");
      return;
    }

    setEditingPlanId(planId);
    setEditForm({
      name: plan.name || "",
      description: plan.description || "",
      monthly:
        typeof plan.pricing?.monthly === "number"
          ? String(plan.pricing.monthly)
          : "",
      yearly:
        typeof plan.pricing?.yearly === "number"
          ? String(plan.pricing.yearly)
          : "",
      features: (plan.features || []).join("\n"),
      supportsOverrides: Boolean(plan.supportsOverrides),
      isActive: Boolean(plan.isActive),
    });
  };

  const closeEdit = () => {
    setEditingPlanId(null);
    setEditForm({
      name: "",
      description: "",
      monthly: "",
      yearly: "",
      features: "",
      supportsOverrides: true,
      isActive: true,
    });
  };

  const savePlanEdits = async () => {
    if (!editingPlanId) return;
    if (!editForm.name.trim()) {
      toast.error("Plan name is required.");
      return;
    }

    const monthly = editForm.monthly ? Number(editForm.monthly) : undefined;
    const yearly = editForm.yearly ? Number(editForm.yearly) : undefined;

    if (
      (monthly !== undefined && Number.isNaN(monthly)) ||
      (yearly !== undefined && Number.isNaN(yearly))
    ) {
      toast.error("Pricing values must be valid numbers.");
      return;
    }

    if (monthly === undefined && yearly === undefined) {
      toast.error("Add monthly or yearly price.");
      return;
    }

    setSaving(true);
    try {
      const response = await adminApi.updateCoachPlan(editingPlanId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        pricing: {
          ...(monthly !== undefined ? { monthly } : {}),
          ...(yearly !== undefined ? { yearly } : {}),
        },
        features: editForm.features
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        supportsOverrides: editForm.supportsOverrides,
        isActive: editForm.isActive,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to update plan");
      }

      toast.success("Plan updated successfully.");
      closeEdit();
      await loadPlans();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Coach Billing"
        title="Coach Plans"
        subtitle="Create and maintain subscription plans coaches can select from."
      />

      <Card className="bg-white">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-slate-500">Total plans</p>
            <p className="text-2xl font-bold text-slate-900">{plans.length}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Active plans</p>
            <p className="text-2xl font-bold text-emerald-600">{totalActive}</p>
          </div>
        </div>
      </Card>

      <Card className="bg-white">
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Create New Plan
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={form.code}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, code: event.target.value }))
              }
              placeholder="Code (e.g. PRO)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Plan name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              value={form.monthly}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, monthly: event.target.value }))
              }
              placeholder="Monthly price (INR)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              value={form.yearly}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, yearly: event.target.value }))
              }
              placeholder="Yearly price (INR)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Description"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={form.features}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, features: event.target.value }))
            }
            placeholder="Features (one per line)"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.supportsOverrides}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    supportsOverrides: event.target.checked,
                  }))
                }
              />
              Supports override requests
            </label>
          </div>
          <button
            onClick={handleCreatePlan}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Plan"}
          </button>
        </div>
      </Card>

      {editingPlanId ? (
        <Card className="bg-white">
          <div className="space-y-4 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Edit Plan</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Plan name"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                value={editForm.monthly}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    monthly: event.target.value,
                  }))
                }
                placeholder="Monthly price (INR)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                value={editForm.yearly}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    yearly: event.target.value,
                  }))
                }
                placeholder="Yearly price (INR)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={editForm.description}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={editForm.features}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  features: event.target.value,
                }))
              }
              placeholder="Features (one per line)"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.supportsOverrides}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      supportsOverrides: event.target.checked,
                    }))
                  }
                />
                Supports override requests
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={savePlanEdits}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Plan
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Pricing
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Features
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading plans...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No plans found.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id || plan._id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {plan.name}
                      </p>
                      <p className="text-xs text-slate-500">{plan.code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>Monthly: {formatInr(plan.pricing?.monthly)}</p>
                      <p>Yearly: {formatInr(plan.pricing?.yearly)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <ul className="space-y-1">
                        {(plan.features || []).slice(0, 3).map((feature) => (
                          <li key={feature}>• {feature}</li>
                        ))}
                        {(plan.features || []).length > 3 && (
                          <li>+{plan.features.length - 3} more</li>
                        )}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          plan.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(plan)}
                          disabled={saving}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => togglePlanStatus(plan)}
                          disabled={saving}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {plan.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
