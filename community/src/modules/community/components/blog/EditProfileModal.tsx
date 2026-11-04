"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile, SocialLinks } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { SOCIAL_META } from "@/modules/community/utils/socialLinks";
import AuthorAvatar from "./AuthorAvatar";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BlogAuthorProfile;
  email: string;
  onSaved: (profile: BlogAuthorProfile) => void;
}

const BIO_MAX = 300;
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

const fieldCls =
  "text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink h-12 w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none";
const labelCls = "text-ink mb-2 block text-base font-semibold";

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  email,
  onSaved,
}: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [socials, setSocials] = useState<SocialLinks>(profile.socialLinks || {});
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset fields when opening.
  useEffect(() => {
    if (isOpen) {
      setUsername(profile.username);
      setBio(profile.bio);
      setSocials(profile.socialLinks || {});
      setTouched(false);
    }
  }, [isOpen, profile]);

  // Escape closes, like the other dialogs.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const usernameInvalid = touched && !USERNAME_RE.test(username.trim().toLowerCase());

  const save = async () => {
    setTouched(true);
    if (!USERNAME_RE.test(username.trim().toLowerCase())) return;
    setSaving(true);
    try {
      const updated = await blogService.updateProfile({
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        socialLinks: socials,
      });
      toast.success("Profile updated");
      onSaved(updated);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not update your profile");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-ink/50 fixed inset-0 z-[400]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[401] flex items-end justify-center sm:items-center sm:p-6"
            onClick={onClose}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="bg-paper flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-7 sm:px-8 sm:pt-8">
                <h2
                  id="edit-profile-title"
                  className="font-editorial text-ink text-4xl font-light leading-[1.08]"
                >
                  Edit profile
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-ink-body hover:bg-paper-deep hover:text-ink -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200"
                >
                  <X size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-6 sm:px-8">
                <div className="flex items-center gap-4">
                  <AuthorAvatar name={profile.name} photoUrl={profile.photoUrl} size={64} />
                  <div className="min-w-0">
                    <p className="text-ink text-lg font-semibold">{profile.name}</p>
                    <p className="text-ink-body truncate text-base">
                      {email || "No email on file"}
                    </p>
                    <p className="text-ink-muted text-sm">Name and email come from your account.</p>
                  </div>
                </div>

                <div className="mt-7">
                  <label htmlFor="edit-username" className={labelCls}>
                    Username
                  </label>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="text-ink-muted pointer-events-none absolute inset-y-0 left-4 flex items-center text-base"
                    >
                      @
                    </span>
                    <input
                      id="edit-username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value.toLowerCase())}
                      aria-invalid={usernameInvalid}
                      aria-describedby="edit-username-hint"
                      placeholder="username"
                      className={`${fieldCls} pl-9 ${usernameInvalid ? "border-red-700" : ""}`}
                    />
                  </div>
                  <p
                    id="edit-username-hint"
                    className={`mt-2 text-sm ${usernameInvalid ? "font-medium text-red-700" : "text-ink-muted"}`}
                  >
                    {usernameInvalid
                      ? "Use 3 to 30 letters, numbers or underscores."
                      : "3 to 30 letters, numbers or underscores."}
                  </p>
                </div>

                <div className="mt-6">
                  <label htmlFor="edit-bio" className={labelCls}>
                    Bio
                  </label>
                  <textarea
                    id="edit-bio"
                    value={bio}
                    maxLength={BIO_MAX}
                    rows={3}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell readers a little about yourself"
                    className="text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink w-full resize-none rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-base leading-relaxed transition-colors duration-200 focus:outline-none"
                  />
                  <p className="text-ink-muted mt-2 text-sm tabular-nums">
                    {bio.length} of {BIO_MAX} characters
                  </p>
                </div>

                <fieldset className="border-hairline mt-7 border-t pt-6">
                  <legend className="text-ink-muted bg-paper px-2 text-sm font-medium">
                    Social links, all optional
                  </legend>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    {SOCIAL_META.map(({ key, label, Icon, placeholder }) => (
                      <div key={key}>
                        <label
                          htmlFor={`edit-social-${key}`}
                          className="text-ink mb-1.5 flex items-center gap-2 text-sm font-semibold"
                        >
                          <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
                          {label}
                        </label>
                        <input
                          id={`edit-social-${key}`}
                          value={socials[key] || ""}
                          onChange={(event) =>
                            setSocials((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={placeholder}
                          className={fieldCls}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="border-hairline flex flex-col-reverse items-stretch gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:gap-6 sm:px-8">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="btn-motion bg-power-orange-solid inline-flex min-h-12 min-w-[10rem] items-center justify-center rounded-md px-7 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Saving" : "Save changes"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
