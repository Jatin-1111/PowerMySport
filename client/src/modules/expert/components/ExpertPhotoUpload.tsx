"use client";

import { authApi } from "@/modules/auth/services/auth";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { Camera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExpertPhotoUploadProps {
  currentPhotoUrl?: string;
  /** Fires once the file is uploaded to storage — the parent persists it via its own save action. */
  onPhotoReady: (photoUrl: string, photoKey: string) => void;
  size?: "lg" | "xl";
}

const SIZE_CLASSES: Record<"lg" | "xl", string> = {
  lg: "h-28 w-24",
  xl: "h-36 w-28",
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
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentPhotoUrl);

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
      const urlRes = await authApi.getProfilePictureUploadUrl(file.name, file.type);
      if (!urlRes.success || !urlRes.data) {
        throw new Error("Failed to get an upload URL.");
      }
      const { uploadUrl, downloadUrl, key } = urlRes.data;
      await authApi.uploadProfilePictureToS3(file, uploadUrl, file.type);
      setPreviewUrl(downloadUrl);
      onPhotoReady(downloadUrl, key);
      toast.success("Photo uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.");
      setPreviewUrl(currentPhotoUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="shrink-0">
      <div
        className={`bg-paper-deep flex ${SIZE_CLASSES[size]} items-center justify-center overflow-hidden rounded-md`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Your profile photo" className="h-full w-full object-cover" />
        ) : (
          <Camera size={28} strokeWidth={1.5} className="text-ink-ash" aria-hidden="true" />
        )}
      </div>
      {/* sr-only (not `hidden`): keeps the input focusable so keyboard users can
          Tab to it and press Enter or Space to open the picker; the label shows
          the focus ring via focus-within. The action is always visible text, not
          a hover overlay. */}
      <label
        className={`${TEXT_LINK} focus-within:ring-ink ring-offset-paper mt-1 min-h-11 cursor-pointer text-sm focus-within:ring-2 focus-within:ring-offset-2`}
      >
        {uploading ? "Uploading" : previewUrl ? "Change photo" : "Add a photo"}
        <input
          type="file"
          accept="image/*"
          aria-label="Upload profile photo"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
      </label>
    </div>
  );
}
