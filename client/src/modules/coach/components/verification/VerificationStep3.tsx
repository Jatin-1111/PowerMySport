import { Button } from "@/modules/shared/ui/Button";
import { CoachVerificationDocument, ServiceMode } from "@/types";
import { Upload } from "lucide-react";
import { RefObject } from "react";

interface VerificationStep3Props {
  serviceMode: ServiceMode;
  venueImages: string[];
  isLockedByReview: boolean;
  isUploadingVenueImage: boolean;
  isDraggingVenueImages: boolean;
  setIsDraggingVenueImages: (value: boolean) => void;
  onVenueImageDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  venueImageInputRef: RefObject<HTMLInputElement | null>;
  onVenueImageFile: (file?: File) => void;
  onRemoveVenueImage: (index: number) => void;

  verificationDocs: CoachVerificationDocument[];
  setVerificationDocs: (
    updater: (prev: CoachVerificationDocument[]) => CoachVerificationDocument[]
  ) => void;
  uploadingDocIndex: number | null;
  onUploadDocument: (index: number, file: File) => void;

  saving: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export function VerificationStep3({
  serviceMode,
  venueImages,
  isLockedByReview,
  isUploadingVenueImage,
  isDraggingVenueImages,
  setIsDraggingVenueImages,
  onVenueImageDrop,
  venueImageInputRef,
  onVenueImageFile,
  onRemoveVenueImage,
  verificationDocs,
  setVerificationDocs,
  uploadingDocIndex,
  onUploadDocument,
  saving,
  onBack,
  onSubmit,
}: VerificationStep3Props) {
  return (
    <div className="space-y-5">
      {serviceMode === "OWN_VENUE" && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-900">
              Venue Images (Required for OWN_VENUE)
            </p>
            <span className="text-xs text-slate-500">{venueImages.length} uploaded (min 3)</span>
          </div>

          <div
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!isLockedByReview && !isUploadingVenueImage) {
                setIsDraggingVenueImages(true);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDraggingVenueImages(false);
            }}
            onDrop={onVenueImageDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDraggingVenueImages
                ? "border-power-orange bg-power-orange/5"
                : "border-slate-300 bg-slate-50/60"
            }`}
          >
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
              <Upload size={18} className="text-power-orange" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Drag & drop venue images here</p>
            <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP • Max 5MB per image</p>
            <button
              type="button"
              onClick={() => venueImageInputRef.current?.click()}
              disabled={isLockedByReview || isUploadingVenueImage}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isUploadingVenueImage ? "Uploading..." : "Browse Images"}
            </button>
            <input
              ref={venueImageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              disabled={isLockedByReview || isUploadingVenueImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                onVenueImageFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>

          {!!venueImages.length && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {venueImages.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="aspect-4/3 bg-slate-100">
                    <img
                      src={imageUrl}
                      alt={`Venue image ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-slate-600">
                      Venue Image {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      onClick={() => onRemoveVenueImage(index)}
                      disabled={isLockedByReview || isUploadingVenueImage}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Verification Documents (Optional)</p>
          <Button
            type="button"
            variant="secondary"
            disabled={isLockedByReview || uploadingDocIndex !== null}
            onClick={() =>
              setVerificationDocs((prev) => [
                ...prev,
                { type: "CERTIFICATION", url: "", fileName: "" },
              ])
            }
            className="w-full sm:w-auto"
          >
            Add Document
          </Button>
        </div>

        {verificationDocs.map((doc, index) => (
          <div key={`${doc.fileName}-${index}`} className="rounded-lg border border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Document Type
                  </label>
                  <select
                    value={doc.type}
                    disabled={isLockedByReview || uploadingDocIndex !== null}
                    onChange={(event) =>
                      setVerificationDocs((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                type: event.target.value as CoachVerificationDocument["type"],
                              }
                            : item
                        )
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Uploaded File
                  </label>
                  <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {doc.fileName || "No file uploaded"}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:flex">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">
                  <Upload size={14} />
                  {uploadingDocIndex === index ? "Uploading..." : "Upload"}
                  <input
                    type="file"
                    disabled={isLockedByReview || uploadingDocIndex === index}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        onUploadDocument(index, file);
                      }
                    }}
                  />
                </label>

                {verificationDocs.length > 1 && !isLockedByReview && (
                  <button
                    type="button"
                    disabled={uploadingDocIndex !== null}
                    onClick={() =>
                      setVerificationDocs((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <Button type="button" variant="secondary" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={
            saving || isLockedByReview || uploadingDocIndex !== null || isUploadingVenueImage
          }
          onClick={onSubmit}
          className="w-full sm:w-auto"
        >
          {saving ? "Submitting..." : "Submit for Verification"}
        </Button>
      </div>
    </div>
  );
}
