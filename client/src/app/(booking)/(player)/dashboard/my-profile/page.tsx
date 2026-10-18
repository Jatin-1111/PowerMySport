"use client";

import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import DependentManagementModal from "@/modules/player/components/DependentManagementModal";
import QuickAddDependentModal from "@/modules/player/components/QuickAddDependentModal";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { Suspense } from "react";
import { AccountDetailsCard } from "./components/AccountDetailsCard";
import { PlayerProfileCard } from "./components/PlayerProfileCard";
import { DependentsCard } from "./components/DependentsCard";
import { useProfilePage } from "./hooks/useProfilePage";

function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-14 w-72 max-w-full" />
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
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My profile" }]}
        />
        <ProfilePageSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My profile" }]}
        />
        <div className="py-16">
          <p className="font-editorial text-ink text-3xl font-light">
            We couldn&apos;t load your profile
          </p>
          <p className="text-ink-body mt-2 max-w-md text-pretty">
            Refresh the page to try again. If it keeps failing, contact support.
          </p>
        </div>
      </div>
    );
  }

  const isParent = user.role === "Parent";
  const userAge = user.dob ? getDependentAge(user.dob) : null;

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "My profile" }]} />

      <PlayerPageHeader
        badge={isParent ? "Parent" : "Player"}
        title="My profile"
        subtitle="Your account details, sports and family dependents."
      />

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
