"use client";

import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import { Input } from "@/modules/shared/ui/Input";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileInfoField } from "@/modules/player/components/ProfileInfoField";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { User } from "@/types";
import { Calendar, Mail, Phone, UserRound } from "lucide-react";

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  dob: string;
}

export function AccountDetailsCard({
  user,
  setUser,
  isParent,
  userAge,
  isEditingProfile,
  isSavingProfile,
  profileForm,
  setProfileForm,
  onEdit,
  onCancel,
  onSave,
}: {
  user: User;
  setUser: (user: User) => void;
  isParent: boolean;
  userAge: number | null;
  isEditingProfile: boolean;
  isSavingProfile: boolean;
  profileForm: ProfileForm;
  setProfileForm: (form: ProfileForm) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const roleLabel = isParent ? "Parent" : user.role.toLowerCase().replace("_", " ");
  const setField = (field: keyof ProfileForm) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm({ ...profileForm, [field]: event.target.value });

  return (
    <section aria-labelledby="account-details" className="border-hairline border-t pt-10">
      <ProfileSectionHeader
        headingId="account-details"
        icon={UserRound}
        title="Account details"
        description="Your profile information and contact details."
        isEditing={isEditingProfile}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        saving={isSavingProfile}
      />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="flex flex-col items-center gap-3 lg:items-start">
          <ProfilePictureUpload
            currentPhotoUrl={user.photoUrl}
            onUploadSuccess={(updatedUser) => {
              setUser(updatedUser);
            }}
            size="xl"
          />
          <div className="text-center lg:text-left">
            <p className="text-ink font-medium">
              {isEditingProfile ? profileForm.name || user.name : user.name}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm capitalize">{roleLabel}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {isEditingProfile ? (
            <ProfileEditPanel description="Update your contact details. Name and email are required.">
              <div className="grid gap-5 sm:grid-cols-2">
                <ProfileEditField label="Name" htmlFor="profile-name" required icon={UserRound}>
                  <Input
                    id="profile-name"
                    value={profileForm.name}
                    onChange={setField("name")}
                    placeholder="Your full name"
                  />
                </ProfileEditField>

                <ProfileEditField
                  label="Email"
                  htmlFor="profile-email"
                  required
                  icon={Mail}
                  hint="Used for login and booking notifications."
                >
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileForm.email}
                    onChange={setField("email")}
                    placeholder="you@example.com"
                  />
                </ProfileEditField>

                <ProfileEditField
                  label="Phone"
                  htmlFor="profile-phone"
                  icon={Phone}
                  hint="For booking confirmations and reminders."
                >
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={setField("phone")}
                    placeholder="+91 98765 43210"
                  />
                </ProfileEditField>

                <ProfileEditField
                  label="Date of birth"
                  htmlFor="profile-dob"
                  icon={Calendar}
                  hint={
                    profileForm.dob
                      ? `Age: ${getDependentAge(profileForm.dob) ?? "not set"}`
                      : "Optional. Helps with age-appropriate bookings."
                  }
                >
                  <Input
                    id="profile-dob"
                    type="date"
                    value={profileForm.dob}
                    onChange={setField("dob")}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </ProfileEditField>

                <dl className="sm:col-span-2">
                  <ProfileInfoField label="Account type">
                    <span className="capitalize">{roleLabel}</span>
                  </ProfileInfoField>
                </dl>
              </div>
            </ProfileEditPanel>
          ) : (
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <ProfileInfoField label="Name">{user.name}</ProfileInfoField>
              <ProfileInfoField label="Email">{user.email}</ProfileInfoField>
              <ProfileInfoField label="Phone">{user.phone || "Not provided"}</ProfileInfoField>
              <ProfileInfoField label="Age">
                <span className="tabular-nums">{userAge ?? "Not provided"}</span>
              </ProfileInfoField>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
