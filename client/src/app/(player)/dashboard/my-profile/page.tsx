"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { User } from "@/types";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type Dependent = NonNullable<User["dependents"]>[number];

// Helper function to extract error message from axios errors
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

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [graduatingDependentId, setGraduatingDependentId] = useState<
    string | null
  >(null);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [showDependentModal, setShowDependentModal] = useState(false);
  const [dependentModalMode, setDependentModalMode] = useState<"add" | "edit">(
    "add",
  );
  const [selectedDependent, setSelectedDependent] = useState<Dependent | null>(
    null,
  );
  const [savingDependentId, setSavingDependentId] = useState<string | null>(
    null,
  );
  const [isDeletingDependentId, setDeletingDependentId] = useState<
    string | null
  >(null);
  const [graduationForm, setGraduationForm] = useState({
    dependentId: "",
    dependentName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [graduateMessage, setGraduateMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDependentAge = (dob?: string | Date) => {
    if (!dob) {
      return null;
    }
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }
    const ageInMs = Date.now() - birthDate.getTime();
    return Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365.25));
  };

  const handleStartGraduation = (dependent: Dependent) => {
    if (!dependent._id) {
      setError("Unable to graduate dependent without an id.");
      return;
    }

    const age = getDependentAge(dependent.dob);
    if (age === null) {
      setError("Dependent date of birth is missing or invalid.");
      return;
    }

    if (age < 18) {
      setError(
        `This dependent is ${age} years old and must be at least 18 to graduate.`,
      );
      return;
    }

    setError("");
    setGraduateMessage("");
    setGraduationForm({
      dependentId: dependent._id?.toString() || "",
      dependentName: dependent.name,
      email: "",
      password: "",
      phone: "",
    });
    setShowGraduationModal(true);
  };

  const handleSubmitGraduation = async () => {
    if (
      !graduationForm.dependentId ||
      !graduationForm.email ||
      !graduationForm.password ||
      !graduationForm.phone
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setGraduatingDependentId(graduationForm.dependentId);
    setError("");
    setGraduateMessage("");

    try {
      console.log("Graduating dependent with data:", {
        dependentId: graduationForm.dependentId,
        email: graduationForm.email,
        phone: graduationForm.phone,
      });

      const response = await authApi.graduateDependent({
        dependentId: graduationForm.dependentId,
        email: graduationForm.email,
        password: graduationForm.password,
        phone: graduationForm.phone,
      });
      if (response.success) {
        setGraduateMessage(
          "Dependent successfully graduated to independent account! They'll receive a welcome email.",
        );
        setShowGraduationModal(false);
        setGraduationForm({
          dependentId: "",
          dependentName: "",
          email: "",
          password: "",
          phone: "",
        });
        await fetchProfile();
      } else {
        setError(response.message || "Failed to graduate dependent");
      }
    } catch (error: unknown) {
      console.error("Graduation error:", error);
      const errorMessage =
        getErrorMessage(error) || "Failed to graduate dependent";
      setError(errorMessage);
    } finally {
      setGraduatingDependentId(null);
    }
  };

  const handleAddDependent = () => {
    setSelectedDependent(null);
    setDependentModalMode("add");
    setShowDependentModal(true);
  };

  const handleEditDependent = (dependent: Dependent) => {
    setSelectedDependent(dependent);
    setDependentModalMode("edit");
    setShowDependentModal(true);
  };

  const handleSaveDependent = async (dependentData: {
    name: string;
    dob: string | Date;
    gender?: "MALE" | "FEMALE" | "OTHER";
    relation?: string;
    sports?: string[];
  }) => {
    try {
      if (dependentModalMode === "add") {
        setSavingDependentId("new");
        await authApi.addDependent(dependentData);
      } else if (selectedDependent?._id) {
        setSavingDependentId(selectedDependent._id);
        await authApi.updateDependent(selectedDependent._id, dependentData);
      }
      await fetchProfile();
    } catch (error: unknown) {
      throw error;
    } finally {
      setSavingDependentId(null);
    }
  };

  const handleDeleteDependent = async (dependentId?: string) => {
    if (!dependentId) return;

    if (!confirm("Are you sure you want to delete this dependent?")) {
      return;
    }

    setDeletingDependentId(dependentId);
    setError("");

    try {
      await authApi.deleteDependent(dependentId);
      await fetchProfile();
    } catch (error: unknown) {
      setError(getErrorMessage(error) || "Failed to delete dependent");
    } finally {
      setDeletingDependentId(null);
    }
  };

  const handleEditProfileClick = () => {
    if (!user) return;
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
      setError("Name and email are required");
      return;
    }

    setIsSavingProfile(true);
    setError("");

    try {
      const updateData: {
        name: string;
        email: string;
        phone: string;
        dob?: Date;
      } = {
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
      };

      if (profileForm.dob) {
        updateData.dob = new Date(profileForm.dob);
      }

      await authApi.updateProfile(updateData);
      await fetchProfile();
      setIsEditingProfile(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error) || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-center py-12">Failed to load profile</div>;
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Player"
        title="My Profile"
        subtitle="Manage your account details and keep track of your dependents in one place."
      />

      {/* Success Message */}
      {graduateMessage && (
        <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
          {graduateMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card className="bg-white">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
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
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <div className="px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center lg:items-start space-y-3">
                <ProfilePictureUpload
                  currentPhotoUrl={user.photoUrl}
                  onUploadSuccess={(updatedUser) => {
                    setUser(updatedUser);
                  }}
                  size="xl"
                />
                <div className="text-center lg:text-left">
                  <p className="text-sm font-medium text-slate-700">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {user.role} Account
                  </p>
                </div>
              </div>

              {/* Profile Form */}
              <div className="flex-1">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          phone: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={profileForm.dob}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, dob: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Account Type
                    </label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-slate-900 capitalize">{user.role}</p>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSavingProfile ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center lg:items-start space-y-3">
                <ProfilePictureUpload
                  currentPhotoUrl={user.photoUrl}
                  onUploadSuccess={(updatedUser) => {
                    setUser(updatedUser);
                  }}
                  size="xl"
                />
                <div className="text-center lg:text-left">
                  <p className="text-sm font-medium text-slate-700">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {user.role} Account
                  </p>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Name
                    </label>
                    <p className="text-slate-900 text-lg font-medium">
                      {user.name}
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Email
                    </label>
                    <p className="text-slate-900 text-lg">{user.email}</p>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Phone
                    </label>
                    <p className="text-slate-900 text-lg">{user.phone}</p>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Age
                    </label>
                    <p className="text-slate-900 text-lg">
                      {user.dob
                        ? (getDependentAge(user.dob) ?? "Not provided")
                        : "Not provided"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 text-sm font-semibold mb-2">
                      Account Type
                    </label>
                    <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                      <span className="capitalize font-medium">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Dependents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">My Dependents</h2>
          <Button
            onClick={handleAddDependent}
            className="inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={16} />
            Add Dependent
          </Button>
        </div>

        {user.dependents && user.dependents.length > 0 ? (
          <div className="grid gap-4">
            {user.dependents.map((dependent) => (
              <Card key={dependent._id} className="bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {dependent.name}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {dependent.relation && (
                        <p>Relation: {dependent.relation}</p>
                      )}
                      {dependent.gender && <p>Gender: {dependent.gender}</p>}
                      {dependent.dob && (
                        <p>
                          Date of Birth:{" "}
                          {new Date(dependent.dob).toLocaleDateString()}
                        </p>
                      )}
                      {dependent.dob && (
                        <p>
                          Age: {getDependentAge(dependent.dob) ?? "Unknown"}
                        </p>
                      )}
                      {dependent.sports && dependent.sports.length > 0 && (
                        <p>Sports: {dependent.sports.join(", ")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      onClick={() => handleEditDependent(dependent)}
                      variant="secondary"
                      size="sm"
                      disabled={savingDependentId === dependent._id}
                      className="inline-flex items-center gap-1"
                    >
                      <Edit2 size={14} />
                      Edit
                    </Button>

                    <Button
                      onClick={() =>
                        handleDeleteDependent(dependent._id?.toString())
                      }
                      variant="secondary"
                      size="sm"
                      disabled={isDeletingDependentId === dependent._id}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      {isDeletingDependentId === dependent._id
                        ? "Deleting..."
                        : "Delete"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                  {(() => {
                    const age = getDependentAge(dependent.dob);
                    const isEligible = age !== null && age >= 18;
                    return (
                      <Button
                        onClick={() => handleStartGraduation(dependent)}
                        disabled={
                          !isEligible || graduatingDependentId === dependent._id
                        }
                        variant={isEligible ? "primary" : "secondary"}
                        className="whitespace-nowrap"
                        size="sm"
                      >
                        {graduatingDependentId === dependent._id
                          ? "Graduating..."
                          : isEligible
                            ? "Graduate to Independent"
                            : `Not eligible (${age} years old)`}
                      </Button>
                    );
                  })()}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-slate-50 border-dashed">
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">
                No dependents added yet. Add your first dependent to get
                started!
              </p>
              <Button
                onClick={handleAddDependent}
                className="inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Add Dependent
              </Button>
            </div>
          </Card>
        )}

        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mt-4 text-sm">
          <p className="font-semibold mb-2">What is a dependent?</p>
          <p className="mb-2">
            A dependent is a person (usually a child) whose bookings you manage.
            You can:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Book venues and coaches on their behalf</li>
            <li>Track their sports participation</li>
            <li>Manage their player profile</li>
            <li>Graduate them to an independent account once they turn 18</li>
          </ul>
        </div>
      </div>

      {/* Dependent Management Modal */}
      <DependentManagementModal
        isOpen={showDependentModal}
        onClose={() => setShowDependentModal(false)}
        onSubmit={handleSaveDependent}
        initialDependent={selectedDependent}
        isLoading={savingDependentId !== null}
        mode={dependentModalMode}
      />

      {showGraduationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-white">
            <div className="space-y-4 p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Graduate to Independent Account
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create a new account for {graduationForm.dependentName}. They
                  will use these credentials to book independently.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={graduationForm.email}
                    onChange={(event) =>
                      setGraduationForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                    placeholder="newaccount@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    value={graduationForm.password}
                    onChange={(event) =>
                      setGraduationForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                    placeholder="Create a password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={graduationForm.phone}
                    onChange={(event) =>
                      setGraduationForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowGraduationModal(false);
                    setGraduationForm({
                      dependentId: "",
                      dependentName: "",
                      email: "",
                      password: "",
                      phone: "",
                    });
                  }}
                  className="whitespace-nowrap"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitGraduation}
                  disabled={
                    graduatingDependentId === graduationForm.dependentId ||
                    !graduationForm.email ||
                    !graduationForm.password ||
                    !graduationForm.phone
                  }
                  className="whitespace-nowrap"
                >
                  {graduatingDependentId === graduationForm.dependentId
                    ? "Graduating..."
                    : "Graduate"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
