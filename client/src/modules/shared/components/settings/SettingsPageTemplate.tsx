"use client";

import { toast } from "@/lib/toast";
import { useProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { UserRole } from "@/types";
import { cn } from "@/utils/cn";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EditLink,
  FIELD_INPUT,
  FIELD_LABEL,
  FormActions,
  ProfileFacts,
  ProfileSection,
} from "./ProfileSection";
import { WhatsAppConsentSetting } from "./WhatsAppConsentSetting";

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
      href: "/venue-lister/inventory",
      label: "Venues",
      description: "Add and edit your venues, prices and hours.",
    },
  ],
  Coach: [
    {
      href: "/coach/profile",
      label: "Coach profile",
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
      label: "Academy overview",
      description: "Manage your academy profile and settings.",
    },
  ],
  Admin: [
    {
      href: "/admin/users",
      label: "User management",
      description: "Manage user access, roles, and account status.",
    },
    {
      href: "/admin/bookings",
      label: "Bookings oversight",
      description: "Review booking activity and handle escalations.",
    },
  ],
  EXPERT: [
    {
      href: "/expert/profile",
      label: "Profile",
      description: "Update your public profile, fee and weekly availability.",
    },
    {
      href: "/expert/sessions",
      label: "Sessions",
      description: "Answer requests and manage the sessions booked with you.",
    },
  ],
  // Policy redirects this role to /onboarding before it can reach settings —
  // this entry exists only so the map stays exhaustive over UserRole.
  VENUE_ONBOARDING: [
    {
      href: "/onboarding",
      label: "Onboarding",
      description: "Complete venue onboarding and verification steps.",
    },
  ],
};

/** "VENUE_ONBOARDING" → "Venue onboarding": role names are read aloud, so they are sentence case. */
const roleLabel = (role: string) => {
  const words = role.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A password box with a 44px show/hide button. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  shown,
  onToggle,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggle?: () => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={cn(FIELD_INPUT, onToggle && "pr-12")}
        />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="text-ink-body hover:text-ink focus-visible:ring-ink absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
          >
            {shown ? (
              <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Eye size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {hint && <p className="text-ink-body mt-1.5 text-sm">{hint}</p>}
    </div>
  );
}

/**
 * The account settings page every role shares: who you are, how you sign in,
 * how we reach you, and the way out. Each is a ruled section, like the profile
 * pages, because the shell around it already supplies the page frame.
 */
export function SettingsPageTemplate({ basePath = "/settings" }: { basePath?: string }) {
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // login/googleLogin populate the store straight from their own response,
  // which doesn't include hasPassword (only /auth/profile does) — a Google
  // user landing here right after signing in would otherwise see this as
  // `undefined` and the password-change UI would incorrectly assume they
  // have one to change. `useProfile` below re-fetches the authoritative
  // profile and writes it to the store, so this is derived from the store, not
  // remembered: it is false until the profile arrives and true from then on. It
  // also gates the delete-account button, where getting it wrong matters.
  const hasPasswordKnown = user?.hasPassword !== undefined;

  // `useProfile` owns the fetch, the caching and writing the result back to the
  // auth store; it deduplicates against every other consumer of the profile.
  useProfile();

  const handleGoogleLink = async (credentialResponse: { credential?: string }) => {
    try {
      if (!credentialResponse.credential) {
        toast.error("No credential received from Google");
        return;
      }
      const response = await authApi.linkGoogleAccount(credentialResponse.credential);
      if (response.success && response.data) {
        toast.success("Google account linked");
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to link Google account");
    }
  };

  // Runs after the auth store has had a chance to hydrate from localStorage —
  // redirecting inline during render would fire before hydration completes
  // and bounce a logged-in user to /login on every load. Kept above the
  // early return below so every hook in this component always runs in the
  // same order, even right after account deletion when `user` flips to
  // null mid-session (logout() -> router.push("/")).
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
        toast.success("Password changed");
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

  const closeDeleteModal = () => {
    if (!deletingAccount) {
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) {
      toast.error(`Type ${DELETE_CONFIRM_WORD} to confirm`);
      return;
    }

    setDeletingAccount(true);
    try {
      const response = await authApi.deleteAccount("");
      if (response.success) {
        toast.success(response.message || "Account deactivated and scheduled for deletion");
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
    <div className="space-y-6">
      <header>
        <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          Settings
        </h1>
        <p className="text-ink-body mt-3 max-w-[56ch] text-pretty">
          Your account, how you sign in and how we reach you.
        </p>
      </header>

      <div>
        <ProfileSection id="account" title="Account" description="Who this account belongs to.">
          <ProfileFacts
            rows={[
              { label: "Name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Account type", value: roleLabel(user.role) },
            ]}
          />
        </ProfileSection>

        <ProfileSection
          id="password"
          title="Password"
          description="Used to sign in with your email."
          action={
            hasPasswordKnown && canSetPassword && !showPasswordForm ? (
              <EditLink onClick={() => setShowPasswordForm(true)} label="Change password" />
            ) : undefined
          }
        >
          {!hasPasswordKnown ? (
            <p className="text-ink-body">Checking your sign-in method.</p>
          ) : !canSetPassword ? (
            <p className="text-ink-body">
              You sign in with Google, so there is no password to manage.
            </p>
          ) : showPasswordForm ? (
            <form
              className="max-w-xl space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleChangePassword();
              }}
            >
              <PasswordField
                id="current-password"
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                shown={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
                autoComplete="current-password"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <PasswordField
                  id="new-password"
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  shown={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                  autoComplete="new-password"
                  hint="At least 6 characters."
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  shown={showNew}
                  autoComplete="new-password"
                />
              </div>
              <FormActions
                onSave={() => void handleChangePassword()}
                onCancel={resetPasswordForm}
                saving={changingPassword}
                saveLabel="Save password"
              />
            </form>
          ) : (
            <p className="text-ink-body">Change the password you use to sign in.</p>
          )}
        </ProfileSection>

        <ProfileSection
          id="google"
          title="Google"
          description="Sign in with your Google account instead of a password."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-body">
              {user.googleId ? "Your Google account is linked." : "No Google account is linked."}
            </p>
            {!user.googleId && (
              <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
                <div className="shrink-0">
                  <GoogleLogin
                    onSuccess={handleGoogleLink}
                    onError={() => toast.error("Google linking failed")}
                    useOneTap={false}
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    text="continue_with"
                  />
                </div>
              </GoogleOAuthProvider>
            )}
          </div>
        </ProfileSection>

        <WhatsAppConsentSetting />

        <ProfileSection
          id="notifications"
          title="Notifications"
          description="Which updates reach you by email, push and in the app."
        >
          <Link href={`${basePath}/notifications`} className={`${TEXT_LINK} ring-offset-paper`}>
            Notification preferences
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </ProfileSection>

        <ProfileSection
          id="shortcuts"
          title={`${roleLabel(user.role)} shortcuts`}
          description="Places in your account you may be looking for."
        >
          <ul className="border-hairline border-t">
            {roleSettingsLinks[user.role].map((item) => (
              <li key={item.href} className="border-hairline border-b">
                <Link
                  href={item.href}
                  className="hover:bg-paper-deep focus-visible:ring-ink group flex min-h-11 items-center justify-between gap-6 py-3.5 focus-visible:outline-none focus-visible:ring-2"
                >
                  <span className="min-w-0">
                    <span className="text-ink block font-medium">{item.label}</span>
                    <span className="text-ink-body block text-sm">{item.description}</span>
                  </span>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.5}
                    className="text-ink-body shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </ProfileSection>

        <ProfileSection
          id="delete-account"
          title="Delete account"
          description="This deactivates your account at once."
        >
          <p className="text-ink-body max-w-[60ch] text-pretty">
            Your account is deleted for good after 30 days. Sign back in before then to cancel.
          </p>
          <div className="mt-5">
            <Button
              variant="danger"
              className="min-h-11"
              onClick={() => setDeleteModalOpen(true)}
              disabled={!hasPasswordKnown}
            >
              Delete my account
            </Button>
          </div>
        </ProfileSection>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete your account?"
        size="sm"
      >
        <p className="text-ink-body text-pretty text-sm leading-relaxed">
          Your account is deactivated immediately and permanently deleted in 30 days. Your name,
          email and phone number are removed, along with personal content like calendar events and
          AI guidance history. Bookings and payment records are kept for legal and accounting
          purposes. Sign back in before the 30 days are up to cancel.
        </p>

        <div className="mt-5">
          <label htmlFor="delete-confirm" className={FIELD_LABEL}>
            Type {DELETE_CONFIRM_WORD} to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className={cn(FIELD_INPUT, "uppercase")}
            placeholder={DELETE_CONFIRM_WORD}
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={deletingAccount}
            className={`${TEXT_LINK} min-h-11 text-sm disabled:opacity-50`}
          >
            Cancel
          </button>
          <Button
            variant="danger"
            className="min-h-11"
            onClick={handleDeleteAccount}
            disabled={
              deletingAccount || deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD
            }
          >
            {deletingAccount ? "Deleting" : "Delete my account"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
