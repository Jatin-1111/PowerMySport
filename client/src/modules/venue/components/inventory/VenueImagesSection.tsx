import { ProfileSection } from "@/modules/shared/components/settings/ProfileSection";
import { formatSportLabel } from "@/modules/venue/utils/inventoryFlow";
import { Camera, X } from "lucide-react";
import type { ReactNode } from "react";

interface VenueImagesSectionProps {
  selectedImages: Array<{ file: File; preview: string }>;
  existingImages: string[];
  existingGeneralImages: string[];
  existingSportImages: Record<string, string[]>;
  existingCoverPhotoUrl: string;
  coverPhotoIndex: number;
  setCoverPhotoIndex: (index: number) => void;
  isUploadingImages: boolean;
  imageError: string;
  onImageSelection: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onRemoveExistingImage: (url: string) => void;
}

const MAX_IMAGES = 10;

/** One photo with its remove button, a cover tag and an optional footer. */
function Tile({
  src,
  alt,
  isCover,
  onRemove,
  removeLabel,
  tall,
  children,
}: {
  src: string;
  alt: string;
  isCover: boolean;
  onRemove: () => void;
  removeLabel: string;
  tall?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="border-hairline relative overflow-hidden rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`w-full object-cover ${tall ? "h-48" : "h-40"}`} />
      <button
        type="button"
        onClick={onRemove}
        className="bg-paper text-ink hover:bg-paper-deep focus-visible:ring-ink absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
        aria-label={removeLabel}
      >
        <X size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {isCover && (
        <span className="bg-ink text-paper absolute left-2 top-2 rounded-sm px-2 py-1 text-sm font-medium">
          Cover
        </span>
      )}
      {children}
    </div>
  );
}

/** Photos of the venue: what is saved, then what is about to be added. */
export function VenueImagesSection({
  selectedImages,
  existingImages,
  existingGeneralImages,
  existingSportImages,
  existingCoverPhotoUrl,
  coverPhotoIndex,
  setCoverPhotoIndex,
  isUploadingImages,
  imageError,
  onImageSelection,
  onRemoveImage,
  onRemoveExistingImage,
}: VenueImagesSectionProps) {
  const hasExistingSportImages = Object.values(existingSportImages).some((urls) => urls.length > 0);
  const hasExistingImages = existingGeneralImages.length > 0 || hasExistingSportImages;
  const total = selectedImages.length + existingImages.length;

  return (
    <ProfileSection
      id="photos"
      title="Photos"
      description="Clear, bright photos get more bookings. The cover photo is the first one players see."
    >
      <div className="space-y-8">
        {total > 0 && (
          <p className="text-ink-body text-sm tabular-nums">
            {total} of {MAX_IMAGES} photos
          </p>
        )}

        {hasExistingImages && (
          <div className="space-y-6">
            {existingGeneralImages.length > 0 && (
              <div>
                <h3 className="text-ink mb-3 text-sm font-medium">
                  Venue photos ({existingGeneralImages.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {existingGeneralImages.map((url, index) => (
                    <Tile
                      key={`general-${url}-${index}`}
                      src={url}
                      alt={`Venue photo ${index + 1}`}
                      isCover={existingCoverPhotoUrl === url}
                      onRemove={() => onRemoveExistingImage(url)}
                      removeLabel={`Remove venue photo ${index + 1}`}
                      tall
                    />
                  ))}
                </div>
              </div>
            )}

            {Object.entries(existingSportImages).map(([sport, urls]) =>
              urls.length > 0 ? (
                <div key={sport}>
                  <h3 className="text-ink mb-3 text-sm font-medium">
                    {formatSportLabel(sport)} ({urls.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {urls.map((url, index) => (
                      <Tile
                        key={`${sport}-${url}-${index}`}
                        src={url}
                        alt={`${formatSportLabel(sport)} photo ${index + 1}`}
                        isCover={existingCoverPhotoUrl === url}
                        onRemove={() => onRemoveExistingImage(url)}
                        removeLabel={`Remove ${formatSportLabel(sport)} photo ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        <div>
          <label className="border-ink/25 hover:border-ink focus-within:ring-ink flex min-h-11 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-center transition-colors focus-within:ring-2">
            <Camera size={24} strokeWidth={1.5} className="text-ink" aria-hidden="true" />
            <span className="text-ink text-sm font-medium">Choose photos to add</span>
            <span className="text-ink-body text-sm">
              JPG, PNG or WebP, up to 5 MB each, {MAX_IMAGES} in total
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onImageSelection(e.target.files)}
              className="sr-only"
            />
          </label>
          {imageError && (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {imageError}
            </p>
          )}
        </div>

        {selectedImages.length > 0 && (
          <div>
            <h3 className="text-ink mb-3 text-sm font-medium">
              Ready to upload ({selectedImages.length})
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {selectedImages.map((image, index) => (
                <Tile
                  key={image.preview}
                  src={image.preview}
                  alt={`New photo ${index + 1}`}
                  isCover={coverPhotoIndex === index}
                  onRemove={() => onRemoveImage(index)}
                  removeLabel={`Remove new photo ${index + 1}`}
                  tall
                >
                  <label className="bg-paper border-hairline absolute inset-x-0 bottom-0 flex min-h-11 cursor-pointer items-center gap-2 border-t px-3">
                    <input
                      type="radio"
                      name="coverPhoto"
                      checked={coverPhotoIndex === index}
                      onChange={() => setCoverPhotoIndex(index)}
                      className="accent-ink h-4 w-4"
                    />
                    <span className="text-ink text-sm">Use as cover photo</span>
                  </label>
                </Tile>
              ))}
            </div>
          </div>
        )}

        {isUploadingImages && (
          <p role="status" className="text-ink-body text-sm">
            Uploading photos
          </p>
        )}
      </div>
    </ProfileSection>
  );
}
