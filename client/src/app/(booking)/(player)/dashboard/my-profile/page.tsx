"use client";

import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import QuickAddDependentModal from "@/modules/player/components/QuickAddDependentModal";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { UserRound } from "lucide-react";
import { Suspense } from "react";
import { AccountDetailsCard } from "./components/AccountDetailsCard";
import { PlayerProfileCard } from "./components/PlayerProfileCard";
import { DependentsCard } from "./components/DependentsCard";
import { useProfilePage } from "./hooks/useProfilePage";

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

function ProfilePageContent() {
  const {
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
  } = useProfilePage();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Profile" }]}
        />
        <ProfilePageSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Profile" }]}
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

  const isParent = user.role === "Parent";
  const sportsCount = user.playerProfile?.sportsFocus?.length ?? 0;
  const dependentsCount = user.dependents?.length ?? 0;
  const userAge = user.dob ? getDependentAge(user.dob) : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Profile" }]} />

      <PlayerPageHeader
        badge={isParent ? "Parent" : "Player"}
        title="My Profile"
        subtitle="Manage your account details, sports preferences, and family dependents in one place."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="premium-shadow shop-surface rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sports</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{sportsCount}</p>
        </div>
        <div className="premium-shadow shop-surface rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dependents</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{dependentsCount}</p>
        </div>
        <div className="premium-shadow shop-surface rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <p className="mt-1 text-lg font-bold capitalize text-slate-900">
            {user.role.toLowerCase().replace("_", " ")}
          </p>
        </div>
      </div>

      <AccountDetailsCard
        user={user}
        setUser={setUser}
        isParent={isParent}
        userAge={userAge}
        isEditingProfile={isEditingProfile}
        isSavingProfile={isSavingProfile}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        onEdit={handleEditProfileClick}
        onCancel={handleCancelProfileEdit}
        onSave={handleSaveProfile}
      />

      <PlayerProfileCard
        user={user}
        isParent={isParent}
        isEditingSports={isEditingSports}
        isSavingSports={isSavingSports}
        selectedSports={selectedSports}
        setSelectedSports={setSelectedSports}
        playerProfileForm={playerProfileForm}
        setPlayerProfileForm={setPlayerProfileForm}
        onEdit={handleEditSportsClick}
        onCancel={handleCancelSportsEdit}
        onSave={handleSaveSports}
      />

      {(isParent || (user.dependents && user.dependents.length > 0)) && (
        <DependentsCard
          user={user}
          isParent={isParent}
          router={router}
          onAddDependent={handleAddDependent}
          onDeleteDependent={setDependentToDelete}
          isDeletingDependentId={isDeletingDependentId}
        />
      )}

      <QuickAddDependentModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        onSubmit={handleQuickAddDependent}
        isLoading={isAddingDependent}
      />

      {selectedDependent && (
        <DependentManagementModal
          isOpen={showDependentModal}
          onClose={() => setShowDependentModal(false)}
          onSubmit={handleSaveDependent}
          initialDependent={selectedDependent}
          isLoading={savingDependentId !== null}
          initialStepId={dependentModalStepId}
        />
      )}

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
          <span className="font-semibold text-slate-900"> {dependentToDelete?.name}</span>? This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <ProfilePageContent />
    </Suspense>
  );
}
