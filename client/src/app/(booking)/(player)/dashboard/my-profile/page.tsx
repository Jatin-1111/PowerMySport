"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { INDIAN_STATES } from "@/modules/guidance/constants";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import { ProfileInfoField } from "@/modules/player/components/ProfileInfoField";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { formatDependentRelation } from "@/modules/player/constants/dependentRelations";
import { calculateProfileCompletion } from "@/modules/player/utils/profileCompletion";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardFooter } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { User } from "@/types";
import { cn } from "@/utils/cn";
import {
    Calendar,
    Edit2,
    GraduationCap,
    Info,
    Mail,
    Phone,
    Plus,
    Trash2,
    Trophy,
    UserRound,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type Dependent = NonNullable<User["dependents"]>[number];

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

const getDependentAge = (dob?: string | Date) => {
  if (!dob) return null;

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const formatGender = (gender?: string) => {
  if (gender === "MALE") return "Male";
  if (gender === "FEMALE") return "Female";
  if (gender === "OTHER") return "Other";
  return null;
};

const AMBITION_LABELS: Record<string, string> = {
  fun: "Plays for fun",
  competitive: "Competitive",
  national: "National goal",
  professional: "Professional path",
};
const ENERGY_LABELS: Record<string, string> = {
  explosive: "Explosive energy",
  endurance: "Endurance type",
};
const FOCUS_LABELS: Record<string, string> = {
  bursts: "Focuses in bursts",
  sustained: "Sustained focus",
};
const DECISION_LABELS: Record<string, string> = {
  react: "Instinctive",
  strategic: "Strategic thinker",
};
const BUILD_LABELS: Record<string, string> = {
  lean: "Lean build",
  average: "Average build",
  stocky: "Strong build",
};
const HEIGHT_LABELS: Record<string, string> = {
  short: "Compact for age",
  average: "Average height",
  tall: "Tall for age",
};

function depChip(val: string | undefined, map: Record<string, string>) {
  return val ? map[val] ?? null : null;
}

function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

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
  const [dependentToDelete, setDependentToDelete] = useState<Dependent | null>(
    null,
  );
  const [graduationForm, setGraduationForm] = useState({
    dependentId: "",
    dependentName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
  });
  const [isEditingSports, setIsEditingSports] = useState(false);
  const [isSavingSports, setIsSavingSports] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [playerProfileForm, setPlayerProfileForm] = useState({
    yearsPlaying: undefined as number | undefined,
    personalityTags: [] as string[],
    primaryObjective: "Recreational" as "Recreational" | "Fitness" | "Compete",
    weeklyTimeCommitment: 3,
    budgetTier: "Moderate" as "Budget" | "Moderate" | "Premium",
    location: "",
    bio: "",
    involvementYears: undefined as number | undefined,
    sportInterests: [] as string[],
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

  const handleStartGraduation = (dependent: Dependent) => {
    if (!dependent._id) {
      toast.error("Unable to graduate dependent without an id.");
      return;
    }

    const age = getDependentAge(dependent.dob);
    if (age === null) {
      toast.error("Dependent date of birth is missing or invalid.");
      return;
    }

    if (age < 18) {
      toast.error(
        `This dependent is ${age} years old and must be at least 18 to graduate.`,
      );
      return;
    }

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
      toast.error("Please fill in all required fields.");
      return;
    }

    setGraduatingDependentId(graduationForm.dependentId);

    try {
      const response = await authApi.graduateDependent({
        dependentId: graduationForm.dependentId,
        email: graduationForm.email,
        password: graduationForm.password,
        phone: graduationForm.phone,
      });
      if (response.success) {
        toast.success(
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
        toast.error(response.message || "Failed to graduate dependent");
      }
    } catch (error: unknown) {
      const errorMessage =
        getErrorMessage(error) || "Failed to graduate dependent";
      toast.error(errorMessage);
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
    yearsPlaying?: number;
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    location?: string;
    heightCm?: number;
    weightKg?: number;
    medicalConditions?: string[];
  }) => {
    try {
      if (dependentModalMode === "add") {
        setSavingDependentId("new");
        await authApi.addDependent(dependentData);
        toast.success("Dependent added successfully");
      } else if (selectedDependent?._id) {
        setSavingDependentId(selectedDependent._id);
        await authApi.updateDependent(selectedDependent._id, dependentData);
        toast.success("Dependent updated successfully");
      }
      await fetchProfile();
    } catch (error: unknown) {
      throw error;
    } finally {
      setSavingDependentId(null);
    }
  };

  const handleDeleteDependent = async () => {
    const dependentId = dependentToDelete?._id?.toString();
    if (!dependentId) return;

    setDeletingDependentId(dependentId);

    try {
      await authApi.deleteDependent(dependentId);
      await fetchProfile();
      setDependentToDelete(null);
      toast.success("Dependent removed");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to delete dependent");
    } finally {
      setDeletingDependentId(null);
    }
  };

  const resetProfileForm = () => {
    if (!user) return;
    setProfileForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      dob: user.dob ? new Date(user.dob).toISOString().split("T")[0] : "",
    });
  };

  const handleEditProfileClick = () => {
    if (!user) return;
    resetProfileForm();
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    resetProfileForm();
    setIsEditingProfile(false);
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
      toast.success("Profile updated successfully");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const resetSportsForm = () => {
    if (!user) return;
    setSelectedSports(user.playerProfile?.sportsFocus || []);
    setPlayerProfileForm({
      yearsPlaying: user.playerProfile?.yearsPlaying,
      personalityTags: user.playerProfile?.personalityTags || [],
      primaryObjective: user.playerProfile?.primaryObjective || "Recreational",
      weeklyTimeCommitment: user.playerProfile?.weeklyTimeCommitment || 3,
      budgetTier: user.playerProfile?.budgetTier || "Moderate",
      location: user.playerProfile?.location || "",
      bio: user.parentProfile?.bio || "",
      involvementYears: user.parentProfile?.involvementYears,
      sportInterests: user.parentProfile?.sportInterests || [],
    });
  };

  const handleEditSportsClick = () => {
    if (!user) return;
    resetSportsForm();
    setIsEditingSports(true);
  };

  const handleCancelSportsEdit = () => {
    resetSportsForm();
    setIsEditingSports(false);
  };

  const handleSaveSports = async () => {
    setIsSavingSports(true);
    try {
      const updatePayload: Parameters<typeof authApi.updateProfile>[0] = {
        playerProfile: {
          sportsFocus: selectedSports,
          yearsPlaying: playerProfileForm.yearsPlaying,
          personalityTags: playerProfileForm.personalityTags,
          primaryObjective: playerProfileForm.primaryObjective,
          weeklyTimeCommitment: playerProfileForm.weeklyTimeCommitment,
          budgetTier: playerProfileForm.budgetTier,
          location: playerProfileForm.location || undefined,
        },
      };
      if (user?.userType === "Parent") {
        updatePayload.parentProfile = {
          bio: playerProfileForm.bio.trim() || undefined,
          sportInterests: playerProfileForm.sportInterests,
          involvementYears: playerProfileForm.involvementYears,
        };
      }
      await authApi.updateProfile(updatePayload);
      await fetchProfile();
      setIsEditingSports(false);
      toast.success("Profile updated!");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to update profile");
    } finally {
      setIsSavingSports(false);
    }
  };

  const closeGraduationModal = () => {
    setShowGraduationModal(false);
    setGraduationForm({
      dependentId: "",
      dependentName: "",
      email: "",
      password: "",
      phone: "",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Profile" },
          ]}
        />
        <ProfilePageSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Profile" },
          ]}
        />
        <Card className="shop-surface premium-shadow">
          <EmptyState
            icon={UserRound}
            title="Unable to load profile"
            description="We couldn't fetch your profile details. Please refresh the page or try again later."
          />
        </Card>
      </div>
    );
  }

  const isParent = user.userType === "Parent";
  const sportsCount = user.playerProfile?.sportsFocus?.length ?? 0;
  const dependentsCount = user.dependents?.length ?? 0;
  const userAge = user.dob ? getDependentAge(user.dob) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Profile" },
        ]}
      />

      <PlayerPageHeader
        badge={user.userType || "Player"}
        title="My Profile"
        subtitle="Manage your account details, sports preferences, and family dependents in one place."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sports
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {sportsCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dependents
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {dependentsCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account
          </p>
          <p className="mt-1 text-lg font-bold capitalize text-slate-900">
            {user.userType || user.role.toLowerCase().replace("_", " ")}
          </p>
        </div>
      </div>

      <Card
        className={cn(
          "shop-surface premium-shadow overflow-hidden p-0 transition-shadow",
          isEditingProfile && "ring-2 ring-power-orange/20",
        )}
      >
        <ProfileSectionHeader
          icon={UserRound}
          title="Account Details"
          description="Your profile information and contact details."
          isEditing={isEditingProfile}
          onEdit={handleEditProfileClick}
          onCancel={handleCancelProfileEdit}
          onSave={handleSaveProfile}
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
                  {user.userType || user.role.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="flex-1">
              {isEditingProfile ? (
                <ProfileEditPanel description="Update your contact details. Name and email are required.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileEditField
                      label="Name"
                      htmlFor="profile-name"
                      required
                      icon={UserRound}
                    >
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
                          {user.userType === "Parent"
                            ? "Parent"
                            : user.role.toLowerCase().replace("_", " ")}
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

      <Card
        className={cn(
          "shop-surface premium-shadow overflow-hidden p-0 transition-shadow",
          isEditingSports && "ring-2 ring-power-orange/20",
        )}
      >
        <ProfileSectionHeader
          icon={Trophy}
          title={isParent ? "Parent Profile" : "Player Profile"}
          description={
            isParent
              ? "Your background and preferences — used to personalise AI guidance."
              : "Your sports and AI guidance preferences."
          }
          isEditing={isEditingSports}
          onEdit={handleEditSportsClick}
          onCancel={handleCancelSportsEdit}
          onSave={handleSaveSports}
          saving={isSavingSports}
          saveLabel="Save Profile"
          completionPercent={
            calculateProfileCompletion(user.playerProfile).percent
          }
        />

        <CardContent className="px-6 py-6">
          {isEditingSports ? (
            <div className="space-y-6">
              {isParent ? (
                <ProfileEditPanel
                  title="About You"
                  description="Your sports background as a parent — helps the AI understand your perspective."
                >
                  <ProfileEditField
                    label="About You"
                    htmlFor="parent-bio"
                    hint={`${playerProfileForm.bio.length}/300 — your background as a sports parent`}
                  >
                    <textarea
                      id="parent-bio"
                      rows={3}
                      maxLength={300}
                      value={playerProfileForm.bio}
                      onChange={(e) =>
                        setPlayerProfileForm((f) => ({ ...f, bio: e.target.value }))
                      }
                      placeholder="e.g., Former club cricketer, now focused on my daughter's tennis journey."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 resize-none"
                    />
                  </ProfileEditField>

                  <ProfileEditField
                    label="Sports You Follow or Have Played"
                    hint="Helps the AI understand your perspective when asking about your child's sport"
                  >
                    <SportsMultiSelect
                      value={playerProfileForm.sportInterests}
                      onChange={(s) =>
                        setPlayerProfileForm((f) => ({ ...f, sportInterests: s }))
                      }
                    />
                  </ProfileEditField>

                  <ProfileEditField
                    label="Years Involved in Sport"
                    htmlFor="parent-involvement-years"
                    hint="How long you've been involved or interested in sport"
                  >
                    <div className="flex items-center gap-3">
                      <Input
                        id="parent-involvement-years"
                        type="number"
                        min="0"
                        max="40"
                        placeholder="e.g., 5"
                        value={playerProfileForm.involvementYears ?? ""}
                        onChange={(e) =>
                          setPlayerProfileForm((f) => ({
                            ...f,
                            involvementYears:
                              e.target.value === ""
                                ? undefined
                                : Math.min(40, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                        className="w-28"
                      />
                      <span className="text-sm text-slate-500">years</span>
                    </div>
                  </ProfileEditField>
                </ProfileEditPanel>
              ) : (
                <ProfileEditPanel description="Choose the sports you play or are interested in. You can select multiple.">
                  <ProfileEditField
                    label="Your sports"
                    hint={`${selectedSports.length} sport${selectedSports.length === 1 ? "" : "s"} selected`}
                  >
                    <SportsMultiSelect
                      value={selectedSports}
                      onChange={setSelectedSports}
                    />
                  </ProfileEditField>

                  <ProfileEditField
                    label="Experience (Years)"
                    htmlFor="self-years-playing"
                    hint="Leave blank if you haven't started playing yet"
                  >
                    <Input
                      id="self-years-playing"
                      type="number"
                      min="0"
                      max="20"
                      placeholder="e.g., 2"
                      value={playerProfileForm.yearsPlaying ?? ""}
                      onChange={(e) =>
                        setPlayerProfileForm((f) => ({
                          ...f,
                          yearsPlaying:
                            e.target.value === ""
                              ? undefined
                              : parseInt(e.target.value, 10),
                        }))
                      }
                    />
                  </ProfileEditField>

                  {selectedSports.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-orange-100 bg-white/80 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Selected
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSports.map((sport) => (
                          <Badge
                            key={sport}
                            className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                          >
                            {sport}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center">
                      <Trophy className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                      <p className="text-sm text-slate-500">
                        No sports selected yet. Search above to add some.
                      </p>
                    </div>
                  )}
                </ProfileEditPanel>
              )}

              <ProfileEditPanel
                title="AI Guidance Preferences"
                description="Used to pre-fill AI recommendations for you."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ProfileEditField
                      label="Primary Objective"
                      htmlFor="primary-objective"
                    >
                      <ProfileFormSelect
                        id="primary-objective"
                        value={playerProfileForm.primaryObjective}
                        onChange={(value: any) =>
                          setPlayerProfileForm((f) => ({
                            ...f,
                            primaryObjective: value,
                          }))
                        }
                        options={[
                          { value: "Recreational", label: "Recreational" },
                          { value: "Fitness", label: "Fitness" },
                          { value: "Compete", label: "Compete" },
                        ]}
                      />
                    </ProfileEditField>

                    <ProfileEditField label="Budget Tier" htmlFor="budget-tier">
                      <ProfileFormSelect
                        id="budget-tier"
                        value={playerProfileForm.budgetTier}
                        onChange={(value: any) =>
                          setPlayerProfileForm((f) => ({
                            ...f,
                            budgetTier: value,
                          }))
                        }
                        options={[
                          { value: "Budget", label: "Budget" },
                          { value: "Moderate", label: "Moderate" },
                          { value: "Premium", label: "Premium" },
                        ]}
                      />
                    </ProfileEditField>
                  </div>

                  <ProfileEditField
                    label="State / Union Territory"
                    htmlFor="self-location"
                    hint="Used for local scheme & resource recommendations"
                  >
                    <ProfileFormSelect
                      id="self-location"
                      value={playerProfileForm.location}
                      onChange={(value: string) =>
                        setPlayerProfileForm((f) => ({ ...f, location: value }))
                      }
                      options={[
                        { value: "", label: "— Select state —" },
                        ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                  </ProfileEditField>

                  <ProfileEditField
                    label="Weekly Time Commitment (Hours)"
                    htmlFor="weekly-time"
                  >
                    <Input
                      id="weekly-time"
                      type="number"
                      min="1"
                      max="40"
                      value={playerProfileForm.weeklyTimeCommitment}
                      onChange={(e) =>
                        setPlayerProfileForm((f) => ({
                          ...f,
                          weeklyTimeCommitment: parseInt(e.target.value) || 3,
                        }))
                      }
                    />
                  </ProfileEditField>

                  <ProfileEditField label="Personality Tags">
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Shy",
                        "Energetic",
                        "Competitive",
                        "Social",
                        "Focused",
                        "Curious",
                        "Patient",
                        "Team-oriented",
                      ].map((tag) => {
                        const isSelected =
                          playerProfileForm.personalityTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const current = playerProfileForm.personalityTags;
                              const next = isSelected
                                ? current.filter((t) => t !== tag)
                                : [...current, tag];
                              setPlayerProfileForm((f) => ({
                                ...f,
                                personalityTags: next,
                              }));
                            }}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              isSelected
                                ? "border-blue-600 bg-indigo-50 font-medium text-indigo-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </ProfileEditField>
                </div>
              </ProfileEditPanel>
            </div>
          ) : (
            <div className="space-y-8">
              {isParent ? (
                <div>
                  <h4 className="mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    About You
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileInfoField label="Background">
                      {user.parentProfile?.bio ? (
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {user.parentProfile.bio}
                        </p>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Not provided</span>
                      )}
                    </ProfileInfoField>
                    <ProfileInfoField label="Years Involved in Sport">
                      {user.parentProfile?.involvementYears !== undefined
                        ? `${user.parentProfile.involvementYears} year${user.parentProfile.involvementYears === 1 ? "" : "s"}`
                        : <span className="text-slate-400 italic text-sm">Not provided</span>}
                    </ProfileInfoField>
                    <ProfileInfoField label="Sports Followed">
                      {user.parentProfile?.sportInterests &&
                      user.parentProfile.sportInterests.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {user.parentProfile.sportInterests.map((sport) => (
                            <Badge
                              key={sport}
                              className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                            >
                              {sport}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Not provided</span>
                      )}
                    </ProfileInfoField>
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    My Sports
                  </h4>
                  {user.playerProfile?.sportsFocus &&
                  user.playerProfile.sportsFocus.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {user.playerProfile.sportsFocus.map((sport: string) => (
                        <Badge
                          key={sport}
                          className="border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                        >
                          {sport}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center max-w-lg">
                      <Trophy className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">
                        No sports added yet
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Add the sports you play to get better recommendations.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleEditSportsClick}
                      >
                        Add Sports
                      </Button>
                    </div>
                  )}
                  <div className="mt-4">
                    <ProfileInfoField label="Experience">
                      {user.playerProfile?.yearsPlaying !== undefined
                        ? `${user.playerProfile.yearsPlaying} year${user.playerProfile.yearsPlaying === 1 ? "" : "s"}`
                        : "Not started yet"}
                    </ProfileInfoField>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-6">
                <h4 className="mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AI Guidance Preferences
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileInfoField label="Primary Objective">
                    {user.playerProfile?.primaryObjective || "Not specified"}
                  </ProfileInfoField>
                  <ProfileInfoField label="Budget">
                    {user.playerProfile?.budgetTier || "Not specified"}
                  </ProfileInfoField>
                  <ProfileInfoField label="State">
                    {user.playerProfile?.location || "Not specified"}
                  </ProfileInfoField>
                  <ProfileInfoField label="Weekly Time">
                    {user.playerProfile?.weeklyTimeCommitment
                      ? `${user.playerProfile.weeklyTimeCommitment} hours`
                      : "Not specified"}
                  </ProfileInfoField>
                  <ProfileInfoField label="Personality">
                    {user.playerProfile?.personalityTags &&
                    user.playerProfile.personalityTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.playerProfile.personalityTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "Not specified"
                    )}
                  </ProfileInfoField>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(user.userType === "Parent" ||
        (user.dependents && user.dependents.length > 0)) && (
        <Card className="shop-surface premium-shadow overflow-hidden p-0">
          <ProfileSectionHeader
            icon={Users}
            title="My Dependents"
            description="Manage children or wards whose bookings you handle."
            action={
              user.userType === "Parent" ? (
                <Button
                  onClick={handleAddDependent}
                  size="sm"
                  icon={<Plus size={14} />}
                  className="w-full sm:w-auto"
                >
                  Add Dependent
                </Button>
              ) : undefined
            }
          />

          <CardContent className="px-6 py-6">
            {user.dependents && user.dependents.length > 0 ? (
              <div className="grid gap-4">
                {user.dependents.map((dependent) => {
                  const age =
                    getDependentAge(dependent.dob) ?? dependent.age ?? null;
                  const isEligible = age !== null && age >= 18;
                  const genderLabel = formatGender(dependent.gender);
                  const dependentCompletion =
                    calculateProfileCompletion(dependent);

                  return (
                    <div
                      key={dependent._id}
                      className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <ProfileCompletionRing
                            percent={dependentCompletion.percent}
                            size={52}
                            strokeWidth={3}
                            title={`${dependent.name}'s profile is ${dependentCompletion.percent}% complete`}
                          >
                            <Avatar className="h-12 w-12 border border-white shadow-sm">
                              <AvatarFallback className="bg-power-orange/10 text-sm font-bold text-power-orange">
                                {getInitials(dependent.name)}
                              </AvatarFallback>
                            </Avatar>
                          </ProfileCompletionRing>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                              {dependent.name}
                            </h3>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {dependent.relation && (
                                <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                                  {formatDependentRelation(dependent.relation)}
                                </Badge>
                              )}
                              {genderLabel && (
                                <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                                  {genderLabel}
                                </Badge>
                              )}
                              {age !== null && (
                                <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                                  {age} yrs
                                </Badge>
                              )}
                              {dependentCompletion.percent < 100 && (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                  {dependentCompletion.percent}% complete
                                </Badge>
                              )}
                            </div>

                            {dependent.dob && (
                              <p className="mt-2 text-sm text-slate-500">
                                Born{" "}
                                {new Date(dependent.dob).toLocaleDateString(
                                  undefined,
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                            )}

                            {/* Wizard sport picks */}
                            {(dependent.sportMatches?.length ?? 0) > 0 ? (
                              <div className="mt-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                  Assessment picks
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {dependent.sportMatches!.map((m, i) => (
                                    <div
                                      key={m.sport}
                                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                                        i === 0
                                          ? "border-turf-green/30 bg-turf-green/10 text-turf-green"
                                          : "border-slate-200 bg-white text-slate-600"
                                      }`}
                                    >
                                      <span className="text-xs font-semibold">
                                        {m.sport}
                                      </span>
                                      <span className="text-[10px] opacity-60">
                                        {m.fitLabel}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : dependent.sportsFocus && dependent.sportsFocus.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {dependent.sportsFocus.map((sport: string) => (
                                  <Badge
                                    key={sport}
                                    className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50"
                                  >
                                    {sport}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            {/* Physical + personality trait chips */}
                            {(dependent.energyType ||
                              dependent.ambition ||
                              dependent.build ||
                              dependent.focusStyle ||
                              dependent.decisionStyle ||
                              dependent.heightCm) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(dependent.heightCm || dependent.weightKg) && (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                    {dependent.heightCm
                                      ? `${dependent.heightCm} cm`
                                      : ""}
                                    {dependent.heightCm && dependent.weightKg
                                      ? " · "
                                      : ""}
                                    {dependent.weightKg
                                      ? `${dependent.weightKg} kg`
                                      : ""}
                                    {dependent.build
                                      ? ` · ${BUILD_LABELS[dependent.build]}`
                                      : ""}
                                    {dependent.heightCategory && !dependent.build
                                      ? ` · ${HEIGHT_LABELS[dependent.heightCategory]}`
                                      : ""}
                                  </span>
                                )}
                                {depChip(dependent.energyType, ENERGY_LABELS) && (
                                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
                                    {depChip(dependent.energyType, ENERGY_LABELS)}
                                  </span>
                                )}
                                {depChip(dependent.ambition, AMBITION_LABELS) && (
                                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600">
                                    {depChip(dependent.ambition, AMBITION_LABELS)}
                                  </span>
                                )}
                                {depChip(dependent.focusStyle, FOCUS_LABELS) && (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                    {depChip(dependent.focusStyle, FOCUS_LABELS)}
                                  </span>
                                )}
                                {depChip(dependent.decisionStyle, DECISION_LABELS) && (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                    {depChip(
                                      dependent.decisionStyle,
                                      DECISION_LABELS,
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Medical conditions */}
                            {(dependent.medicalConditions?.length ?? 0) > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {dependent.medicalConditions!.map((cond) => (
                                  <Badge
                                    key={cond}
                                    className="border-amber-200 bg-amber-50 text-[11px] text-amber-700 hover:bg-amber-50"
                                  >
                                    {cond}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button
                            onClick={() => handleEditDependent(dependent)}
                            variant="secondary"
                            size="sm"
                            disabled={savingDependentId === dependent._id}
                            icon={<Edit2 size={14} />}
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => setDependentToDelete(dependent)}
                            variant="secondary"
                            size="sm"
                            disabled={isDeletingDependentId === dependent._id}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            icon={<Trash2 size={14} />}
                          >
                            {isDeletingDependentId === dependent._id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        </div>
                      </div>

                      <CardFooter className="mt-4 border-slate-200/70 px-0 pb-0">
                        <Button
                          onClick={() => handleStartGraduation(dependent)}
                          disabled={
                            !isEligible ||
                            graduatingDependentId === dependent._id
                          }
                          variant={isEligible ? "primary" : "secondary"}
                          size="sm"
                          icon={<GraduationCap size={14} />}
                          className="w-full sm:w-auto"
                        >
                          {graduatingDependentId === dependent._id
                            ? "Graduating..."
                            : isEligible
                              ? "Graduate to Independent"
                              : `Eligible at 18 (${age ?? "?"} yrs now)`}
                        </Button>
                      </CardFooter>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No dependents yet"
                description="Add a child or ward to manage their bookings, sports, and player profile from your account."
                actionLabel={
                  user.userType === "Parent" ? "Add Dependent" : undefined
                }
                onAction={
                  user.userType === "Parent" ? handleAddDependent : undefined
                }
              />
            )}
          </CardContent>

          <div className="border-t border-slate-200/60 bg-indigo-50/50 px-6 py-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Info className="h-4 w-4" />
              </div>
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  What is a dependent?
                </p>
                <p className="mt-1">
                  A dependent is someone whose bookings you manage. You can book
                  venues and coaches for them, track their sports, and graduate
                  them to an independent account once they turn 18.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <DependentManagementModal
        isOpen={showDependentModal}
        onClose={() => setShowDependentModal(false)}
        onSubmit={handleSaveDependent}
        initialDependent={selectedDependent}
        isLoading={savingDependentId !== null}
        mode={dependentModalMode}
      />

      <Modal
        isOpen={Boolean(dependentToDelete)}
        onClose={() => setDependentToDelete(null)}
        title="Delete dependent"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setDependentToDelete(null)}
              disabled={isDeletingDependentId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteDependent}
              disabled={isDeletingDependentId !== null}
              loading={isDeletingDependentId !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete
          <span className="font-semibold text-slate-900">
            {" "}
            {dependentToDelete?.name}
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={showGraduationModal}
        onClose={closeGraduationModal}
        title="Graduate to Independent Account"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeGraduationModal}
              disabled={graduatingDependentId === graduationForm.dependentId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitGraduation}
              loading={graduatingDependentId === graduationForm.dependentId}
              disabled={
                !graduationForm.email ||
                !graduationForm.password ||
                !graduationForm.phone
              }
            >
              Graduate
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <ProfileEditPanel
            title={`Account for ${graduationForm.dependentName}`}
            description="They will use these credentials to sign in and book independently."
          >
            <div className="space-y-4">
              <ProfileEditField
                label="Email"
                htmlFor="graduation-email"
                required
                icon={Mail}
                hint="This becomes their login email."
              >
                <Input
                  id="graduation-email"
                  type="email"
                  value={graduationForm.email}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="newaccount@example.com"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Password"
                htmlFor="graduation-password"
                required
                hint="Minimum 8 characters recommended."
              >
                <Input
                  id="graduation-password"
                  type="password"
                  value={graduationForm.password}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Create a password"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Phone"
                htmlFor="graduation-phone"
                required
                icon={Phone}
                hint="Used for booking confirmations."
              >
                <Input
                  id="graduation-phone"
                  type="tel"
                  value={graduationForm.phone}
                  onChange={(event) =>
                    setGraduationForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone number"
                />
              </ProfileEditField>
            </div>
          </ProfileEditPanel>
        </div>
      </Modal>
    </div>
  );
}
