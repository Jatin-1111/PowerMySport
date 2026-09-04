"use client";

import { toast } from "@/lib/toast";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { authApi } from "@/modules/auth/services/auth";
import { normalizeStoredState } from "@/lib/indianStates";
import { type DependentModalStepId } from "@/modules/player/components/DependentManagementModal";
import { User } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export type Dependent = NonNullable<User["dependents"]>[number];

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

export function useProfilePage() {
  const router = useRouter();
  // Shared profile query entry, but always re-read from the network: this page
  // both reads and writes the profile, so a cached read after a save would show
  // the user the value they just replaced.
  const loadProfile = useRefreshProfile();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDependentModal, setShowDependentModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [dependentModalStepId, setDependentModalStepId] = useState<
    DependentModalStepId | undefined
  >(undefined);
  const [selectedDependent, setSelectedDependent] = useState<Dependent | null>(null);
  const [savingDependentId, setSavingDependentId] = useState<string | null>(null);
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [isDeletingDependentId, setDeletingDependentId] = useState<string | null>(null);
  const [dependentToDelete, setDependentToDelete] = useState<Dependent | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      // Writes through the shared query entry, so `useProfile` consumers get
      // the same profile this page just rendered.
      setUser(await loadProfile());
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Deep-link from cross-flow "complete your profile" nudges (guidance,
  // expert booking): ?editDependent=<id>&step=<stepId> opens that dependent
  // straight at the relevant step, then clears the URL so a refresh doesn't
  // reopen it.
  useEffect(() => {
    if (!user) return;
    const editDependentId = searchParams.get("editDependent");
    if (!editDependentId) return;
    const dependent = user.dependents?.find((d) => d._id?.toString() === editDependentId);
    if (!dependent) return;
    setSelectedDependent(dependent);
    setDependentModalStepId((searchParams.get("step") as DependentModalStepId | null) ?? undefined);
    setShowDependentModal(true);
    router.replace("/dashboard/my-profile", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  const handleAddDependent = () => {
    setShowQuickAddModal(true);
  };

  const handleQuickAddDependent = async (dependentData: Dependent) => {
    setIsAddingDependent(true);
    try {
      await authApi.addDependent(dependentData);
      toast.success("Dependent added successfully");
      await fetchProfile();
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsAddingDependent(false);
    }
  };

  const handleSaveDependent = async (dependentData: Dependent) => {
    if (!selectedDependent?._id) return;
    setSavingDependentId(selectedDependent._id);
    try {
      await authApi.updateDependent(selectedDependent._id, dependentData);
      toast.success("Dependent updated successfully");
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
      // Canonicalised on the way in: a profile saved with the old "Jammu &
      // Kashmir" spelling would otherwise match no option and blank the field.
      location: normalizeStoredState(user.playerProfile?.location),
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
      if (user?.role === "Parent") {
        updatePayload.parentProfile = {
          bio: playerProfileForm.bio.trim() || undefined,
          sportInterests: playerProfileForm.sportInterests,
          involvementYears: playerProfileForm.involvementYears,
        };
      }
      await authApi.updateProfile(updatePayload);
      await fetchProfile();
      setIsEditingSports(false);
      toast.success("Profile updated.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to update profile");
    } finally {
      setIsSavingSports(false);
    }
  };

  return {
    router,
    user,
    setUser,
    isLoading,
    showDependentModal,
    setShowDependentModal,
    showQuickAddModal,
    setShowQuickAddModal,
    dependentModalStepId,
    selectedDependent,
    savingDependentId,
    isAddingDependent,
    isDeletingDependentId,
    dependentToDelete,
    setDependentToDelete,
    isEditingProfile,
    isSavingProfile,
    profileForm,
    setProfileForm,
    isEditingSports,
    isSavingSports,
    selectedSports,
    setSelectedSports,
    playerProfileForm,
    setPlayerProfileForm,

    handleAddDependent,
    handleQuickAddDependent,
    handleSaveDependent,
    handleDeleteDependent,
    handleEditProfileClick,
    handleCancelProfileEdit,
    handleSaveProfile,
    handleEditSportsClick,
    handleCancelSportsEdit,
    handleSaveSports,
  };
}
