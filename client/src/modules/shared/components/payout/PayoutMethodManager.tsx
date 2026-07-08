"use client";

import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { IPayoutMethod, PayoutMethodType } from "@/types";
import { cn } from "@/utils/cn";
import {
    AlertTriangle,
    BadgeCheck,
    Banknote,
    CreditCard,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    PencilLine,
    Smartphone,
    Trash2,
    Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayoutMethodManagerProps {
  /** Who owns this payout method UI */
  ownerType: "Coach" | "VENUE";
  /** Load the existing payout method from backend */
  onLoad: () => Promise<IPayoutMethod | null>;
  /** Save (upsert) the payout method */
  onSave: (
    payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
  ) => Promise<IPayoutMethod>;
  /** Delete the payout method */
  onDelete: () => Promise<void>;
}

type TabId = PayoutMethodType;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const maskAccountNumber = (num: string) =>
  num.length > 4 ? "•".repeat(num.length - 4) + num.slice(-4) : num;

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

function StatusBadge({ hasMethod }: { hasMethod: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        hasMethod
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {hasMethod ? (
        <>
          <BadgeCheck size={12} />
          Payout method saved
        </>
      ) : (
        <>
          <AlertTriangle size={12} />
          Not configured
        </>
      )}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PayoutMethodManager({
  ownerType,
  onLoad,
  onSave,
  onDelete,
}: PayoutMethodManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [current, setCurrent] = useState<IPayoutMethod | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("BANK_TRANSFER");

  // Bank form state
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");

  // UPI form state
  const [upiId, setUpiId] = useState("");

  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Load existing method
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    onLoad()
      .then((method) => {
        if (!mounted) return;
        setCurrent(method);
        if (method) {
          setActiveTab(method.type);
          prefillForm(method);
        }
      })
      .catch(() => {
        if (!mounted) return;
        toast.error("Failed to load payout method");
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
    if (current) {
      setActiveTab(current.type);
      prefillForm(current);
    } else {
      setActiveTab("BANK_TRANSFER");
      setAccountHolderName("");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setIfscCode("");
      setBankName("");
      setUpiId("");
    }
    setEditing(false);
    setConfirmDelete(false);
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

    const payload: Omit<IPayoutMethod, "addedAt" | "updatedAt"> =
      activeTab === "BANK_TRANSFER"
        ? {
            type: "BANK_TRANSFER",
            accountHolderName: accountHolderName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            bankName: bankName.trim(),
          }
        : { type: "UPI", upiId: upiId.trim() };

    setSaving(true);
    try {
      const saved = await onSave(payload);
      setCurrent(saved);
      setEditing(false);
      toast.success("Payout method saved successfully! 🎉");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save payout method",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmDeleteTimerRef.current = setTimeout(() => {
        setConfirmDelete(false);
      }, 4000);
      return;
    }
    if (confirmDeleteTimerRef.current) {
      clearTimeout(confirmDeleteTimerRef.current);
    }
    setDeleting(true);
    try {
      await onDelete();
      setCurrent(null);
      resetForm();
      toast.success("Payout method removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove payout method",
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-power-orange" size={28} />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-power-orange" />
              <h2 className="text-lg font-bold text-slate-900">
                Payout Method
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Where you&apos;d like to receive your earnings from bookings.
            </p>
          </div>
          <StatusBadge hasMethod={Boolean(current)} />
        </div>

        {/* ── Current method display ── */}
        {current && !editing ? (
          <div className="mt-6 space-y-1">
            {current.type === "BANK_TRANSFER" ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={16} className="text-power-orange" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Bank Transfer
                  </span>
                </div>
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <FieldRow
                    label="Account Holder"
                    value={current.accountHolderName!}
                  />
                  <FieldRow
                    label="Account Number"
                    value={current.accountNumber!}
                    masked
                  />
                  <FieldRow
                    label="Bank"
                    value={`${current.bankName} — ${current.ifscCode}`}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone size={16} className="text-power-orange" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    UPI
                  </span>
                </div>
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <FieldRow label="UPI ID" value={current.upiId!} />
                </div>
              </>
            )}

            {current.updatedAt && (
              <p className="pt-4 text-xs text-slate-500 border-t border-slate-200 mt-4">
                Last updated:{" "}
                {new Date(current.updatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                size="sm"
              >
                <PencilLine size={16} />
                Edit
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  confirmDelete
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "text-red-600 hover:bg-red-50",
                )}
              >
                {deleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {confirmDelete ? "Confirm Remove" : "Remove"}
              </button>
            </div>
          </div>
        ) : null}

        {/* ── No method CTA ── */}
        {!current && !editing && (
          <div className="mt-6 text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <Banknote size={26} className="text-amber-600" />
            </div>
            <p className="text-sm text-slate-600 mb-4">
              You haven&apos;t added a payout method yet. Add one to start
              receiving payments for your bookings.
            </p>
            <Button
              onClick={() => setEditing(true)}
              variant="primary"
              size="md"
            >
              <Wallet size={18} />
              Add Payout Method
            </Button>
          </div>
        )}
      </div>

      {/* ── Edit / Add form ── */}
      {editing && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              {current ? "Update Payout Method" : "Add Payout Method"}
            </h3>
            <button
              onClick={resetForm}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Tab selector */}
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
                {tab === "BANK_TRANSFER" ? (
                  <>
                    <CreditCard size={16} />
                    Bank Transfer
                  </>
                ) : (
                  <>
                    <Smartphone size={16} />
                    UPI
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Bank Transfer Form */}
          {activeTab === "BANK_TRANSFER" && (
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
              />
              <FormFieldGroup
                label="Confirm Account Number"
                value={confirmAccountNumber}
                onChange={setConfirmAccountNumber}
                placeholder="Re-enter account number"
                type="password"
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
          )}

          {/* UPI Form */}
          {activeTab === "UPI" && (
            <div className="space-y-4">
              <FormFieldGroup
                label="UPI ID"
                value={upiId}
                onChange={setUpiId}
                placeholder="yourname@okaxis"
                hint="Format: name@bankname (e.g., john@okaxis)"
              />
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-sm text-blue-900">
                <Lock size={16} className="mt-0.5 shrink-0 text-indigo-600" />
                <p>
                  We only store your UPI ID to process payouts. Your data is
                  encrypted and we will never initiate unauthorized debits.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              fullWidth
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <BadgeCheck size={18} />
                  Save Payout Method
                </>
              )}
            </Button>
            <Button onClick={resetForm} variant="outline" size="lg">
              Cancel
            </Button>
          </div>

          <p className="text-center text-xs text-slate-500">
            <Lock size={12} className="inline mr-1" />
            Your banking details are encrypted and stored securely
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Internal FormFieldGroup Component ────────────────────────────────────────

interface FormFieldGroupProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: "text" | "password";
  maxLength?: number;
  hint?: string;
}

function FormFieldGroup({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  hint,
}: FormFieldGroupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : "text";

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn("pr-10", isPassword && "font-mono tracking-widest")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Main Component
