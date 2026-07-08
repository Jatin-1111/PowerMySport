"use client";

import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import {
    BadgeCheck,
    Eye,
    EyeOff,
    Landmark,
    Loader2,
    PencilLine,
    Shield,
    Trash2,
    Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

type RefundMethodType = "ORIGINAL_CARD" | "BANK_ACCOUNT" | "STORE_CREDIT";

interface IRefundMethod {
  id?: string;
  type: RefundMethodType;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  isDefault?: boolean;
  addedAt?: Date;
  updatedAt?: Date;
}

interface RefundMethodManagerProps {
  onLoad: () => Promise<IRefundMethod[]>;
  onAdd: (
    payload: Omit<IRefundMethod, "id" | "addedAt" | "updatedAt">,
  ) => Promise<IRefundMethod>;
  onUpdate: (
    methodId: string,
    payload: Omit<IRefundMethod, "id" | "addedAt" | "updatedAt">,
  ) => Promise<IRefundMethod>;
  onDelete: (methodId: string) => Promise<void>;
  onSetDefault: (methodId: string) => Promise<void>;
}

export function RefundMethodManager({
  onLoad,
  onAdd,
  onUpdate,
  onDelete,
  onSetDefault,
}: RefundMethodManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [methods, setMethods] = useState<IRefundMethod[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMethod, setEditingMethod] = useState<IRefundMethod | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<RefundMethodType>("BANK_ACCOUNT");
  const [showPasswords, setShowPasswords] = useState(false);

  // Form state
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");

  // Load methods
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    onLoad()
      .then((loadedMethods) => {
        if (!mounted) return;
        setMethods(loadedMethods);
      })
      .catch(() => {
        if (!mounted) return;
        toast.error("Failed to load refund methods");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  function prefillForm(method: IRefundMethod) {
    setAccountHolderName(method.accountHolderName ?? "");
    setAccountNumber(method.accountNumber ?? "");
    setConfirmAccountNumber(method.accountNumber ?? "");
    setIfscCode(method.ifscCode ?? "");
    setBankName(method.bankName ?? "");
  }

  function resetForm() {
    setAccountHolderName("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setIfscCode("");
    setBankName("");
    setActiveTab("BANK_ACCOUNT");
    setEditingMethod(null);
    setIsAdding(false);
  }

  const handleSave = async () => {
    // Validation
    if (!accountHolderName.trim()) {
      toast.error("Account holder name is required");
      return;
    }
    if (!accountNumber.trim()) {
      toast.error("Account number is required");
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      toast.error("Account numbers don't match");
      return;
    }
    if (!ifscCode.trim()) {
      toast.error("IFSC code is required");
      return;
    }
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode.trim())) {
      toast.error("Invalid IFSC code format (e.g. SBIN0001234)");
      return;
    }
    if (!bankName.trim()) {
      toast.error("Bank name is required");
      return;
    }

    const payload: Omit<IRefundMethod, "id" | "addedAt" | "updatedAt"> = {
      type: "BANK_ACCOUNT",
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      bankName: bankName.trim(),
      isDefault: editingMethod?.isDefault ?? methods.length === 0,
    };

    setSaving(true);
    try {
      let saved: IRefundMethod;

      if (editingMethod) {
        saved = await onUpdate(editingMethod.id!, payload);
        setMethods((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        toast.success("Refund method updated!");
      } else {
        saved = await onAdd(payload);
        setMethods((prev) => [...prev, saved]);
        toast.success("Refund method added!");
      }

      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save refund method",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!window.confirm("Remove this refund method?")) return;

    setProcessingId(methodId);
    try {
      await onDelete(methodId);
      setMethods((prev) => prev.filter((m) => m.id !== methodId));
      toast.success("Refund method removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove refund method",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setProcessingId(methodId);
    try {
      await onSetDefault(methodId);
      setMethods((prev) =>
        prev.map((m) => ({ ...m, isDefault: m.id === methodId })),
      );
      toast.success("Default refund method updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set default method",
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-power-orange" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-power-orange" />
              <h2 className="text-lg font-bold text-slate-900">
                Refund Methods
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Add refund methods for maximum flexibility. By default, refunds
              are sent to your original payment card. You can optionally add a
              bank account for other refund options.
            </p>
          </div>
          {methods.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              <BadgeCheck size={12} />
              {methods.length} method{methods.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Shield
              size={18}
              className="text-indigo-600 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                No setup required for basic refunds
              </p>
              <p className="text-xs text-indigo-700 mt-1">
                If we refund you, money returns to your original payment card
                automatically (3-5 business days). Only add a bank account below
                if you prefer that method instead.
              </p>
            </div>
          </div>
        </div>

        {/* Methods List */}
        {methods.length > 0 ? (
          <div className="space-y-3">
            {methods.map((method) => (
              <div
                key={method.id}
                className="rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Landmark size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Bank Account
                      </p>
                      <p className="text-xs text-slate-500">
                        {method.bankName} — {method.ifscCode}
                      </p>
                    </div>
                  </div>
                  {method.isDefault && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">
                      <Shield size={12} />
                      Default
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1 border-t border-slate-100 pt-3 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account Holder:</span>
                    <span className="font-medium text-slate-900">
                      {method.accountHolderName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account Number:</span>
                    <span className="font-medium text-slate-900">
                      {method.accountNumber
                        ?.slice(-4)
                        .padStart(method.accountNumber.length, "•")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setEditingMethod(method);
                      prefillForm(method);
                      setIsAdding(false);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={processingId !== null}
                  >
                    <PencilLine size={14} />
                    Edit
                  </Button>
                  {!method.isDefault && (
                    <Button
                      onClick={() => handleSetDefault(method.id!)}
                      variant="outline"
                      size="sm"
                      disabled={processingId === method.id}
                    >
                      <Shield size={14} />
                      Set as Default
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(method.id!)}
                    disabled={processingId === method.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      "text-red-600 hover:bg-red-50 disabled:opacity-50",
                    )}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add More CTA */}
            {methods.length > 0 && (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 p-4 hover:border-power-orange hover:bg-orange-50/30 transition-colors flex flex-col items-center justify-center gap-2 text-center"
              >
                <Wallet size={18} className="text-slate-600" />
                <p className="text-sm font-semibold text-slate-700">
                  Add Another Method
                </p>
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
              <Landmark size={26} className="text-indigo-600" />
            </div>
            <p className="text-sm text-slate-600 mb-4">
              No bank account added yet. Only add if you want an alternative to
              automatic card refunds.
            </p>
            <Button
              onClick={() => setIsAdding(true)}
              variant="primary"
              size="md"
            >
              <Wallet size={18} />
              Add Bank Account
            </Button>
          </div>
        )}
      </div>

      {/* Form */}
      {(isAdding || editingMethod) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              {editingMethod ? "Update Bank Account" : "Add Bank Account"}
            </h3>
            <button
              onClick={resetForm}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Account Holder Name
              </label>
              <Input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="As per your bank records"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Account Number
              </label>
              <div className="relative">
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Confirm Account Number
              </label>
              <Input
                type={showPasswords ? "text" : "password"}
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter account number"
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                IFSC Code
              </label>
              <Input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                className="bg-white"
              />
              <p className="text-xs text-slate-500">
                Format: 4 letters + 0 + 6 alphanumeric characters
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Bank Name
              </label>
              <Input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
                className="bg-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  {editingMethod ? "Update" : "Add"} Bank Account
                </>
              )}
            </Button>
            <Button onClick={resetForm} variant="outline" disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
