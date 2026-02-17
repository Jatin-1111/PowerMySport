"use client";

import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { PresignedUrl } from "@/modules/onboarding/types/onboarding";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Camera,
  Target,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
} from "lucide-react";

interface UploadedImage {
  url: string;
  key: string;
  field: string;
}

interface Step2ImageUploadProps {
  venueId: string;
  presignedUrls: PresignedUrl[];
  onImagesConfirmed: (
    generalImages: string[],
    generalImageKeys: string[],
    sportImages: Record<string, string[]>,
    sportImageKeys: Record<string, string[]>,
    coverPhotoUrl: string,
    coverPhotoKey: string,
  ) => Promise<void>;
  loading?: boolean;
  error?: string;
  onSkip?: () => Promise<void>;
}

const isDev =
  typeof window !== "undefined" && process.env.NODE_ENV === "development";

export default function Step2ImageUpload({
  venueId,
  presignedUrls,
  onImagesConfirmed,
  loading,
  error,
  onSkip,
}: Step2ImageUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<
    Record<string, UploadedImage>
  >({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [coverPhotoIndex, setCoverPhotoIndex] = useState<number>(0); // Index in general images (0-2)

  // Categorize presigned URLs
  const categorizedUrls = useMemo(() => {
    const general: PresignedUrl[] = [];
    const sports: Record<string, PresignedUrl[]> = {};

    presignedUrls.forEach((url) => {
      if (url.field.startsWith("general_")) {
        general.push(url);
      } else if (url.field.startsWith("sport_")) {
        // Extract sport name from field: "sport_Cricket_0" -> "Cricket"
        const parts = url.field.split("_");
        const sport = parts.slice(1, -1).join("_"); // Handle sports with underscores
        if (!sports[sport]) {
          sports[sport] = [];
        }
        sports[sport].push(url);
      }
    });

    // Sort sports alphabetically
    const sortedSports = Object.keys(sports).sort();
    const sortedSportsMap: Record<string, PresignedUrl[]> = {};
    sortedSports.forEach((sport) => {
      sortedSportsMap[sport] = sports[sport];
    });

    return { general, sports: sortedSportsMap };
  }, [presignedUrls]);

  const handleImageSelect = async (
    file: File,
    fieldName: string,
    presignedUrl: PresignedUrl,
  ) => {
    if (!file.type.startsWith("image/")) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Please select an image file",
      }));
      return;
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Image must be less than 5MB",
      }));
      return;
    }

    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    setUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));

    try {
      // Upload to S3
      await uploadFileToPresignedUrl(
        file,
        presignedUrl.uploadUrl,
        presignedUrl.contentType,
      );

      // Store uploaded image info
      setUploadedImages((prev) => ({
        ...prev,
        [fieldName]: {
          url: presignedUrl.downloadUrl,
          key: presignedUrl.key || "",
          field: fieldName,
        },
      }));
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]:
          err instanceof Error ? err.message : "Failed to upload image",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleRemoveImage = (fieldName: string) => {
    setUploadedImages((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
    setUploadErrors((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const handleSubmit = async () => {
    // Validate: All general images must be uploaded
    const generalUploaded = categorizedUrls.general.filter(
      (url) => uploadedImages[url.field],
    );
    if (generalUploaded.length !== 3) {
      alert("Please upload all 3 general venue images");
      return;
    }

    // Validate: All sport images must be uploaded
    for (const [sport, urls] of Object.entries(categorizedUrls.sports)) {
      const sportUploaded = urls.filter((url) => uploadedImages[url.field]);
      if (sportUploaded.length !== 5) {
        alert(`Please upload all 5 images for ${sport}`);
        return;
      }
    }

    // Build categorized image arrays
    const generalImages: string[] = [];
    const generalImageKeys: string[] = [];

    categorizedUrls.general.forEach((url) => {
      const uploaded = uploadedImages[url.field];
      if (uploaded) {
        generalImages.push(uploaded.url);
        generalImageKeys.push(uploaded.key);
      }
    });

    const sportImages: Record<string, string[]> = {};
    const sportImageKeys: Record<string, string[]> = {};

    Object.entries(categorizedUrls.sports).forEach(([sport, urls]) => {
      sportImages[sport] = [];
      sportImageKeys[sport] = [];

      urls.forEach((url) => {
        const uploaded = uploadedImages[url.field];
        if (uploaded) {
          sportImages[sport].push(uploaded.url);
          sportImageKeys[sport].push(uploaded.key);
        }
      });
    });

    // Cover photo must be from general images
    const coverPhotoUrl = generalImages[coverPhotoIndex];
    const coverPhotoKey = generalImageKeys[coverPhotoIndex];

    await onImagesConfirmed(
      generalImages,
      generalImageKeys,
      sportImages,
      sportImageKeys,
      coverPhotoUrl,
      coverPhotoKey,
    );
  };

  const totalRequired = 3 + Object.keys(categorizedUrls.sports).length * 5;
  const totalUploaded = Object.keys(uploadedImages).length;
  const isComplete = totalUploaded === totalRequired;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Upload Venue Images
      </h2>
      <p className="text-gray-600 mb-6">
        Upload {totalRequired} images: 3 general venue images + 5 images per
        sport
      </p>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            {totalUploaded} of {totalRequired} images uploaded
          </span>
          <span>{Math.round((totalUploaded / totalRequired) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(totalUploaded / totalRequired) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* General Venue Images Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
            Required
          </span>
          General Venue Images (3)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload overall facility shots. Select one as your cover photo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categorizedUrls.general.map((presignedUrl, index) => {
            const uploaded = uploadedImages[presignedUrl.field];
            const isUploading = uploading[presignedUrl.field];
            const uploadError = uploadErrors[presignedUrl.field];

            return (
              <div
                key={presignedUrl.field}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition"
              >
                {uploaded ? (
                  <div className="relative">
                    <img
                      src={uploaded.url}
                      alt={`General image ${index + 1}`}
                      className="w-full h-48 object-cover rounded"
                    />
                    <button
                      onClick={() => handleRemoveImage(presignedUrl.field)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Cover Photo Selection */}
                    <div className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="coverPhoto"
                          checked={coverPhotoIndex === index}
                          onChange={() => setCoverPhotoIndex(index)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">
                          Set as cover photo
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="cursor-pointer block">
                      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        {isUploading ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm">Uploading...</p>
                          </div>
                        ) : (
                          <>
                            <Camera className="w-12 h-12 mb-3 text-gray-400" />
                            <p className="text-sm font-medium">
                              Click to upload image {index + 1}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              JPG, PNG up to 10MB
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageSelect(
                              file,
                              presignedUrl.field,
                              presignedUrl,
                            );
                          }
                        }}
                        disabled={isUploading}
                      />
                    </label>
                    {uploadError && (
                      <p className="text-red-500 text-sm mt-2">{uploadError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sport-Specific Images Sections */}
      {Object.entries(categorizedUrls.sports).map(([sport, urls]) => {
        const sportUploaded = urls.filter(
          (url) => uploadedImages[url.field],
        ).length;

        return (
          <div key={sport} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                Required
              </span>
              {sport} Images ({sportUploaded}/5)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload 5 images showcasing your {sport} facilities
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {urls.map((presignedUrl, index) => {
                const uploaded = uploadedImages[presignedUrl.field];
                const isUploading = uploading[presignedUrl.field];
                const uploadError = uploadErrors[presignedUrl.field];

                return (
                  <div
                    key={presignedUrl.field}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-2 hover:border-green-400 transition"
                  >
                    {uploaded ? (
                      <div className="relative">
                        <img
                          src={uploaded.url}
                          alt={`${sport} image ${index + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                        <button
                          onClick={() => handleRemoveImage(presignedUrl.field)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 text-xs transition-colors"
                          aria-label="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="cursor-pointer block">
                          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                            {isUploading ? (
                              <>
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                <p className="mt-1 text-xs">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                <p className="text-xs">Image {index + 1}</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageSelect(
                                  file,
                                  presignedUrl.field,
                                  presignedUrl,
                                );
                              }
                            }}
                            disabled={isUploading}
                          />
                        </label>
                        {uploadError && (
                          <p className="text-red-500 text-xs mt-1">
                            {uploadError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={handleSubmit}
          disabled={!isComplete || loading}
          className={`flex-1 py-3 rounded-lg font-medium transition ${
            isComplete && !loading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {loading ? "Processing..." : "Continue"}
        </button>

        {isDev && onSkip && (
          <button
            onClick={onSkip}
            disabled={loading}
            className="px-6 py-3 bg-yellow-100 text-yellow-700 font-medium rounded-lg hover:bg-yellow-200 disabled:opacity-50"
          >
            Skip (Dev)
          </button>
        )}
      </div>

      {/* Help Text */}
      <p className="text-sm text-gray-500 mt-4 text-center">
        Tip: Use high-quality images that showcase your facilities well. The
        cover photo will be displayed prominently on your venue listing.
      </p>
    </div>
  );
}
