import OnboardingSectionCard from "@/modules/onboarding/components/onboarding/OnboardingSectionCard";
import { formatSportLabel } from "@/modules/venue/utils/inventoryFlow";
import { Camera, X } from "lucide-react";

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

  return (
    <OnboardingSectionCard
      title="Venue Images"
      subtitle="Upload high-quality photos to showcase your venue"
    >
      <div className="space-y-6">
        {(selectedImages.length > 0 || existingImages.length > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>{selectedImages.length + existingImages.length} images</span>
              <span className="text-power-orange font-medium">
                {selectedImages.length + existingImages.length}/10
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="bg-power-orange h-full transition-all duration-300"
                style={{
                  width: `${((selectedImages.length + existingImages.length) / 10) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {hasExistingImages && (
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="bg-power-orange/10 text-power-orange rounded px-2 py-1 text-xs">
                Current
              </span>
              Current Images ({existingImages.length})
            </h3>

            {existingGeneralImages.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">
                  General Venue Images ({existingGeneralImages.length})
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {existingGeneralImages.map((url, index) => (
                    <div
                      key={`general-${url}-${index}`}
                      className="group/img relative overflow-hidden rounded-xl border border-slate-200"
                    >
                      <img
                        src={url}
                        alt={`General venue ${index + 1}`}
                        className="h-48 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveExistingImage(url)}
                        className="absolute left-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                        aria-label="Remove image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {existingCoverPhotoUrl === url && (
                        <span className="bg-power-orange absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.entries(existingSportImages).map(([sport, urls], sportIndex) =>
              urls.length > 0 ? (
                <div key={`${sport}-${sportIndex}`} className="mb-6 last:mb-0">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">
                    {formatSportLabel(sport)} Images ({urls.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {urls.map((url, index) => (
                      <div
                        key={`${sport}-${url}-${index}`}
                        className="relative overflow-hidden rounded-xl border border-slate-200"
                      >
                        <img
                          src={url}
                          alt={`${formatSportLabel(sport)} ${index + 1}`}
                          className="h-40 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveExistingImage(url)}
                          className="absolute left-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                          aria-label="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {existingCoverPhotoUrl === url && (
                          <span className="bg-power-orange absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                            Cover
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="bg-power-orange/10 text-power-orange rounded px-2 py-1 text-xs">
              Add More
            </span>
            Add More Images
          </h3>
          <label className="block cursor-pointer">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 transition-all hover:border-orange-300 hover:bg-orange-50/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                <Camera className="h-6 w-6 text-orange-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Click to upload images</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  JPG, PNG or WebP · up to 5 MB each · max 10 images
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onImageSelection(e.target.files)}
              className="hidden"
            />
          </label>
          {imageError && <p className="mt-2 text-sm text-red-500">{imageError}</p>}
        </div>

        {selectedImages.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              New Images Ready ({selectedImages.length})
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {selectedImages.map((image, index) => (
                <div
                  key={image.preview}
                  className="relative overflow-hidden rounded-xl border border-slate-200"
                >
                  <img
                    src={image.preview}
                    alt={`Selected ${index + 1}`}
                    className="h-48 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(index)}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {coverPhotoIndex === index && (
                    <span className="bg-power-orange absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white">
                      Cover
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="coverPhoto"
                        checked={coverPhotoIndex === index}
                        onChange={() => setCoverPhotoIndex(index)}
                        className="accent-power-orange h-3.5 w-3.5"
                      />
                      <span className="text-xs font-medium text-white">Set as cover</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isUploadingImages && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <div className="border-power-orange h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            Uploading images…
          </div>
        )}
      </div>
    </OnboardingSectionCard>
  );
}
