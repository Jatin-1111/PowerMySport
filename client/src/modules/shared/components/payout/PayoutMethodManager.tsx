"use client";

import { toast } from "@/lib/toast";
import { IPayoutMethod, PayoutMethodType } from "@/types";
import { cn } from "@/utils/cn";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Building2,
  CreditCard,
  Hash,
  Loader2,
  Lock,
  PencilLine,
  Smartphone,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayoutMethodManagerProps {
  /** Who owns this payout method UI */
  ownerType: "COACH" | "VENUE";
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
  icon: Icon,
  label,
  value,
  masked,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  masked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 shrink-0">
        <Icon size={15} className="text-power-orange" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-slate-200 truncate">
          {masked ? maskAccountNumber(value) : value}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ hasMethod }: { hasMethod: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        hasMethod
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-amber-500/15 text-amber-400",
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
          No payout method
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

  const ownerLabel = ownerType === "COACH" ? "coach" : "venue";

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={18} className="text-power-orange" />
              <h2 className="text-lg font-bold text-white">Payout Method</h2>
            </div>
            <p className="text-sm text-slate-400">
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
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} className="text-power-orange" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Bank Transfer
                  </span>
                </div>
                <FieldRow
                  icon={User}
                  label="Account Holder"
                  value={current.accountHolderName!}
                />
                <FieldRow
                  icon={Hash}
                  label="Account Number"
                  value={current.accountNumber!}
                  masked
                />
                <FieldRow
                  icon={Building2}
                  label="Bank"
                  value={`${current.bankName} — ${current.ifscCode}`}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone size={15} className="text-power-orange" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    UPI
                  </span>
                </div>
                <FieldRow icon={Wallet} label="UPI ID" value={current.upiId!} />
              </>
            )}

            {current.updatedAt && (
              <p className="pt-2 text-xs text-slate-600">
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
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                <PencilLine size={14} />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  confirmDelete
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white/5 text-red-400 hover:bg-red-500/20",
                )}
              >
                {deleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {confirmDelete ? "Confirm Remove" : "Remove"}
              </button>
            </div>
          </div>
        ) : null}

        {/* ── No method CTA ── */}
        {!current && !editing && (
          <div className="mt-6 text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <Banknote size={26} className="text-amber-400" />
            </div>
            <p className="text-sm text-slate-400 mb-4">
              You haven&apos;t added a payout method yet. Add one to start
              receiving payments for your {ownerLabel} bookings.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-orange-600 transition-colors"
            >
              <Wallet size={16} />
              Add Payout Method
            </button>
          </div>
        )}
      </div>

      {/* ── Edit / Add form ── */}
      {editing && (
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {current ? "Update Payout Method" : "Add Payout Method"}
            </h3>
            <button
              onClick={resetForm}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          {/* Tab selector */}
          <div className="flex rounded-xl bg-slate-800 p-1 gap-1">
            {(["BANK_TRANSFER", "UPI"] as TabId[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all",
                  activeTab === tab
                    ? "bg-power-orange text-white shadow"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {tab === "BANK_TRANSFER" ? (
                  <>
                    <CreditCard size={15} />
                    Bank Transfer
                  </>
                ) : (
                  <>
                    <Smartphone size={15} />
                    UPI
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Bank Transfer Form */}
          {activeTab === "BANK_TRANSFER" && (
            <div className="space-y-4">
              <FormField
                label="Account Holder Name"
                icon={User}
                placeholder="As per your bank records"
                value={accountHolderName}
                onChange={setAccountHolderName}
              />
              <FormField
                label="Account Number"
                icon={Hash}
                placeholder="Enter account number"
                value={accountNumber}
                onChange={setAccountNumber}
                type="password"
              />
              <FormField
                label="Confirm Account Number"
                icon={Hash}
                placeholder="Re-enter account number"
                value={confirmAccountNumber}
                onChange={setConfirmAccountNumber}
              />
              <FormField
                label="IFSC Code"
                icon={Building2}
                placeholder="e.g. SBIN0001234"
                value={ifscCode}
                onChange={(v) => setIfscCode(v.toUpperCase())}
                maxLength={11}
              />
              <FormField
                label="Bank Name"
                icon={Building2}
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChange={setBankName}
              />
            </div>
          )}

          {/* UPI Form */}
          {activeTab === "UPI" && (
            <div className="space-y-4">
              <FormField
                label="UPI ID"
                icon={Smartphone}
                placeholder="yourname@okaxis"
                value={upiId}
                onChange={setUpiId}
              />
              <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
                <Lock size={13} className="mt-0.5 shrink-0" />
                <p>
                  We only store your UPI ID to process payouts. We will never
                  initiate unauthorised debits.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-power-orange py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <BadgeCheck size={16} />
                  Save Payout Method
                </>
              )}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-center text-xs text-slate-600">
            <Lock size={10} className="inline mr-1" />
            Your banking details are encrypted and stored securely
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Internal FormField ───────────────────────────────────────────────────────

function FormField({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  type = "text",
  maxLength,
}: {
  label: string;
  icon: React.ElementType;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
  maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : "text";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-white/10 bg-slate-800 px-4 py-3 focus-within:border-power-orange/60 focus-within:ring-1 focus-within:ring-power-orange/30 transition-all">
        <Icon size={15} className="mr-3 shrink-0 text-slate-500" />
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="ml-2 text-xs text-slate-500 hover:text-slate-300"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}
