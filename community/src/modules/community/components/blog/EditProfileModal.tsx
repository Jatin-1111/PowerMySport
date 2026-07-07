"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Loader2, X } from "lucide-react";
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

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  email,
  onSaved,
}: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [socials, setSocials] = useState<SocialLinks>(
    profile.socialLinks || {},
  );
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset fields when opening.
  useEffect(() => {
    if (isOpen) {
      setUsername(profile.username);
      setBio(profile.bio);
      setSocials(profile.socialLinks || {});
    }
  }, [isOpen, profile]);

  const save = async () => {
    if (!/^[a-z0-9_]{3,30}$/.test(username.trim().toLowerCase())) {
      toast.error(
        "Username must be 3–30 chars: letters, numbers, underscores.",
      );
      return;
    }
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
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
            className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-0 z-[401] flex items-center justify-center p-3 sm:p-6"
          >
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="font-title text-lg font-bold text-slate-900">
                  Edit Profile
                </h2>
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-5">
                {/* Avatar + non-editable identity */}
                <div className="flex items-center gap-4">
                  <AuthorAvatar
                    name={profile.name}
                    photoUrl={profile.photoUrl}
                    size={64}
                  />
                  <div className="grid flex-1 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Name
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {profile.name}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Email
                      </label>
                      <div className="truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {email || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div className="mt-5">
                  <label className="mb-1 block text-sm font-semibold text-slate-800">
                    Username
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-power-orange">
                    <AtSign size={16} className="text-slate-400" />
                    <input
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value.toLowerCase())
                      }
                      placeholder="username"
                      className="w-full bg-transparent text-sm text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="mt-4">
                  <label className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-800">
                    Bio
                    <span className="text-xs font-normal text-slate-400">
                      {bio.length}/{BIO_MAX}
                    </span>
                  </label>
                  <textarea
                    value={bio}
                    maxLength={BIO_MAX}
                    rows={3}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell readers a little about yourself..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-power-orange"
                  />
                </div>

                {/* Socials */}
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Add your social handles
                  </label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {SOCIAL_META.map(({ key, label, Icon, placeholder }) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-power-orange"
                      >
                        <Icon size={16} className="shrink-0 text-slate-400" />
                        <input
                          value={socials[key] || ""}
                          onChange={(event) =>
                            setSocials((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={`${label} ${placeholder}`}
                          className="w-full bg-transparent text-sm text-slate-800 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-power-orange px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-power-orange/20 transition hover:bg-[#d96610] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
