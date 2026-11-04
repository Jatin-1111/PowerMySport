"use client";

import { toast } from "@/lib/toast";
import { useProfile, profileQueryKey } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import {
  EditLink,
  FIELD_INPUT,
  FIELD_LABEL,
  FormActions,
  ProfileFacts,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { User } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const messageOf = (error: unknown): string =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error instanceof Error ? error.message : "") ||
  "We could not save your details.";

const dateInputValue = (dob: User["dob"]): string =>
  dob ? new Date(dob).toISOString().split("T")[0] : "";

/**
 * The venue lister's own account: the name, contact details and photo that
 * players and our team see. Venue details live with each venue, not here.
 */
export function VenueProfile() {
  const queryClient = useQueryClient();
  const setStoreUser = useAuthStore((state) => state.setUser);
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", dob: "" });

  const user = profile.data;

  /** Write a fresh user to both the store (identity) and the query cache. */
  const adopt = (next: User) => {
    setStoreUser(next);
    queryClient.setQueryData(profileQueryKey, next);
  };

  if (profile.isPending) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        <span className="sr-only">Loading your profile</span>
        <div aria-hidden="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-56" />
        </div>
        <Skeleton aria-hidden="true" className="h-48 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load your profile
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Check your connection and try again. Your details are safe.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => profile.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const startEditing = () => {
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      dob: dateInputValue(user.dob),
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await authApi.updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        ...(form.dob ? { dob: new Date(form.dob) } : {}),
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || "We could not save your details.");
      }
      adopt(response.data);
      setEditing(false);
      toast.success("Details saved.");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <div className="space-y-10 sm:space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Venue console</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            Profile
          </h1>
        </div>
        <ProfilePictureUpload
          currentPhotoUrl={user.photoUrl}
          onUploadSuccess={adopt}
          size="md"
          variant="compact"
        />
      </header>

      <div>
        <ProfileSection
          id="account"
          title="Your details"
          description="The name and contact details on your venue account."
          action={!editing && <EditLink onClick={startEditing} label="Edit details" />}
        >
          {editing ? (
            <div className="max-w-xl space-y-5">
              <div>
                <label htmlFor="profile-name" className={FIELD_LABEL}>
                  Full name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  className={FIELD_INPUT}
                  {...field("name")}
                />
              </div>
              <div>
                <label htmlFor="profile-email" className={FIELD_LABEL}>
                  Email address
                </label>
                <input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  className={FIELD_INPUT}
                  {...field("email")}
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className={FIELD_LABEL}>
                  Phone number
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  className={FIELD_INPUT}
                  {...field("phone")}
                />
              </div>
              <div>
                <label htmlFor="profile-dob" className={FIELD_LABEL}>
                  Date of birth
                </label>
                <input
                  id="profile-dob"
                  type="date"
                  autoComplete="bday"
                  className={`${FIELD_INPUT} md:max-w-xs`}
                  {...field("dob")}
                />
              </div>
              <FormActions
                onSave={() => void save()}
                onCancel={() => setEditing(false)}
                saving={saving}
                saveLabel="Save details"
              />
            </div>
          ) : (
            <ProfileFacts
              rows={[
                { label: "Name", value: user.name },
                { label: "Email", value: user.email },
                { label: "Phone", value: user.phone || "Not added" },
                {
                  label: "Date of birth",
                  value: user.dob
                    ? new Date(user.dob).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Not added",
                },
              ]}
            />
          )}
        </ProfileSection>
      </div>
    </div>
  );
}
