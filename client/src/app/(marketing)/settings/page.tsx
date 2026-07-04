"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { authApi } from "@/modules/auth/services/auth";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Modal } from "@/modules/shared/ui/Modal";
import { StaggerContainer, StaggerItem } from "@/modules/shared/ui/motion/StaggerContainer";
import { toast } from "@/lib/toast";
import { UserRole } from "@/types";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Settings,
  Shield,
  Trash2,
} from "lucide-react";

const DELETE_CONFIRM_WORD = "DELETE";

const roleSettingsLinks: Record<
  UserRole,
  Array<{ href: string; label: string; description: string }>
> = {
  Player: [
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      description: "Update personal details and manage dependents.",
    },
    {
      href: "/dashboard/my-bookings",
      label: "Bookings",
      description: "View and manage your bookings.",
    },
  ],
  Parent: [
    {
      href: "/dashboard/my-profile",
      label: "Profile",
      description: "Update personal details and manage dependents.",
    },
    {
      href: "/dashboard/my-bookings",
      label: "Bookings",
      description: "View and manage your bookings.",
    },
  ],
  VenueLister: [
    {
      href: "/venue-lister/profile",
      label: "Profile",
      description: "Update personal details and profile photo.",
    },
    {
      href: "/onboarding",
      label: "Onboarding",
      description: "Complete venue onboarding and verification steps.",
    },
    {
      href: "/venue-lister/inventory",
      label: "Inventory",
      description: "Manage venues, slots, and availability.",
    },
  ],
  Coach: [
    {
      href: "/coach/profile",
      label: "Coach Profile",
      description: "Update your coaching profile and service details.",
    },
    {
      href: "/coach/verification",
      label: "Verification",
      description: "Track and complete coach verification requirements.",
    },
  ],
  Academy: [
    {
      href: "/academy",
      label: "Academy Dashboard",
      description: "Manage your academy profile and settings.",
    },
  ],
  Admin: [
    {
      href: "/admin/users",
      label: "User Management",
      description: "Manage user access, roles, and account status.",
    },
    {
      href: "/admin/bookings",
      label: "Bookings Oversight",
      description: "Review booking activity and handle escalations.",
    },
  ],
  EXPERT: [
    {
      href: "/expert/dashboard",
      label: "Expert Sessions",
      description: "Manage client sessions booked with you.",
    },
  ],
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // login/googleLogin populate the store straight from their own response,
  // which doesn't include hasPassword (only /auth/profile does) — a Google
  // user landing here right after signing in would otherwise see this as
  // `undefined` and the password-change UI would incorrectly assume they
  // have one to change. Re-fetch the authoritative profile on mount so
  // hasPassword is never stale here, on a page where getting it wrong
  // matters (it also gates the delete-account confirmation below).
  const [hasPasswordKnown, setHasPasswordKnown] = useState(
    user?.hasPassword !== undefined,
  );

  useEffect(() => {
    if (!user) return;
    authApi
      .getProfile()
      .then((response) => {
        if (response.success && response.data) {
          setUser({ ...user, ...response.data });
        }
      })
      .catch(() => {})
      .finally(() => setHasPasswordKnown(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Runs after the auth store has had a chance to hydrate from localStorage —
  // redirecting inline during render would fire before hydration completes
  // and bounce a logged-in user to /login on every load.
  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [router, user]);

  if (!user) {
    return null;
  }

  const canSetPassword = user.hasPassword !== false;

  const resetPasswordForm = () => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      if (response.success) {
        toast.success("Password changed successfully");
        resetPasswordForm();
      } else {
        toast.error(response.message || "Failed to change password");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (canSetPassword && !deletePassword) {
      toast.error("Enter your password to confirm");
      return;
    }
    if (!canSetPassword && deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) {
      toast.error(`Type ${DELETE_CONFIRM_WORD} to confirm`);
      return;
    }

    setDeletingAccount(true);
    try {
      const response = await authApi.deleteAccount(deletePassword);
      if (response.success) {
        toast.success("Your account has been deleted");
        logout();
        router.push("/");
      } else {
        toast.error(response.message || "Failed to delete account");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <StaggerContainer staggerChildren={0.08} className="space-y-6">
        {/* Header */}
        <StaggerItem>
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-power-orange/30 bg-power-orange/10 px-3 py-1 text-sm font-semibold text-power-orange">
              <Settings size={14} />
              Account Settings
            </div>
            <h1 className="relative z-10 mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              Settings
            </h1>
            <p className="relative z-10 mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Manage your account, security, and preferences.
            </p>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/5 blur-3xl" />
          </div>
        </StaggerItem>

        {/* Account overview */}
        <StaggerItem>
          <Card className="border-slate-200/70 bg-white p-0 shadow-sm">
            <div className="flex items-center gap-4 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-power-orange to-orange-500 text-lg font-bold text-white shadow-md">
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-slate-900">
                  {user.name}
                </h2>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <Shield size={12} />
                  {user.role.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          </Card>
        </StaggerItem>

        {/* Security */}
        <StaggerItem>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Security
            </h2>
            <Card className="border-slate-200/70 bg-white p-0 shadow-sm">
              <div className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange/10">
                      <KeyRound className="text-power-orange" size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Password
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {!hasPasswordKnown
                          ? "Checking your sign-in method..."
                          : canSetPassword
                            ? "Change the password used to sign in."
                            : "You sign in with Google — no password to manage."}
                      </p>
                    </div>
                  </div>
                  {hasPasswordKnown && canSetPassword && !showPasswordForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPasswordForm(true)}
                    >
                      Change
                    </Button>
                  )}
                </div>

                {hasPasswordKnown && canSetPassword && showPasswordForm && (
                  <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Current password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-all focus:border-power-orange focus:ring-2 focus:ring-power-orange/20"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Toggle password visibility"
                        >
                          {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          New password
                        </label>
                        <div className="relative">
                          <input
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-all focus:border-power-orange focus:ring-2 focus:ring-power-orange/20"
                            placeholder="At least 6 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label="Toggle password visibility"
                          >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Confirm new password
                        </label>
                        <input
                          type={showNew ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-power-orange focus:ring-2 focus:ring-power-orange/20"
                          placeholder="Re-enter new password"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetPasswordForm}
                        disabled={changingPassword}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleChangePassword}
                        loading={changingPassword}
                      >
                        Save Password
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </StaggerItem>

        {/* Notifications */}
        <StaggerItem>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              General
            </h2>
            <Link href="/settings/notifications">
              <Card
                variant="interactive"
                className="group border-slate-200/70 bg-white p-0 shadow-sm"
              >
                <div className="flex items-center gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange/10">
                    <Bell className="text-power-orange" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900">
                      Notification Preferences
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Control how you receive notifications via email, push, and in-app.
                    </p>
                  </div>
                  <ChevronRight className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" size={18} />
                </div>
              </Card>
            </Link>
          </div>
        </StaggerItem>

        {/* Role-specific links */}
        <StaggerItem>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {user.role.replace(/_/g, " ")} Settings
            </h2>
            <div className="grid gap-3">
              {roleSettingsLinks[user.role].map((item) => (
                <Link key={item.href} href={item.href}>
                  <Card
                    variant="interactive"
                    className="group border-slate-200/70 bg-white p-0 shadow-sm"
                  >
                    <div className="flex items-center gap-4 p-5">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-slate-900">
                          {item.label}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" size={18} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </StaggerItem>

        {/* Danger zone */}
        <StaggerItem>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-600">
              Danger Zone
            </h2>
            <Card className="border-rose-200 bg-rose-50/40 p-0 shadow-sm">
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                    <Trash2 className="text-rose-600" size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Delete Account
                    </h3>
                    <p className="mt-1 max-w-md text-sm text-slate-600">
                      Permanently deactivate your account and remove your personal
                      information. This cannot be undone.
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteModalOpen(true)}
                  icon={<Trash2 size={15} />}
                  disabled={!hasPasswordKnown}
                >
                  Delete Account
                </Button>
              </div>
            </Card>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Delete account confirmation */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!deletingAccount) {
            setDeleteModalOpen(false);
            setDeletePassword("");
            setDeleteConfirmText("");
          }
        }}
        title="Delete your account?"
        size="sm"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <AlertTriangle size={26} />
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            This will deactivate your account and permanently remove your name,
            email, and phone number from PowerMySport. Bookings and payment
            records are kept for legal and accounting purposes.{" "}
            <span className="font-semibold text-rose-600">
              This action cannot be undone.
            </span>
          </p>
        </div>

        {canSetPassword ? (
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Enter your password to confirm
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              placeholder="••••••••"
              autoFocus
            />
          </div>
        ) : (
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              You signed in with Google, so there's no password to check —
              type <span className="font-bold">{DELETE_CONFIRM_WORD}</span> to
              confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase text-slate-900 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              placeholder={DELETE_CONFIRM_WORD}
              autoFocus
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setDeleteModalOpen(false);
              setDeleteConfirmText("");
              setDeletePassword("");
            }}
            disabled={deletingAccount}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteAccount}
            disabled={
              deletingAccount ||
              (canSetPassword
                ? !deletePassword
                : deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD)
            }
          >
            {deletingAccount ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Deleting...
              </>
            ) : (
              "Delete My Account"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
