"use client";

import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { VenueCard, VenueSkeleton } from "@/modules/venue/components/inventory/VenueCard";
import { VenueFormFields } from "@/modules/venue/components/inventory/VenueFormFields";
import { VenueImagesSection } from "@/modules/venue/components/inventory/VenueImagesSection";
import { VenueStatsBar } from "@/modules/venue/components/inventory/VenueStatsBar";
import { useVenueInventoryFlow } from "@/modules/venue/hooks/useVenueInventoryFlow";
import { AlertCircle, Building2, Plus } from "lucide-react";
import Link from "next/link";

export default function VenueInventoryPage() {
  const flow = useVenueInventoryFlow();

  if (flow.loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8">
          <div className="mb-4 h-4 w-24 rounded-full bg-slate-100" />
          <div className="mb-3 h-8 w-52 rounded-full bg-slate-100" />
          <div className="h-4 w-80 rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-100 bg-white p-4"
            />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <VenueSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page header ── */}
      <SlideUp delay={0}>
        <PlayerPageHeader
          badge="Venue Lister"
          title="My Venues"
          subtitle="Manage listings, pricing, and availability for every venue you host."
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/venue-lister/vendor-bookings">
                <Button variant="secondary" size="sm">
                  View Bookings
                </Button>
              </Link>
              {!flow.showForm && flow.canAddMoreVenues && (
                <Button
                  onClick={() => flow.setShowForm(true)}
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add Venue
                </Button>
              )}
            </div>
          }
        />
      </SlideUp>

      {/* ── Restriction banner ── */}
      {!flow.canAddMoreVenues && !flow.showForm && (
        <SlideUp delay={0.05}>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Single venue mode</p>
              <p className="mt-0.5 text-sm text-amber-700">
                You can manage your approved venue below. To list additional venues, contact our
                support team.
              </p>
            </div>
          </div>
        </SlideUp>
      )}

      {/* ── Stats bar ── */}
      {flow.venues.length > 0 && !flow.showForm && (
        <SlideUp delay={0.08}>
          <VenueStatsBar
            totalVenues={flow.venues.length}
            totalSports={flow.totalSports}
            venuesWithPhotos={flow.venuesWithPhotos}
            avgRating={flow.avgRating}
          />
        </SlideUp>
      )}

      {/* ── Add/Edit Form ── */}
      {flow.showForm && (
        <SlideUp delay={0.05}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Building2 className="text-power-orange h-6 w-6" />
              </div>
              <h2 className="mb-1 text-2xl font-bold text-slate-900">
                {flow.editingVenue ? "Edit Venue" : "Create New Venue"}
              </h2>
              <p className="text-sm text-slate-500">
                {flow.editingVenue
                  ? "Update your venue details and information"
                  : "Add your venue to the platform"}
              </p>
            </div>

            <form onSubmit={flow.handleSubmit} className="space-y-6">
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

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={flow.isSubmitting}
                  loading={flow.isSubmitting}
                  variant="primary"
                  className="flex-1"
                >
                  {flow.isSubmitting
                    ? "Saving…"
                    : flow.editingVenue
                      ? "Update Venue"
                      : "Create Venue"}
                </Button>
                <Button
                  type="button"
                  onClick={flow.handleCancel}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </SlideUp>
      )}

      {/* ── Venues list / empty state ── */}
      {!flow.showForm && (
        <>
          {flow.venues.length === 0 ? (
            <SlideUp delay={0.1}>
              <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-slate-100 bg-white px-8 py-16 text-center shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                  <Building2 className="h-8 w-8 text-orange-400" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-slate-900">No venues yet</h3>
                  <p className="max-w-xs text-sm text-slate-500">
                    Add your first venue to start receiving bookings and generating revenue.
                  </p>
                </div>
                {flow.canAddMoreVenues && (
                  <Button
                    onClick={() => flow.setShowForm(true)}
                    variant="primary"
                    size="md"
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add Your First Venue
                  </Button>
                )}
                {!flow.canAddMoreVenues && (
                  <p className="text-xs text-slate-400">
                    Contact support to activate your first venue listing.
                  </p>
                )}
              </div>
            </SlideUp>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {flow.venues.map((venue, index) => (
                <VenueCard
                  key={venue.id || venue._id || index}
                  venue={venue}
                  onEdit={flow.handleEdit}
                  onDelete={flow.handleDelete}
                  index={index}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
