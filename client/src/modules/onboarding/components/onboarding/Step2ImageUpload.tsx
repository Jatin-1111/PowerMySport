"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  PresignedUrl,
  UploadedImage,
} from "@/modules/onboarding/types/onboarding";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";

interface Step2ImageUploadProps {
  venueId: string;
  presignedUrls: PresignedUrl[];
  onImagesConfirmed: (images: string[], coverPhotoUrl: string) => Promise<void>;
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
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [coverPhotoIndex, setCoverPhotoIndex] = useState<number>(0);

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

    if (file.size > 5 * 1024 * 1024) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Image must be smaller than 5MB",
      }));
      return;
    }

    setUploading((prev) => ({ ...prev, [fieldName]: true }));

    try {
      // Upload directly to S3 via presigned URL
      await uploadFileToPresignedUrl(
        file,
        presignedUrl.uploadUrl,
        presignedUrl.contentType,
      );

      // Create preview
      const preview = URL.createObjectURL(file);
      const imageIndex = parseInt(fieldName.split("_")[1]);

      // Store uploaded image with S3 URL
      setUploadedImages((prev) => [
        ...prev.filter((img) => img.data.name !== file.name),
        {
          data: file,
          preview,
          isCover: imageIndex === coverPhotoIndex,
        },
      ]);

      setUploadErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadedImages.length < 5) {
      alert(
        `Please upload at least 5 images (current: ${uploadedImages.length})`,
      );
      return;
    }

    try {
      // Get S3 URLs from presigned upload URLs
      const imageUrls = presignedUrls
        .filter((url) => url.field.startsWith("image_"))
        .map((url) => url.downloadUrl);

      const coverPhotoUrl =
        presignedUrls[coverPhotoIndex]?.downloadUrl || imageUrls[0];

      await onImagesConfirmed(imageUrls, coverPhotoUrl);
    } catch (err) {
      console.error("Failed to confirm images:", err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add Venue Images</h1>
        <p className="text-gray-600 mt-2">
          Step 2 of 3: Upload {presignedUrls.length} high-quality images (JPG,
          PNG, WebP)
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-700">
            Each image should be clear and show different aspects of your venue.
            Max 5MB per image.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {presignedUrls.map((presigned, index) => (
            <div
              key={presigned.field}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition"
            >
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      handleImageSelect(file, presigned.field, presigned);
                  }}
                  disabled={uploading[presigned.field]}
                  className="hidden"
                />

                {uploadedImages.find((img) => img.preview) &&
                index < uploadedImages.length ? (
                  <div className="relative">
                    <Image
                      src={uploadedImages[index]?.preview}
                      alt={`Image ${index + 1}`}
                      width={200}
                      height={200}
                      className="w-full h-40 object-cover rounded"
                    />
                    {index === coverPhotoIndex && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded text-xs font-bold">
                        COVER
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-40 flex flex-col items-center justify-center bg-gray-50 rounded">
                    {uploading[presigned.field] ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <p className="text-sm text-gray-600 mt-2">
                          Uploading...
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-sm text-gray-600 mt-2">
                          Click to upload image
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Max 5MB</p>
                      </>
                    )}
                  </div>
                )}
              </label>

              {uploadErrors[presigned.field] && (
                <p className="text-red-500 text-xs mt-2">
                  {uploadErrors[presigned.field]}
                </p>
              )}

              {/* Set as Cover Button */}
              {uploadedImages.find((img) => img.preview) &&
                index < uploadedImages.length && (
                  <button
                    type="button"
                    onClick={() => setCoverPhotoIndex(index)}
                    className={`w-full mt-2 px-3 py-2 text-sm rounded transition ${
                      index === coverPhotoIndex
                        ? "bg-yellow-400 text-yellow-900 font-bold"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {index === coverPhotoIndex
                      ? "? Cover Photo"
                      : "Set as Cover"}
                  </button>
                )}
            </div>
          ))}
        </div>

        {/* Upload Progress */}
        {Object.values(uploading).some((v) => v) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">
              Uploading images... This may take a few moments.
            </p>
          </div>
        )}

        {/* Uploaded Count */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-700">
            Images uploaded:{" "}
            <span className="font-bold">{uploadedImages.length}</span> /
            <span> {presignedUrls.length}</span>
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: `${(uploadedImages.length / presignedUrls.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || uploadedImages.length < 5}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading
            ? "Confirming Images..."
            : "Continue to Step 3: Upload Documents"}
        </button>
        {isDev && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="w-full py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Skip (Dev)
          </button>
        )}
      </form>
    </div>
  );
}
