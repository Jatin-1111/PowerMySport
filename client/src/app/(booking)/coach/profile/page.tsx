"use client";

import { AboutCard } from "@/modules/coach/components/profile/AboutCard";
import { AvailabilityCard } from "@/modules/coach/components/profile/AvailabilityCard";
import { CoachingDetailsCard } from "@/modules/coach/components/profile/CoachingDetailsCard";
import { ProfileHeaderCard } from "@/modules/coach/components/profile/ProfileHeaderCard";
import {
  CheckInCard,
  ProfileInfoCard,
  QuickActionsCard,
  VerificationDocumentsCard,
  VerificationStatusCard,
} from "@/modules/coach/components/profile/ProfileSidebarCards";
import { TaxDetailsCard } from "@/modules/coach/components/profile/TaxDetailsCard";
import { VenueImageLightbox } from "@/modules/coach/components/profile/VenueImageLightbox";
import { useCoachProfileFlow } from "@/modules/coach/hooks/useCoachProfileFlow";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function CoachProfilePage() {
  const flow = useCoachProfileFlow();

  if (flow.loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading profile...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <ProfileHeaderCard
        user={flow.user}
        setUser={flow.setUser}
        coachProfile={flow.coachProfile}
        badge={flow.badge}
        guidance={flow.guidance}
        sportsCount={flow.sportsCount}
        basePrice={flow.basePrice}
        totalSlots={flow.totalSlots}
      />

      {flow.coachProfile ? (
        <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
          <div className="space-y-6 xl:col-span-8">
            <AboutCard
              bio={flow.coachProfile.bio || ""}
              isEditing={flow.isEditingAbout}
              isSaving={flow.isSavingAbout}
              aboutForm={flow.aboutForm}
              setAboutForm={flow.setAboutForm}
              onEditClick={flow.handleEditAboutClick}
              onSave={() => void flow.handleSaveAbout()}
              onCancel={() => flow.setIsEditingAbout(false)}
            />

            <TaxDetailsCard
              gstNumber={flow.coachProfile.gstNumber}
              isEditing={flow.isEditingTax}
              isSaving={flow.isSavingTax}
              taxForm={flow.taxForm}
              setTaxForm={flow.setTaxForm}
              onEditClick={flow.handleEditTaxClick}
              onSave={() => void flow.handleSaveTax()}
              onCancel={() => flow.setIsEditingTax(false)}
            />

            <CoachingDetailsCard
              coachProfile={flow.coachProfile}
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
              sports={flow.coachProfile.sports || []}
              activeSportTab={flow.activeSportTab}
              setActiveSportTab={flow.setActiveSportTab}
              availabilityBySport={flow.availabilityBySport}
              savingAvailability={flow.savingAvailability}
              onAddTimeSlot={flow.addTimeSlot}
              onRemoveTimeSlot={flow.removeTimeSlot}
              onUpdateTimeSlot={flow.updateTimeSlot}
              onSave={() => void flow.handleSaveAvailability()}
            />

            {flow.coachProfile.verificationDocuments &&
              flow.coachProfile.verificationDocuments.length > 0 && (
                <VerificationDocumentsCard documents={flow.coachProfile.verificationDocuments} />
              )}
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:col-span-4 xl:self-start">
            <CheckInCard
              checkInCode={flow.checkInCode}
              setCheckInCode={flow.setCheckInCode}
              checkInLoading={flow.checkInLoading}
              checkInMessage={flow.checkInMessage}
              checkedInBooking={flow.checkedInBooking}
              onCheckIn={() => void flow.handleCoachCheckIn()}
            />

            <VerificationStatusCard
              badge={flow.badge}
              guidance={flow.guidance}
              status={flow.status}
            />

            <ProfileInfoCard
              user={flow.user}
              isEditing={flow.isEditingProfile}
              isSaving={flow.isSavingProfile}
              profileForm={flow.profileForm}
              setProfileForm={flow.setProfileForm}
              onEditClick={flow.handleEditProfileClick}
              onSave={() => void flow.handleSaveProfile()}
              onCancel={flow.handleCancelEdit}
            />

            <QuickActionsCard onLogout={() => void flow.handleLogout()} />
          </div>
        </div>
      ) : (
        <Card className="bg-white">
          <div className="py-8 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold text-slate-900">No Coach Profile Yet</h3>
            <p className="mb-4 text-sm text-slate-600">
              Complete the verification process to create your coach profile and start accepting
              bookings.
            </p>
            <Link href="/coach/verification">
              <Button type="button" variant="primary" className="mx-auto">
                Start Verification
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {flow.selectedVenueImage && (
        <VenueImageLightbox
          imageUrl={flow.selectedVenueImage}
          onClose={() => flow.setSelectedVenueImage(null)}
        />
      )}
    </div>
  );
}
