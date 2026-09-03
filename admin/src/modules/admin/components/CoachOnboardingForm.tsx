"use client";

import { CoachOnboardingStep1 } from "@/modules/admin/components/coach-onboarding/CoachOnboardingStep1";
import { CoachOnboardingStep2 } from "@/modules/admin/components/coach-onboarding/CoachOnboardingStep2";
import { CoachOnboardingStep3 } from "@/modules/admin/components/coach-onboarding/CoachOnboardingStep3";
import { CoachOnboardingSuccess } from "@/modules/admin/components/coach-onboarding/CoachOnboardingSuccess";
import { useCoachOnboardingFlow } from "@/modules/admin/hooks/useCoachOnboardingFlow";
import { Step } from "@/modules/admin/utils/coachOnboardingHelpers";
import { Card } from "@/modules/shared/ui/Card";

export function CoachOnboardingForm() {
  const flow = useCoachOnboardingFlow();

  if (flow.successCoachId) {
    return (
      <CoachOnboardingSuccess
        successCoachId={flow.successCoachId}
        successCoachLink={flow.successCoachLink}
      />
    );
  }

  return (
    <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm">
      <div className="to-power-orange bg-linear-to-r border-b border-slate-200 from-slate-950 via-slate-900 px-6 py-6 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-orange-200">
              Coach onboarding on behalf of
            </p>
            <h1 className="mt-2 text-3xl font-bold">Create a coach account as admin</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Mirror the client onboarding flow while creating the account, profile, venue details,
              and verification records on the coach&apos;s behalf.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="font-semibold">Steps</p>
            <p className="text-slate-200">1. Identity 2. Coaching setup 3. Review & submit</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((current) => (
            <button
              key={current}
              type="button"
              onClick={() => flow.setStep(current as Step)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                flow.step === current
                  ? "border-power-orange text-power-orange bg-orange-50"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <p className="text-xs uppercase tracking-wide">Step {current}</p>
              <p className="mt-1 text-sm font-semibold">
                {current === 1 && "Identity"}
                {current === 2 && "Coaching setup"}
                {current === 3 && "Review & submit"}
              </p>
            </button>
          ))}
        </div>

        {flow.step === 1 && (
          <CoachOnboardingStep1
            loading={flow.loading}
            errors={flow.errors}
            setErrors={flow.setErrors}
            firstName={flow.firstName}
            setFirstName={flow.setFirstName}
            lastName={flow.lastName}
            setLastName={flow.setLastName}
            email={flow.email}
            setEmail={flow.setEmail}
            phone={flow.phone}
            setPhone={flow.setPhone}
            bio={flow.bio}
            setBio={flow.setBio}
            profilePhotoUrl={flow.profilePhotoUrl}
            setProfilePhotoUrl={flow.setProfilePhotoUrl}
            setProfilePhotoKey={flow.setProfilePhotoKey}
            onContinue={flow.handleContinueFromStep1}
          />
        )}

        {flow.step === 2 && (
          <CoachOnboardingStep2
            loading={flow.loading}
            errors={flow.errors}
            sports={flow.sports}
            setSports={flow.setSports}
            pricingMode={flow.pricingMode}
            setPricingMode={flow.setPricingMode}
            hourlyRateInput={flow.hourlyRateInput}
            setHourlyRateInput={flow.setHourlyRateInput}
            sportPricing={flow.sportPricing}
            setSportPricing={flow.setSportPricing}
            setErrors={flow.setErrors}
            serviceMode={flow.serviceMode}
            setServiceMode={flow.setServiceMode}
            needsBaseLocation={flow.needsBaseLocation}
            isOwnVenue={flow.isOwnVenue}
            baseLocationQuery={flow.baseLocationQuery}
            setBaseLocationQuery={flow.setBaseLocationQuery}
            setBaseLocation={flow.setBaseLocation}
            baseLocationSuggestions={flow.baseLocationSuggestions}
            baseLocationSearching={flow.baseLocationSearching}
            baseLocationError={flow.baseLocationError}
            setBaseLocationError={flow.setBaseLocationError}
            onSelectBaseLocation={flow.handleSelectBaseLocation}
            serviceRadiusKmInput={flow.serviceRadiusKmInput}
            setServiceRadiusKmInput={flow.setServiceRadiusKmInput}
            travelBufferTimeInput={flow.travelBufferTimeInput}
            setTravelBufferTimeInput={flow.setTravelBufferTimeInput}
            venueName={flow.venueName}
            setVenueName={flow.setVenueName}
            venueAddressQuery={flow.venueAddressQuery}
            setVenueAddressQuery={flow.setVenueAddressQuery}
            setVenueLocation={flow.setVenueLocation}
            venueAddressSuggestions={flow.venueAddressSuggestions}
            venueAddressSearching={flow.venueAddressSearching}
            venueAddressError={flow.venueAddressError}
            setVenueAddressError={flow.setVenueAddressError}
            onSelectVenueLocation={flow.handleSelectVenueLocation}
            venueDescription={flow.venueDescription}
            setVenueDescription={flow.setVenueDescription}
            venueOpeningHours={flow.venueOpeningHours}
            setVenueOpeningHours={flow.setVenueOpeningHours}
            onBack={() => flow.setStep(1)}
            onContinue={flow.handleContinueFromStep2}
          />
        )}

        {flow.step === 3 && (
          <CoachOnboardingStep3
            loading={flow.loading}
            creating={flow.creating}
            errors={flow.errors}
            firstName={flow.firstName}
            lastName={flow.lastName}
            email={flow.email}
            phone={flow.phone}
            bio={flow.bio}
            profilePhotoUrl={flow.profilePhotoUrl}
            sports={flow.sports}
            pricingMode={flow.pricingMode}
            serviceMode={flow.serviceMode}
            isOwnVenue={flow.isOwnVenue}
            venueName={flow.venueName}
            venueAddressQuery={flow.venueAddressQuery}
            verificationDocs={flow.verificationDocs}
            setVerificationDocs={flow.setVerificationDocs}
            onDocumentSelect={flow.handleDocumentSelect}
            onAddDocumentRow={flow.addDocumentRow}
            onRemoveDocumentRow={flow.removeDocumentRow}
            venueImageDrafts={flow.venueImageDrafts}
            venueImageInputRef={flow.venueImageInputRef}
            onVenueImageSelect={flow.handleVenueImageSelect}
            onRemoveVenueImage={flow.removeVenueImage}
            onBack={() => flow.setStep(2)}
            onSubmit={flow.handleSubmit}
          />
        )}
      </div>
    </Card>
  );
}
