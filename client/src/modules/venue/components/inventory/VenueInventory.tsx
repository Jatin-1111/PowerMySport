"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { plural } from "@/modules/shared/utils/figures";
import { useVenueInventoryFlow } from "@/modules/venue/hooks/useVenueInventoryFlow";
import { Plus } from "lucide-react";
import { VenueFormFields } from "./VenueFormFields";
import { VenueImagesSection } from "./VenueImagesSection";
import { VenueRows } from "./VenueRows";

/**
 * The venue lister's venues: the list, and the add or edit form in its place.
 * The form replaces the list instead of opening on top of it, so there is one
 * thing to do at a time and Cancel always returns to the list.
 */
export function VenueInventory() {
  const flow = useVenueInventoryFlow();

  if (flow.loading) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        <span className="sr-only">Loading your venues</span>
        <div aria-hidden="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-56" />
        </div>
        <div aria-hidden="true" className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const editing = Boolean(flow.editingVenue);

  return (
    <div className="space-y-10 pb-10 sm:space-y-12">
      {flow.confirmDialog}

      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Venue console</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            {flow.showForm ? (editing ? "Edit venue" : "Add a venue") : "Venues"}
          </h1>
          {!flow.showForm && flow.venues.length > 0 && (
            <p className="text-ink-body mt-3">{plural(flow.venues.length, "venue")}</p>
          )}
        </div>
        {!flow.showForm && flow.canAddMoreVenues && flow.venues.length > 0 && (
          <Button onClick={() => flow.setShowForm(true)} className="min-h-11">
            <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
            Add a venue
          </Button>
        )}
      </header>

      {flow.showForm ? (
        <form onSubmit={flow.handleSubmit} className="max-w-3xl space-y-10">
          <VenueFormFields
            formData={flow.formData}
            setFormData={flow.setFormData}
            fieldErrors={flow.fieldErrors}
            setFieldErrors={flow.setFieldErrors}
            handleChange={flow.handleChange}
            handleSportsChange={flow.handleSportsChange}
            addressQuery={flow.addressQuery}
            suggestions={flow.suggestions}
            isSearching={flow.isSearching}
            searchError={flow.searchError}
            onAddressChange={flow.handleAddressChange}
            onSelectSuggestion={flow.handleSelectSuggestion}
            samePriceForAll={flow.samePriceForAll}
            onToggleSamePriceForAll={flow.handleToggleSamePriceForAll}
            basePricePerHour={flow.basePricePerHour}
            onBasePriceChange={flow.handleBasePriceChange}
            sportPricing={flow.sportPricing}
            onSportPriceChange={flow.handleSportPriceChange}
            selectedAmenities={flow.selectedAmenities}
            onToggleAmenity={flow.toggleAmenity}
          />

          <VenueImagesSection
            selectedImages={flow.selectedImages}
            existingImages={flow.existingImages}
            existingGeneralImages={flow.existingGeneralImages}
            existingSportImages={flow.existingSportImages}
            existingCoverPhotoUrl={flow.existingCoverPhotoUrl}
            coverPhotoIndex={flow.coverPhotoIndex}
            setCoverPhotoIndex={flow.setCoverPhotoIndex}
            isUploadingImages={flow.isUploadingImages}
            imageError={flow.imageError}
            onImageSelection={flow.handleImageSelection}
            onRemoveImage={flow.handleRemoveImage}
            onRemoveExistingImage={flow.removeExistingImage}
          />

          <div className="border-hairline flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6">
            <Button
              type="submit"
              disabled={flow.isSubmitting}
              loading={flow.isSubmitting}
              className="min-h-11"
            >
              {flow.isSubmitting ? "Saving" : editing ? "Save changes" : "Create venue"}
            </Button>
            <Button type="button" variant="ghost" onClick={flow.handleCancel} className="min-h-11">
              Cancel
            </Button>
          </div>
        </form>
      ) : flow.venues.length === 0 ? (
        <div className="border-hairline max-w-xl border-t pt-6">
          <p className="text-ink-body text-pretty">
            You have not added a venue yet. A venue appears to players once our team has approved
            it.
          </p>
          <div className="mt-5">
            {flow.canAddMoreVenues ? (
              <Button onClick={() => flow.setShowForm(true)} className="min-h-11">
                <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
                Add your first venue
              </Button>
            ) : (
              <p className="text-ink-body text-pretty">
                Your account is not yet open for new listings. Contact support to activate your
                first venue.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <VenueRows venues={flow.venues} onEdit={flow.handleEdit} onDelete={flow.handleDelete} />
          {!flow.canAddMoreVenues && (
            <p className="text-ink-body max-w-[60ch] text-pretty text-sm">
              Your account lists one venue. To add another, contact support.
            </p>
          )}
        </>
      )}
    </div>
  );
}
