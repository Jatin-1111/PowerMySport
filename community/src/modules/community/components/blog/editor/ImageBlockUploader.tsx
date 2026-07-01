"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { uploadBlogImage } from "@/modules/community/hooks/useBlogImageUpload";
import { toast } from "@/lib/toast";

interface ImageBlockUploaderProps {
  /** Resolved display URL for an already-uploaded image (edit mode). */
  imageUrl?: string | null;
  onUploaded: (key: string, previewUrl: string) => void;
  onRemove?: () => void;
  /** Tailwind aspect / height classes for the drop area. */
  className?: string;
  label?: string;
  hint?: string;
}

export default function ImageBlockUploader({
  imageUrl,
  onUploaded,
  onRemove,
  className = "aspect-[16/9]",
  label = "Add an image",
  hint = "Drag & drop or click — JPEG, PNG, WebP up to 10 MB",
}: ImageBlockUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadBlogImage(file);
      setLocalPreview(result.localPreviewUrl);
      onUploaded(result.s3Key, result.localPreviewUrl);
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

  if (resolvedUrl) {
    return (
      <div className={`group relative w-full overflow-hidden rounded-2xl border border-slate-200 ${className}`}>
        <img src={resolvedUrl} alt="Upload preview" className="h-full w-full object-cover" />
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Replace image"
          >
            <RefreshCw size={15} />
          </button>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-rose-600 shadow-sm transition hover:bg-white"
              aria-label="Remove image"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
            <Loader2 size={22} className="animate-spin text-white" />
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
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition ${className} ${
        dragging
          ? "border-power-orange bg-power-orange/5"
          : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {uploading ? (
        <Loader2 size={24} className="animate-spin text-slate-400" />
      ) : (
        <>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
            <ImagePlus size={22} />
          </span>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          <span className="text-xs text-slate-400">{hint}</span>
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
