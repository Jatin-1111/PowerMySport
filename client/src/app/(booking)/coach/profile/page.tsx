"use client";

import { AboutCard } from "@/modules/coach/components/profile/AboutCard";
import { AvailabilityCard } from "@/modules/coach/components/profile/AvailabilityCard";
import { CoachingDetailsCard } from "@/modules/coach/components/profile/CoachingDetailsCard";
import { ContactDetailsCard } from "@/modules/coach/components/profile/ContactDetailsCard";
import { ProfileHeaderCard } from "@/modules/coach/components/profile/ProfileHeaderCard";
import { TaxDetailsCard } from "@/modules/coach/components/profile/TaxDetailsCard";
import { VenueImageLightbox } from "@/modules/coach/components/profile/VenueImageLightbox";
import { VerificationSection } from "@/modules/coach/components/profile/VerificationSection";
import { useCoachProfileFlow } from "@/modules/coach/hooks/useCoachProfileFlow";
import { verificationView } from "@/modules/coach/utils/overview";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import Link from "next/link";

/**
 * The coach's profile: who they are, how they coach, when they can be booked,
 * and the account and tax details behind it. Every section edits the same way
 * (an Edit link, then Save or Cancel), and nothing is boxed inside a card.
 */
export default function CoachProfilePage() {
  const flow = useCoachProfileFlow();

  if (flow.loading) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        <span className="sr-only">Loading your profile</span>
        <div aria-hidden="true" className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-3 h-11 w-64 max-w-full" />
          </div>
        </div>
        <div aria-hidden="true" className="space-y-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!flow.coachProfile) {
    return (
      <div className="max-w-xl">
        <h1 className="font-editorial text-ink text-4xl font-light tracking-tight">
          No coach profile yet
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Finish verification to create your profile and start taking bookings.
        </p>
        <Button asChild className="mt-6" size="lg">
          <Link href="/coach/verification">Start verification</Link>
        </Button>
      </div>
    );
  }

  const coach = flow.coachProfile;

  return (
    <div className="pb-8">
      <ProfileHeaderCard
        user={flow.user}
        setUser={flow.setUser}
        coachProfile={coach}
        view={verificationView(coach)}
      />

      <AboutCard
        bio={coach.bio || ""}
        isEditing={flow.isEditingAbout}
        isSaving={flow.isSavingAbout}
        aboutForm={flow.aboutForm}
        setAboutForm={flow.setAboutForm}
        onEditClick={flow.handleEditAboutClick}
        onSave={() => void flow.handleSaveAbout()}
        onCancel={() => flow.setIsEditingAbout(false)}
      />

      <CoachingDetailsCard
        coachProfile={coach}
        isEditing={flow.isEditingCoaching}
        isSaving={flow.isSavingCoaching}
        coachingForm={flow.coachingForm}
        setCoachingForm={flow.setCoachingForm}
        onEditClick={flow.handleEditCoachingClick}
        onSave={() => void flow.handleSaveCoachingDetails()}
        onCancel={() => flow.setIsEditingCoaching(false)}
        isEditingVenueImages={flow.isEditingVenueImages}
        isUploadingVenueImages={flow.isUploadingVenueImages}
        isSavingVenueImages={flow.isSavingVenueImages}
        venueImageDraft={flow.venueImageDraft}
        venueImageInputRef={flow.venueImageInputRef}
        onEditVenueImagesClick={flow.handleEditVenueImagesClick}
        onCancelVenueImagesEdit={flow.handleCancelVenueImagesEdit}
        onRemoveVenueImage={flow.handleRemoveVenueImage}
        onVenueImagesSelected={(event) => void flow.handleVenueImagesSelected(event)}
        onSaveVenueImages={() => void flow.handleSaveVenueImages()}
        onSelectVenueImage={flow.setSelectedVenueImage}
      />

      <AvailabilityCard
        sports={coach.sports || []}
        activeSportTab={flow.activeSportTab}
        setActiveSportTab={flow.setActiveSportTab}
        availabilityBySport={flow.availabilityBySport}
        savingAvailability={flow.savingAvailability}
        onAddTimeSlot={flow.addTimeSlot}
        onRemoveTimeSlot={flow.removeTimeSlot}
        onUpdateTimeSlot={flow.updateTimeSlot}
        onSave={() => void flow.handleSaveAvailability()}
      />

      <ContactDetailsCard
        user={flow.user}
        isEditing={flow.isEditingProfile}
        isSaving={flow.isSavingProfile}
        profileForm={flow.profileForm}
        setProfileForm={flow.setProfileForm}
        onEditClick={flow.handleEditProfileClick}
        onSave={() => void flow.handleSaveProfile()}
        onCancel={flow.handleCancelEdit}
      />

      <TaxDetailsCard
        gstNumber={coach.gstNumber}
        isEditing={flow.isEditingTax}
        isSaving={flow.isSavingTax}
        taxForm={flow.taxForm}
        setTaxForm={flow.setTaxForm}
        onEditClick={flow.handleEditTaxClick}
        onSave={() => void flow.handleSaveTax()}
        onCancel={() => flow.setIsEditingTax(false)}
      />

      <VerificationSection
        view={verificationView(coach)}
        guidance={flow.guidance}
        documents={coach.verificationDocuments ?? []}
        notes={coach.verificationNotes}
      />

      {flow.selectedVenueImage && (
        <VenueImageLightbox
          imageUrl={flow.selectedVenueImage}
          onClose={() => flow.setSelectedVenueImage(null)}
        />
      )}
    </div>
  );
}
