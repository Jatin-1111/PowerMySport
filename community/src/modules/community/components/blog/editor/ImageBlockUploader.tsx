"use client";

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { uploadBlogImage } from "@/modules/community/hooks/useBlogImageUpload";
import { toast } from "@/lib/toast";

interface ImageBlockUploaderProps {
  /** Resolved display URL for an already-uploaded image (edit mode). */
  imageUrl?: string | null;
  onUploaded: (key: string, previewUrl: string, size?: { width: number; height: number }) => void;
  onRemove?: () => void;
  /** Intrinsic size of an already-uploaded image, so edit mode reserves the right space. */
  imageWidth?: number | null;
  imageHeight?: number | null;
  /** Tailwind classes for the empty drop area — the filled state sizes to the image. */
  className?: string;
  /** Ceiling on the rendered height, so a tall image cannot push the form off screen. */
  maxHeightClassName?: string;
  label?: string;
  hint?: string;
}

export default function ImageBlockUploader({
  imageUrl,
  onUploaded,
  onRemove,
  imageWidth,
  imageHeight,
  className = "aspect-[16/9]",
  maxHeightClassName = "max-h-[420px]",
  label = "Add an image",
  hint = "Drag and drop, or click. JPEG, PNG or WebP, up to 10 MB",
}: ImageBlockUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadBlogImage(file);
      const size =
        result.width && result.height ? { width: result.width, height: result.height } : undefined;
      setLocalPreview(result.localPreviewUrl);
      setLocalSize(size ?? null);
      onUploaded(result.s3Key, result.localPreviewUrl, size);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const resolvedUrl = localPreview || imageUrl || "";
  const width = localSize?.width ?? imageWidth ?? undefined;
  const height = localSize?.height ?? imageHeight ?? undefined;

  if (resolvedUrl) {
    // Sized by the image, not by a fixed box. The old `aspect-[16/6]` container
    // with `object-cover` cropped anything that was not a wide landscape photo —
    // an uploaded certificate lost its last lines to it. `w-auto` keeps a tall
    // image from being letterboxed once the height cap bites, and the intrinsic
    // width/height reserve the space so the form does not jump when it loads.
    return (
      <div className="bg-paper-deep group relative w-full overflow-hidden rounded-2xl">
        <img
          src={resolvedUrl}
          alt="Upload preview"
          width={width}
          height={height}
          className={`mx-auto block h-auto w-auto max-w-full ${maxHeightClassName}`}
        />
        <div className="absolute right-3 top-3 flex gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-ink hover:bg-paper inline-flex h-11 w-11 items-center justify-center rounded-md bg-white transition-colors duration-200"
            aria-label="Replace image"
          >
            <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="hover:bg-paper inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-red-700 transition-colors duration-200"
              aria-label="Remove image"
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {uploading ? (
          <div
            role="status"
            className="bg-ink/50 absolute inset-0 flex items-center justify-center text-base font-medium text-white"
          >
            Uploading
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors duration-200 ${className} ${
        dragging
          ? "border-ink bg-wash"
          : "bg-paper-deep/60 hover:bg-paper-deep hover:border-ink/45 border-[#bfb8ab]"
      }`}
    >
      {uploading ? (
        <span role="status" className="text-ink-body text-base font-medium">
          Uploading
        </span>
      ) : (
        <>
          <ImagePlus size={28} strokeWidth={1.25} className="text-ink" aria-hidden="true" />
          <span className="text-ink text-base font-semibold">{label}</span>
          <span className="text-ink-body max-w-[44ch] text-sm">{hint}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onInputChange}
      />
    </button>
  );
}
