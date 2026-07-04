"use client";

import { toast } from "@/lib/toast";
import { IPayoutMethod, PayoutMethodType } from "@/types";
import { cn } from "@/utils/cn";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  PencilLine,
  Shield,
  Smartphone,
  Star,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayoutMethodManagerProps {
  /** Who owns this payout method UI */
  ownerType: "Coach" | "VENUE" | "Expert";
  /** Load all payout methods from backend */
  onLoad: () => Promise<IPayoutMethod[]>;
  /** Add a new payout method */
  onAdd: (
    payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">,
  ) => Promise<IPayoutMethod>;
  /** Update existing payout method */
  onUpdate: (
    methodId: string,
    payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">,
  ) => Promise<IPayoutMethod>;
  /** Delete payout method */
  onDelete: (methodId: string) => Promise<void>;
  /** Set method as default */
  onSetDefault: (methodId: string) => Promise<void>;
}

type TabId = PayoutMethodType;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const maskAccountNumber = (num: string) =>
  num.length > 4 ? "•".repeat(num.length - 4) + num.slice(-4) : num;

const getPayoutMethodIcon = (type: PayoutMethodType, size = 16) => {
  return type === "BANK_TRANSFER" ? (
    <CreditCard size={size} />
  ) : (
    <Smartphone size={size} />
  );
};

const getPayoutMethodLabel = (type: PayoutMethodType) => {
  return type === "BANK_TRANSFER" ? "Bank Transfer" : "UPI";
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-xs text-slate-600 uppercase tracking-wider font-medium">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900 truncate text-right ml-3">
        {masked ? maskAccountNumber(value) : value}
      </p>
    </div>
  );
}

function MethodCard({
  method,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault,
  isLoading,
}: {
  method: IPayoutMethod;
  isDefault: boolean;
  onEdit: (method: IPayoutMethod) => void;
  onDelete: (methodId: string) => void;
  onSetDefault: (methodId: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
            {getPayoutMethodIcon(method.type, 18)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {getPayoutMethodLabel(method.type)}
            </p>
            <p className="text-xs text-slate-500">
              Added{" "}
              {method.addedAt &&
                new Date(method.addedAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                })}
            </p>
          </div>
        </div>
        {isDefault && (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">
            <Star size={12} className="fill-current" />
            Primary
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-2 border-t border-slate-100 pt-3 mb-4">
        {method.type === "BANK_TRANSFER" ? (
          <>
            <FieldRow label="Account" value={method.accountHolderName || ""} />
            <FieldRow
              label="Account #"
              value={method.accountNumber || ""}
              masked
            />
            <FieldRow label="IFSC" value={method.ifscCode || ""} />
          </>
        ) : (
          <FieldRow label="UPI ID" value={method.upiId || ""} />
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onEdit(method)}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <PencilLine size={14} />
          Edit
        </Button>
        {!isDefault && (
          <Button
            onClick={() => onSetDefault(method.id || "")}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <Star size={14} />
            Set as Primary
          </Button>
        )}
        <button
          onClick={() => onDelete(method.id || "")}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            "text-red-600 hover:bg-red-50 disabled:opacity-50",
          )}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>
    </div>
  );
}

function FormFieldGroup({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  maxLength,
  showPassword = false,
  onTogglePassword,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  maxLength?: number;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const isPasswordField = type === "password" && onTogglePassword;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Input
          type={isPasswordField && !showPassword ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "bg-white border-slate-300 focus:border-power-orange focus:ring-power-orange/20",
            isPasswordField && "pr-10",
          )}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PayoutMethodManager({
  ownerType,
  onLoad,
  onAdd,
  onUpdate,
  onDelete,
  onSetDefault,
}: PayoutMethodManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [methods, setMethods] = useState<IPayoutMethod[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMethod, setEditingMethod] = useState<IPayoutMethod | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabId>("BANK_TRANSFER");

  // Form state
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    account: false,
    confirm: false,
  });

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
        toast.error("Failed to load payout methods");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  function prefillForm(method: IPayoutMethod) {
    if (method.type === "BANK_TRANSFER") {
      setAccountHolderName(method.accountHolderName ?? "");
      setAccountNumber(method.accountNumber ?? "");
      setConfirmAccountNumber(method.accountNumber ?? "");
      setIfscCode(method.ifscCode ?? "");
      setBankName(method.bankName ?? "");
      setUpiId("");
    } else {
      setUpiId(method.upiId ?? "");
      setAccountHolderName("");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setIfscCode("");
      setBankName("");
    }
  }

  function resetForm() {
    setAccountHolderName("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setIfscCode("");
    setBankName("");
    setUpiId("");
    setActiveTab("BANK_TRANSFER");
    setEditingMethod(null);
    setIsAdding(false);
  }

  const handleSave = async () => {
    // Validation
    if (activeTab === "BANK_TRANSFER") {
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
    } else {
      if (!upiId.trim()) {
        toast.error("UPI ID is required");
        return;
      }
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        toast.error("Invalid UPI ID format (e.g. yourname@okaxis)");
        return;
      }
    }

    const payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt"> =
      activeTab === "BANK_TRANSFER"
        ? {
            type: "BANK_TRANSFER",
            accountHolderName: accountHolderName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            bankName: bankName.trim(),
            isDefault: editingMethod?.isDefault ?? methods.length === 0,
          }
        : {
            type: "UPI",
            upiId: upiId.trim(),
            isDefault: editingMethod?.isDefault ?? methods.length === 0,
          };

    setSaving(true);
    try {
      let saved: IPayoutMethod;

      if (editingMethod) {
        saved = await onUpdate(editingMethod.id!, payload);
        setMethods((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        toast.success("Payout method updated!");
      } else {
        saved = await onAdd(payload);
        setMethods((prev) => [...prev, saved]);
        toast.success("Payout method added!");
      }

      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save payout method",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!window.confirm("Remove this payout method?")) return;

    setProcessingId(methodId);
    try {
      await onDelete(methodId);
      setMethods((prev) => prev.filter((m) => m.id !== methodId));
      toast.success("Payout method removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove payout method",
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
      toast.success("Primary payout method updated");
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

  const defaultMethod = methods.find((m) => m.isDefault);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-power-orange" />
              <h2 className="text-lg font-bold text-slate-900">
                Payout Methods
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Add multiple payout methods to receive your earnings. Your primary
              method will be used for automatic payouts.
            </p>
          </div>
          {methods.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              <BadgeCheck size={12} />
              {methods.length} method{methods.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {methods.length === 0 ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <Banknote size={26} className="text-amber-600" />
            </div>
            <p className="text-sm text-slate-600 mb-4">
              You haven&apos;t added any payout methods yet.
            </p>
            <Button
              onClick={() => setIsAdding(true)}
              variant="primary"
              size="md"
            >
              <Wallet size={18} />
              Add Your First Method
            </Button>
          </div>
        ) : (
          <>
            {/* Methods Grid */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {methods.map((method, index) => (
                <MethodCard
                  key={method.id ?? `${method.type}-${index}`}
                  method={method}
                  isDefault={method.isDefault ?? false}
                  onEdit={(m) => {
                    setEditingMethod(m);
                    setActiveTab(m.type);
                    prefillForm(m);
                    setIsAdding(false);
                  }}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  isLoading={processingId === method.id}
                />
              ))}

              {/* Add More CTA */}
              <button
                onClick={() => setIsAdding(true)}
                className="rounded-lg border-2 border-dashed border-slate-300 p-4 hover:border-power-orange hover:bg-orange-50/30 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2 rounded-lg bg-slate-100">
                  <Wallet size={18} className="text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Add Method
                </p>
                <p className="text-xs text-slate-500">Bank or UPI</p>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Form */}
      {(isAdding || editingMethod) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              {editingMethod ? "Update Payout Method" : "Add New Payout Method"}
            </h3>
            <button
              onClick={resetForm}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Type Selector */}
          <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
            {(["BANK_TRANSFER", "UPI"] as TabId[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-all",
                  activeTab === tab
                    ? "bg-white text-power-orange shadow-sm border border-power-orange/20"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {getPayoutMethodIcon(tab, 16)}
                {getPayoutMethodLabel(tab)}
              </button>
            ))}
          </div>

          {/* Form Fields */}
          {activeTab === "BANK_TRANSFER" ? (
            <div className="space-y-4">
              <FormFieldGroup
                label="Account Holder Name"
                value={accountHolderName}
                onChange={setAccountHolderName}
                placeholder="As per your bank records"
              />
              <FormFieldGroup
                label="Account Number"
                value={accountNumber}
                onChange={setAccountNumber}
                placeholder="Enter account number"
                type="password"
                showPassword={showPasswords.account}
                onTogglePassword={() =>
                  setShowPasswords((p) => ({ ...p, account: !p.account }))
                }
              />
              <FormFieldGroup
                label="Confirm Account Number"
                value={confirmAccountNumber}
                onChange={setConfirmAccountNumber}
                placeholder="Re-enter account number"
                type="password"
                showPassword={showPasswords.confirm}
                onTogglePassword={() =>
                  setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
                }
              />
              <FormFieldGroup
                label="IFSC Code"
                value={ifscCode}
                onChange={(v) => setIfscCode(v.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                hint="Format: 4 letters + 0 + 6 alphanumeric characters"
              />
              <FormFieldGroup
                label="Bank Name"
                value={bankName}
                onChange={setBankName}
                placeholder="e.g. State Bank of India"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <FormFieldGroup
                label="UPI ID"
                value={upiId}
                onChange={setUpiId}
                placeholder="yourname@bankname"
                hint="Format: username@bankname (e.g. john@okaxis)"
              />
            </div>
          )}

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
                  {editingMethod ? "Update Method" : "Add Method"}
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
