"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { User as UserType } from "@/types";
import { useEffect, useState } from "react";

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError.response?.data?.message || "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
};

export default function VenueListerProfilePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
  });

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch venue lister profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProfileClick = () => {
    if (!user) {
      return;
    }

    setProfileForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      dob: user.dob ? new Date(user.dob).toISOString().split("T")[0] : "",
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    setIsSavingProfile(true);

    try {
      const updateData: {
        name: string;
        email: string;
        phone: string;
        dob?: Date;
      } = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      };

      if (profileForm.dob) {
        updateData.dob = new Date(profileForm.dob);
      }

      const response = await authApi.updateProfile(updateData);
      if (response.success && response.data) {
        setUser(response.data);
        setIsEditingProfile(false);
        toast.success("Profile updated successfully");
      } else {
        throw new Error(response.message || "Failed to update profile");
      }
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center">Loading profile...</div>;
  }

  if (!user) {
    return <div className="py-12 text-center">Failed to load profile</div>;
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Venue Lister"
        title="My Profile"
        subtitle="Manage your account details and profile photo."
      />

      <Card className="bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Account Details
            </h2>
            <p className="text-sm text-slate-500">
              Your profile information and contact details.
            </p>
          </div>
          {!isEditingProfile && (
            <button
              onClick={handleEditProfileClick}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <div className="px-6 py-6">
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="flex flex-col items-center space-y-3 lg:items-start">
                <ProfilePictureUpload
                  currentPhotoUrl={user.photoUrl}
                  onUploadSuccess={(updatedUser) => {
                    setUser(updatedUser);
                  }}
                  size="lg"
                />
                <p className="text-center text-xs text-slate-500 lg:text-left">
                  JPG/PNG up to 5MB
                </p>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Enter your phone"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profileForm.dob}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        dob: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEditingProfile(false)}
                disabled={isSavingProfile}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <ProfilePictureUpload
                currentPhotoUrl={user.photoUrl}
                onUploadSuccess={(updatedUser) => {
                  setUser(updatedUser);
                }}
                size="md"
              />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {user.name}
                </h3>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <span className="text-slate-500">Phone:</span>
                <p className="font-medium text-slate-900">
                  {user.phone || "Not provided"}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Date of Birth:</span>
                <p className="font-medium text-slate-900">
                  {user.dob
                    ? new Date(user.dob).toLocaleDateString()
                    : "Not provided"}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
