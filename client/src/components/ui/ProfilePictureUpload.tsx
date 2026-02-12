"use client";

import { authApi } from "@/modules/auth/services/auth";
import { User } from "@/types";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ProfilePictureUploadProps {
  currentPhotoUrl?: string;
  onUploadSuccess?: (user: User) => void;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-40 h-40",
};

export default function ProfilePictureUpload({
  currentPhotoUrl,
  onUploadSuccess,
  size = "lg",
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentPhotoUrl || null,
  );

  // Sync preview URL with prop changes
  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || null);
  }, [currentPhotoUrl]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // 1. Get presigned URL
      const urlResponse = await authApi.getProfilePictureUploadUrl(
        file.name,
        file.type,
      );

      if (!urlResponse.success || !urlResponse.data) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key } = urlResponse.data;

      // 2. Upload to S3
      await authApi.uploadProfilePictureToS3(file, uploadUrl, file.type);

      // 3. Confirm upload
      const confirmResponse = await authApi.confirmProfilePicture(
        downloadUrl,
        key,
      );

      if (!confirmResponse.success || !confirmResponse.data) {
        throw new Error("Failed to save profile picture");
      }

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(confirmResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setPreviewUrl(currentPhotoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Profile Picture Preview */}
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center`}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Profile"
              width={
                size === "xl"
                  ? 160
                  : size === "lg"
                    ? 128
                    : size === "md"
                      ? 96
                      : 64
              }
              height={
                size === "xl"
                  ? 160
                  : size === "lg"
                    ? 128
                    : size === "md"
                      ? 96
                      : 64
              }
              className="object-cover w-full h-full"
            />
          ) : (
            <svg
              className="w-1/2 h-1/2 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Upload Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition inline-block">
          {uploading ? "Uploading..." : "Change Photo"}
        </span>
      </label>

      {/* Error Message */}
      {error && (
        <p className="text-red-500 text-sm text-center max-w-xs">{error}</p>
      )}

      {/* Info Text */}
      <p className="text-gray-500 text-xs text-center max-w-xs">
        JPG, PNG or WebP. Max 5MB.
      </p>
    </div>
  );
}
