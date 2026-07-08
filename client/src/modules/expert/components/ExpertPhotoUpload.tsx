"use client";

import { authApi } from "@/modules/auth/services/auth";
import { Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExpertPhotoUploadProps {
  currentPhotoUrl?: string;
  /** Fires once the file is uploaded to storage — the parent persists it via its own save action. */
  onPhotoReady: (photoUrl: string, photoKey: string) => void;
  size?: "lg" | "xl";
}

const SIZE_CLASSES: Record<"lg" | "xl", string> = {
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

/**
 * A dedicated expert-profile-photo uploader, distinct from the generic
 * <ProfilePictureUpload> used for the account-level User.photoUrl elsewhere —
 * Expert.photoUrl/photoKey are their own fields on the Expert document, so
 * this deliberately stops after the S3 upload and hands (url, key) back to
 * the caller instead of calling authApi.confirmProfilePicture (which would
 * overwrite the wrong record).
 */
export function ExpertPhotoUpload({
  currentPhotoUrl,
  onPhotoReady,
  size = "xl",
}: ExpertPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    currentPhotoUrl,
  );

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const urlRes = await authApi.getProfilePictureUploadUrl(
        file.name,
        file.type,
      );
      if (!urlRes.success || !urlRes.data) {
        throw new Error("Failed to get an upload URL.");
      }
      const { uploadUrl, downloadUrl, key } = urlRes.data;
      await authApi.uploadProfilePictureToS3(file, uploadUrl, file.type);
      setPreviewUrl(downloadUrl);
      onPhotoReady(downloadUrl, key);
      toast.success("Photo uploaded — click Save changes to apply it.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo.",
      );
      setPreviewUrl(currentPhotoUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <label
        className={`group relative flex ${SIZE_CLASSES[size]} cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-200`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-slate-300">
            <Camera className="h-8 w-8" />
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) =>
            e.target.files?.[0] && handleFileSelect(e.target.files[0])
          }
        />
      </label>
    </div>
  );
}
