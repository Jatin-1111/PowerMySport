"use client";

import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import { Badge } from "@/modules/shared/ui/Badge";
import { Input } from "@/modules/shared/ui/Input";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileInfoField } from "@/modules/player/components/ProfileInfoField";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { User } from "@/types";
import { cn } from "@/utils/cn";
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
  return (
    <Card
      className={cn(
        "shop-surface premium-shadow overflow-hidden p-0 transition-shadow",
        isEditingProfile && "ring-power-orange/20 ring-2"
      )}
    >
      <ProfileSectionHeader
        icon={UserRound}
        title="Account Details"
        description="Your profile information and contact details."
        isEditing={isEditingProfile}
        onEdit={onEdit}
        onCancel={onCancel}
        onSave={onSave}
        saving={isSavingProfile}
      />

      <CardContent className="px-6 py-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-col items-center gap-3 lg:items-start">
            <ProfilePictureUpload
              currentPhotoUrl={user.photoUrl}
              onUploadSuccess={(updatedUser) => {
                setUser(updatedUser);
              }}
              size="xl"
            />
            <div className="text-center lg:text-left">
              <p className="text-sm font-semibold text-slate-900">
                {isEditingProfile ? profileForm.name || user.name : user.name}
              </p>
              <Badge className="mt-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                {user.role.replace("_", " ")}
              </Badge>
            </div>
          </div>

          <div className="flex-1">
            {isEditingProfile ? (
              <ProfileEditPanel description="Update your contact details. Name and email are required.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileEditField label="Name" htmlFor="profile-name" required icon={UserRound}>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          name: event.target.value,
                        })
                      }
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
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          email: event.target.value,
                        })
                      }
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
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          phone: event.target.value,
                        })
                      }
                      placeholder="+91 98765 43210"
                    />
                  </ProfileEditField>

                  <ProfileEditField
                    label="Date of Birth"
                    htmlFor="profile-dob"
                    icon={Calendar}
                    hint={
                      profileForm.dob
                        ? `Age: ${getDependentAge(profileForm.dob) ?? "—"} years`
                        : "Optional. Helps with age-appropriate bookings."
                    }
                  >
                    <Input
                      id="profile-dob"
                      type="date"
                      value={profileForm.dob}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          dob: event.target.value,
                        })
                      }
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </ProfileEditField>

                  <div className="sm:col-span-2">
                    <ProfileInfoField label="Account Type">
                      <span className="capitalize">
                        {isParent ? "Parent" : user.role.toLowerCase().replace("_", " ")}
                      </span>
                    </ProfileInfoField>
                  </div>
                </div>
              </ProfileEditPanel>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileInfoField label="Name">{user.name}</ProfileInfoField>
                <ProfileInfoField label="Email">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {user.email}
                  </span>
                </ProfileInfoField>
                <ProfileInfoField label="Phone">
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {user.phone || "Not provided"}
                  </span>
                </ProfileInfoField>
                <ProfileInfoField label="Age">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {userAge ?? "Not provided"}
                  </span>
                </ProfileInfoField>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
