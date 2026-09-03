"use client";

import { AddVenueStep1 } from "@/modules/admin/components/add-venue/AddVenueStep1";
import { AddVenueStep2 } from "@/modules/admin/components/add-venue/AddVenueStep2";
import { AddVenueStep3 } from "@/modules/admin/components/add-venue/AddVenueStep3";
import { AddVenueStep4 } from "@/modules/admin/components/add-venue/AddVenueStep4";
import { AddVenueStep5 } from "@/modules/admin/components/add-venue/AddVenueStep5";
import { AddVenueStepProgress } from "@/modules/admin/components/add-venue/AddVenueStepProgress";
import { useAddVenueFlow } from "@/modules/admin/hooks/useAddVenueFlow";

export function AddVenueForm() {
  const flow = useAddVenueFlow();

  return (
    <div className="min-h-screen py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">Add Venue</h1>
          <p className="text-slate-600">
            Complete these 5 steps to publish a venue from the admin panel
          </p>
          <p className="border-power-orange/20 bg-power-orange/10 text-power-orange mt-3 inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide">
            Step {flow.currentStep} of 5
          </p>
        </div>

        <AddVenueStepProgress
          currentStep={flow.currentStep}
          loading={flow.loading}
          onStepJump={flow.handleStepJump}
        />

        <div className="mx-auto max-w-3xl">
          {flow.currentStep === 1 && (
            <AddVenueStep1
              loading={flow.loading}
              errors={flow.errors}
              formData={flow.formData}
              handleInputChange={flow.handleInputChange}
              addressQuery={flow.addressQuery}
              setAddressQuery={flow.setAddressQuery}
              suggestions={flow.suggestions}
              isSearching={flow.isSearching}
              onSelectSuggestion={flow.handleSelectSuggestion}
              onClearLocation={flow.clearLocation}
              onSubmit={flow.handleNextFromStep1}
              onCancel={() => flow.router.back()}
            />
          )}

          {flow.currentStep === 2 && (
            <AddVenueStep2
              loading={flow.loading}
              errors={flow.errors}
              formData={flow.formData}
              setFormData={flow.setFormData}
              setErrors={flow.setErrors}
              venueId={flow.venueId}
              invalidateDraft={flow.invalidateDraft}
              samePriceForAll={flow.samePriceForAll}
              onToggleSamePriceMode={flow.toggleSamePriceMode}
              basePricePerHour={flow.basePricePerHour}
              onBasePriceChange={flow.handleBasePriceChange}
              onSportPriceChange={flow.handleSportPriceChange}
              handleInputChange={flow.handleInputChange}
              onBack={flow.handleBack}
              onContinue={flow.handleNextFromStep2}
            />
          )}

          {flow.currentStep === 3 && (
            <AddVenueStep3
              loading={flow.loading}
              venueId={flow.venueId}
              formData={flow.formData}
              onImagesReady={flow.handleImagesReady}
              onBack={flow.handleBack}
              onContinue={() => flow.setCurrentStep(4)}
            />
          )}

          {flow.currentStep === 4 && (
            <AddVenueStep4
              loading={flow.loading}
              onBack={flow.handleBack}
              onContinue={flow.handleContinueWithoutDocuments}
            />
          )}

          {flow.currentStep === 5 && (
            <AddVenueStep5
              loading={flow.loading}
              formData={flow.formData}
              samePriceForAll={flow.samePriceForAll}
              basePricePerHour={flow.basePricePerHour}
              onBack={flow.handleBack}
              onPublish={flow.handlePublish}
            />
          )}
        </div>
      </div>
    </div>
  );
}
