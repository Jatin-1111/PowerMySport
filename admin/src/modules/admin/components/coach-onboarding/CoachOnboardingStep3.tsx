import {
  FormErrors,
  PricingMode,
  UploadedDocument,
  UploadedVenueImage,
} from "@/modules/admin/utils/coachOnboardingHelpers";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";
import { CoachVerificationDocument, ServiceMode } from "@/types";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { RefObject } from "react";

interface CoachOnboardingStep3Props {
  loading: boolean;
  creating: boolean;
  errors: FormErrors;

  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  profilePhotoUrl: string;

  sports: string[];
  pricingMode: PricingMode;
  serviceMode: ServiceMode;
  isOwnVenue: boolean;
  venueName: string;
  venueAddressQuery: string;

  verificationDocs: UploadedDocument[];
  setVerificationDocs: (updater: (prev: UploadedDocument[]) => UploadedDocument[]) => void;
  onDocumentSelect: (index: number, file: File | null) => void;
  onAddDocumentRow: () => void;
  onRemoveDocumentRow: (index: number) => void;

  venueImageDrafts: UploadedVenueImage[];
  venueImageInputRef: RefObject<HTMLInputElement | null>;
  onVenueImageSelect: (files: FileList | null) => void;
  onRemoveVenueImage: (index: number) => void;

  onBack: () => void;
  onSubmit: () => void;
}

export function CoachOnboardingStep3({
  loading,
  creating,
  errors,
  firstName,
  lastName,
  email,
  phone,
  bio,
  profilePhotoUrl,
  sports,
  pricingMode,
  serviceMode,
  isOwnVenue,
  venueName,
  venueAddressQuery,
  verificationDocs,
  setVerificationDocs,
  onDocumentSelect,
  onAddDocumentRow,
  onRemoveDocumentRow,
  venueImageDrafts,
  venueImageInputRef,
  onVenueImageSelect,
  onRemoveVenueImage,
  onBack,
  onSubmit,
}: CoachOnboardingStep3Props) {
  return (
    <div className="space-y-6">
      <OnboardingSectionCard
        title="Review & submit"
        subtitle="Check everything before creating the account and activating the coach."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Name:</span> {firstName} {lastName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span> {email}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Phone:</span> {phone}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Bio:</span> {bio}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Coaching setup
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Sports:</span>{" "}
                {sports.join(", ") || "None"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Pricing mode:</span> {pricingMode}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Service mode:</span> {serviceMode}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Profile photo:</span>{" "}
                {profilePhotoUrl ? "Uploaded" : "Missing"}
              </p>
            </div>
          </div>
        </div>

        {isOwnVenue ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Venue details
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Venue name:</span> {venueName}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Venue address:</span>{" "}
                {venueAddressQuery}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Venue images queued:</span>{" "}
                {venueImageDrafts.length}
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Verification documents
              </p>
              <p className="text-sm text-slate-600">
                Optional for admin-created coaches. Add documents only if you want them stored for
                review.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={onAddDocumentRow} disabled={loading}>
              <Plus size={14} /> Add document
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {verificationDocs.map((doc, index) => (
              <div
                key={`${index}-${doc.type}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Document type
                    </label>
                    <select
                      value={doc.type}
                      onChange={(event) =>
                        setVerificationDocs((prev) =>
                          prev.map((item, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...item,
                                  type: event.target.value as CoachVerificationDocument["type"],
                                }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      disabled={loading}
                    >
                      <option value="CERTIFICATION">Certification</option>
                      <option value="ID_PROOF">ID Proof</option>
                      <option value="ADDRESS_PROOF">Address Proof</option>
                      <option value="BACKGROUND_CHECK">Background Check</option>
                      <option value="INSURANCE">Insurance</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Uploaded file
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {doc.fileName || "No file selected"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <Upload size={14} /> Upload
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="hidden"
                        disabled={loading}
                        onChange={(event) =>
                          onDocumentSelect(index, event.target.files?.[0] || null)
                        }
                      />
                    </label>
                    {verificationDocs.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onRemoveDocumentRow(index)}
                        className="inline-flex items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        disabled={loading}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {errors.venueImages ? (
            <p className="mt-3 text-xs text-red-600">{errors.venueImages}</p>
          ) : null}
        </div>

        {isOwnVenue ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Venue images
                </p>
                <p className="text-sm text-slate-600">
                  Upload files now, then the final submit will create, attach, and activate the
                  coach.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => venueImageInputRef.current?.click()}
                disabled={loading}
              >
                <Upload size={14} /> Add images
              </button>
              <input
                ref={venueImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={loading}
                onChange={(event) => {
                  onVenueImageSelect(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venueImageDrafts.map((image, index) => (
                <div
                  key={`${image.fileName}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-100">
                    <Image
                      src={image.previewUrl}
                      alt={image.fileName}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-700">{image.fileName}</p>
                    <button
                      type="button"
                      onClick={() => onRemoveVenueImage(index)}
                      className="text-red-600"
                      disabled={loading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </OnboardingSectionCard>

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="button" variant="primary" onClick={onSubmit} disabled={loading || creating}>
          {creating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Creating coach account...
            </span>
          ) : (
            "Create, review, and activate coach"
          )}
        </Button>
      </div>
    </div>
  );
}
