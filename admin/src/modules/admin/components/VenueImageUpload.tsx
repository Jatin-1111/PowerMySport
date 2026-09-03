"use client";

import { toast } from "@/lib/toast";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { Camera, Loader, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

interface UploadedImage {
  url: string;
  key: string;
  field: string;
}

interface VenueImageUploadProps {
  venueId: string;
  sports: string[];
  onImagesReady: (images: {
    generalImages: string[];
    generalImageKeys: string[];
    sportImages: Record<string, string[]>;
    sportImageKeys: Record<string, string[]>;
    coverPhotoUrl: string;
    coverPhotoKey: string;
  }) => void;
  disabled?: boolean;
}

export default function VenueImageUpload({
  venueId,
  sports,
  onImagesReady,
  disabled = false,
}: VenueImageUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadedImage>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [presignedUrls, setPresignedUrls] = useState<any[]>([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0);

  // Fetch presigned URLs on mount
  useEffect(() => {
    if (!venueId || sports.length === 0) return;

    const fetchUrls = async () => {
      setLoadingUrls(true);
      try {
        const response = await onboardingApi.getImageUploadUrls(venueId, sports);
        if (response.success && response.data) {
          setPresignedUrls(response.data.uploadUrls);
        }
      } catch (err) {
        toast.error("Failed to load image upload URLs");
      } finally {
        setLoadingUrls(false);
      }
    };

    fetchUrls();
  }, [venueId, sports]);

  const handleImageSelect = async (file: File, fieldName: string) => {
    if (!file.type.startsWith("image/")) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Please select an image file",
      }));
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Image must be less than 5MB",
      }));
      return;
    }

    const presignedUrl = presignedUrls.find((u: any) => u.field === fieldName);
    if (!presignedUrl) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Upload URL not available",
      }));
      return;
    }

    setUploading((prev) => ({ ...prev, [fieldName]: true }));
    setUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));

    try {
      await uploadFileToPresignedUrl(file, presignedUrl.uploadUrl, presignedUrl.contentType);
      setUploadedImages((prev) => ({
        ...prev,
        [fieldName]: {
          url: presignedUrl.downloadUrl,
          key: presignedUrl.s3Key || "",
          field: fieldName,
        },
      }));
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: err instanceof Error ? err.message : "Upload failed",
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
  };

  const handleConfirmImages = async () => {
    const generalImages = presignedUrls
      .filter((u: any) => u.field.startsWith("general_"))
      .filter((u: any) => uploadedImages[u.field]);

    if (generalImages.length !== 3) {
      toast.error("All 3 general images are required");
      return;
    }

    const generalUrls = generalImages.map((u: any) => uploadedImages[u.field].url);
    const generalKeys = generalImages.map((u: any) => uploadedImages[u.field].key);

    const sportImages: Record<string, string[]> = {};
    const sportImageKeys: Record<string, string[]> = {};

    for (const sport of sports) {
      const sportUrls = presignedUrls.filter((u: any) => u.field.startsWith(`sport_${sport}_`));
      const uploadedCount = sportUrls.filter((u: any) => uploadedImages[u.field]).length;

      if (uploadedCount !== 5) {
        toast.error(`All 5 images required for ${sport}`);
        return;
      }

      sportImages[sport] = sportUrls
        .filter((u: any) => uploadedImages[u.field])
        .map((u: any) => uploadedImages[u.field].url);
      sportImageKeys[sport] = sportUrls
        .filter((u: any) => uploadedImages[u.field])
        .map((u: any) => uploadedImages[u.field].key);
    }

    const coverPhotoUrl = generalUrls[coverPhotoIndex];
    const coverPhotoKey = generalKeys[coverPhotoIndex];

    onImagesReady({
      generalImages: generalUrls,
      generalImageKeys: generalKeys,
      sportImages,
      sportImageKeys,
      coverPhotoUrl,
      coverPhotoKey,
    });

    toast.success("Images uploaded successfully");
  };

  if (loadingUrls) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="animate-spin" />
      </div>
    );
  }

  if (presignedUrls.length === 0) {
    return (
      <div className="py-4 text-sm text-slate-500">Select sports to start uploading images</div>
    );
  }

  const generalUrls = presignedUrls.filter((u: any) => u.field.startsWith("general_"));
  const sportUrlsByType = sports.reduce((acc: Record<string, any[]>, sport) => {
    acc[sport] = presignedUrls.filter((u: any) => u.field.startsWith(`sport_${sport}_`));
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* General Images */}
      <div>
        <h3 className="mb-2 font-semibold text-slate-900">Venue Images (3 required)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {generalUrls.map((url: any) => {
            const uploaded = uploadedImages[url.field];
            const isUploading = uploading[url.field];
            const error = uploadErrors[url.field];

            return (
              <div key={url.field} className="relative">
                {uploaded ? (
                  <div className="relative aspect-square">
                    <img
                      src={uploaded.url}
                      alt="General"
                      className="h-full w-full rounded-lg border-2 border-green-300 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(url.field)}
                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                    {generalUrls.indexOf(url) === coverPhotoIndex && (
                      <div className="absolute bottom-2 left-2 rounded bg-green-500 px-2 py-1 text-xs font-medium text-white">
                        Cover
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="hover:border-power-orange hover:bg-power-orange/5 flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 transition-all">
                    {isUploading ? (
                      <Loader className="text-power-orange animate-spin" size={24} />
                    ) : (
                      <>
                        <Upload className="mb-1 text-slate-400" size={24} />
                        <span className="text-center text-xs text-slate-600">
                          Image {generalUrls.indexOf(url) + 1}
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && handleImageSelect(e.target.files[0], url.field)
                      }
                      className="hidden"
                      disabled={disabled || isUploading}
                    />
                  </label>
                )}
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Set cover photo:{" "}
          <select
            value={coverPhotoIndex}
            onChange={(e) => setCoverPhotoIndex(Number(e.target.value))}
            className="ml-1 rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {[0, 1, 2].map((i) => (
              <option key={i} value={i}>
                Image {i + 1}
              </option>
            ))}
          </select>
        </p>
      </div>

      {/* Sport-Specific Images */}
      {sports.map((sport) => {
        const sportUrls = sportUrlsByType[sport];
        const uploadedCount = sportUrls.filter((u: any) => uploadedImages[u.field]).length;

        return (
          <div key={sport}>
            <h3 className="mb-2 font-semibold text-slate-900">
              {sport} Images ({uploadedCount}/5)
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {sportUrls.map((url: any) => {
                const uploaded = uploadedImages[url.field];
                const isUploading = uploading[url.field];
                const error = uploadErrors[url.field];

                return (
                  <div key={url.field} className="relative">
                    {uploaded ? (
                      <div className="relative aspect-square">
                        <img
                          src={uploaded.url}
                          alt={sport}
                          className="h-full w-full rounded-lg border-2 border-green-300 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url.field)}
                          className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="hover:border-power-orange hover:bg-power-orange/5 flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 transition-all">
                        {isUploading ? (
                          <Loader className="text-power-orange animate-spin" size={20} />
                        ) : (
                          <Camera className="text-slate-400" size={20} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files?.[0] && handleImageSelect(e.target.files[0], url.field)
                          }
                          className="hidden"
                          disabled={disabled || isUploading}
                        />
                      </label>
                    )}
                    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleConfirmImages}
        disabled={disabled || Object.keys(uploadedImages).length === 0}
        className="bg-power-orange w-full rounded-lg py-3 font-medium text-white transition-colors hover:bg-orange-600 disabled:bg-slate-300"
      >
        Confirm All Images
      </button>
    </div>
  );
}
