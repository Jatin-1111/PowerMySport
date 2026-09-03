"use client";

import { toast } from "@/lib/toast";
import { authApi } from "../../auth/services/auth";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);

  // Sync preview URL with prop changes
  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || null);
  }, [currentPhotoUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // 1. Get presigned URL
      const urlResponse = await authApi.getProfilePictureUploadUrl(file.name, file.type);

      if (!urlResponse.success || !urlResponse.data) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key } = urlResponse.data;

      // 2. Upload to S3
      await authApi.uploadProfilePictureToS3(file, uploadUrl, file.type);

      // 3. Confirm upload
      const confirmResponse = await authApi.confirmProfilePicture(downloadUrl, key);

      if (!confirmResponse.success || !confirmResponse.data) {
        throw new Error("Failed to save profile picture");
      }

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(confirmResponse.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
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
          className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden rounded-full border-4 border-slate-200 bg-slate-100`}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Profile"
              width={size === "xl" ? 160 : size === "lg" ? 128 : size === "md" ? 96 : 64}
              height={size === "xl" ? 160 : size === "lg" ? 128 : size === "md" ? 96 : 64}
              className="h-full w-full object-cover"
            />
          ) : (
            <svg className="h-1/2 w-1/2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
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
          <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center rounded-full bg-black">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
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
        <span className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {uploading ? "Uploading..." : "Change Photo"}
        </span>
      </label>

      {/* Info Text */}
      <p className="max-w-xs text-center text-xs text-slate-500">JPG, PNG or WebP. Max 5MB.</p>
    </div>
  );
}
