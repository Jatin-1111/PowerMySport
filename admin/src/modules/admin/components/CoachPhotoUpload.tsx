"use client";

import { toast } from "@/lib/toast";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { adminApi } from "@/modules/admin/services/admin";
import { Camera, Loader, Trash2 } from "lucide-react";
import { useState } from "react";

interface CoachPhotoUploadProps {
  onPhotoReady: (photoUrl: string | null, photoKey: string | null) => void;
  disabled?: boolean;
  currentPhotoUrl?: string;
}

export default function CoachPhotoUpload({
  onPhotoReady,
  disabled = false,
  currentPhotoUrl,
}: CoachPhotoUploadProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
  const [photoKey, setPhotoKey] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Get presigned URL from server
      const response = await adminApi.getCoachPhotoUploadUrl(file.name, file.type);

      if (!response.success || !response.data) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key } = response.data;

      // Upload to S3
      await uploadFileToPresignedUrl(file, uploadUrl, file.type);

      // Store photo info
      setPhotoUrl(downloadUrl);
      setPhotoKey(key);
      onPhotoReady(downloadUrl, key);

      toast.success("Profile photo uploaded successfully");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoKey("");
    onPhotoReady(null, null);
    setError("");
  };

  return (
    <div className="w-full">
      {photoUrl ? (
        <div className="relative mx-auto h-32 w-32">
          <img
            src={photoUrl}
            alt="Coach profile"
            className="h-full w-full rounded-lg border-2 border-green-300 object-cover"
          />
          <button
            type="button"
            onClick={handleRemovePhoto}
            disabled={disabled}
            className="absolute -top-2 -right-2 rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <label className="hover:border-power-orange hover:bg-power-orange/5 mx-auto flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 transition-all">
          {uploading ? (
            <Loader className="text-power-orange animate-spin" size={32} />
          ) : (
            <>
              <Camera className="mb-2 text-slate-400" size={32} />
              <span className="text-center text-xs text-slate-600">Upload Photo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
            className="hidden"
            disabled={disabled || uploading}
          />
        </label>
      )}

      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}

      <p className="mt-3 text-center text-xs text-slate-600">
        Square image recommended (min 200x200px, max 5MB)
      </p>
    </div>
  );
}
