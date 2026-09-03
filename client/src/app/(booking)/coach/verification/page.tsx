"use client";

import { VerificationStep1 } from "@/modules/coach/components/verification/VerificationStep1";
import { VerificationStep2 } from "@/modules/coach/components/verification/VerificationStep2";
import { VerificationStep3 } from "@/modules/coach/components/verification/VerificationStep3";
import { useCoachVerificationFlow } from "@/modules/coach/hooks/useCoachVerificationFlow";
import { VerificationStep } from "@/modules/coach/utils/verificationFlow";
import { Card } from "@/modules/shared/ui/Card";

export default function CoachVerificationPage() {
  const flow = useCoachVerificationFlow();

  if (flow.loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading verification flow...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="bg-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Coach Verification</p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-3xl">
              Complete Your Verification
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              3 steps: Bio, Sports/Pricing, Final Submission
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${flow.badge.className}`}
          >
            {flow.badge.label}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {flow.guidance}
        </div>

        {flow.coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {flow.coachProfile.verificationNotes}
          </div>
        )}

        {flow.canShowResumeBanner && flow.resumeStepHint && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-orange-800">
              You can continue where you left off. Resume from Step {flow.resumeStepHint}.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="bg-power-orange rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                onClick={() => flow.navigateToStep(flow.resumeStepHint as VerificationStep, false)}
              >
                Resume Step {flow.resumeStepHint}
              </button>
              <button
                type="button"
                className="rounded-md border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                onClick={() => flow.setShowResumeBanner(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-white">
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          {([1, 2, 3] as VerificationStep[]).map((current) => {
            const isActive = flow.step === current;
            const isCompleted = current < flow.step;
            const isAccessible = current <= flow.maxAccessibleStep;
            return (
              <button
                key={current}
                type="button"
                onClick={() => flow.navigateToStep(current)}
                disabled={!isAccessible || flow.isLockedByReview}
                className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition-all ${
                  isActive
                    ? "border-power-orange text-power-orange bg-orange-50 shadow-sm"
                    : isCompleted
                      ? "cursor-pointer border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : isAccessible
                        ? "cursor-pointer border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-60"
                }`}
              >
                {isCompleted ? "✓ Step " : "Step "}
                {current}
              </button>
            );
          })}
        </div>

        {flow.step === 1 && (
          <VerificationStep1
            user={flow.user}
            setUser={flow.setUser}
            bio={flow.bio}
            setBio={flow.setBio}
            mobileNumber={flow.mobileNumber}
            setMobileNumber={flow.setMobileNumber}
            isLockedByReview={flow.isLockedByReview}
            isStep1Complete={flow.isStep1Complete}
            saving={flow.saving}
            onContinue={flow.handleStepOneContinue}
          />
        )}

        {flow.step === 2 && (
          <VerificationStep2
            isLockedByReview={flow.isLockedByReview}
            saving={flow.saving}
            isStep2Complete={flow.isStep2Complete}
            pricingMode={flow.pricingMode}
            setPricingMode={flow.setPricingMode}
            hourlyRateInput={flow.hourlyRateInput}
            setHourlyRateInput={flow.setHourlyRateInput}
            selectedSports={flow.selectedSports}
            setSelectedSports={flow.setSelectedSports}
            sportPricing={flow.sportPricing}
            setSportPricing={flow.setSportPricing}
            serviceMode={flow.serviceMode}
            venueDetails={flow.venueDetails}
            setVenueDetails={flow.setVenueDetails}
            addressQuery={flow.addressQuery}
            addressSuggestions={flow.addressSuggestions}
            isAddressSearching={flow.isAddressSearching}
            addressSearchError={flow.addressSearchError}
            isGeocoding={flow.isGeocoding}
            onAddressChange={flow.handleAddressChange}
            onSelectAddressSuggestion={flow.handleSelectAddressSuggestion}
            onUseCurrentLocation={flow.handleUseCurrentLocation}
            serviceRadiusKmInput={flow.serviceRadiusKmInput}
            setServiceRadiusKmInput={flow.setServiceRadiusKmInput}
            travelBufferTimeInput={flow.travelBufferTimeInput}
            setTravelBufferTimeInput={flow.setTravelBufferTimeInput}
            onBack={() => flow.navigateToStep(1, false)}
            onContinue={() => void flow.handleStepTwoContinue()}
          />
        )}

        {flow.step === 3 && (
          <VerificationStep3
            serviceMode={flow.serviceMode}
            venueImages={flow.venueDetails.images || []}
            isLockedByReview={flow.isLockedByReview}
            isUploadingVenueImage={flow.isUploadingVenueImage}
            isDraggingVenueImages={flow.isDraggingVenueImages}
            setIsDraggingVenueImages={flow.setIsDraggingVenueImages}
            onVenueImageDrop={flow.handleVenueImageDrop}
            venueImageInputRef={flow.venueImageInputRef}
            onVenueImageFile={flow.handleVenueImageFile}
            onRemoveVenueImage={flow.handleRemoveVenueImage}
            verificationDocs={flow.verificationDocs}
            setVerificationDocs={flow.setVerificationDocs}
            uploadingDocIndex={flow.uploadingDocIndex}
            onUploadDocument={(index, file) => void flow.handleUploadDocument(index, file)}
            saving={flow.saving}
            onBack={() => flow.navigateToStep(2, false)}
            onSubmit={() => void flow.handleSubmitVerification()}
          />
        )}
      </Card>
    </div>
  );
}
