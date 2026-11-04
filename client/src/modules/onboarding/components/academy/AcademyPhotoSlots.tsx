"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

interface AcademyPhotoSlotsProps {
  label: string;
  hint?: string;
  /** Photos already added. */
  urls: string[];
  /** How many are needed before the step can be saved. */
  need: number;
  /** How many slots to show. */
  capacity: number;
  /** The cover photo, when this set can offer one (the general photos). */
  coverUrl?: string;
  onSetCover?: (url: string) => void;
  /** Adds the chosen files, one after another. The parent does the uploading. */
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
  /** A message from the last upload, shown under the slots. */
  uploadError?: string;
  /** A message from validation, shown under the slots. */
  error?: string;
  disabled?: boolean;
}

/**
 * A row of photo slots with a counter, e.g. "2 of 3 added". Pick several files at
 * once and they go in order. Each photo can be removed, and in the general set
 * one can be made the cover.
 */
export function AcademyPhotoSlots({
  label,
  hint,
  urls,
  need,
  capacity,
  coverUrl,
  onSetCover,
  onAdd,
  onRemove,
  uploading,
  uploadError,
  error,
  disabled = false,
}: AcademyPhotoSlotsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, capacity - urls.length);
  const met = urls.length >= need;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className={`text-xs ${met ? "text-emerald-700" : "text-slate-600"}`} aria-live="polite">
          {urls.length} of {need} added
        </p>
      </div>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((url, index) => (
          <li key={`${url}-${index}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${label}, photo ${index + 1}`}
              className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
            />
            {coverUrl === url && (
              <span className="absolute left-1 top-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900">
                Cover
              </span>
            )}
            <div className="mt-1 flex items-center justify-between gap-1">
              {onSetCover && coverUrl !== url ? (
                <button
                  type="button"
                  onClick={() => onSetCover(url)}
                  disabled={disabled || uploading}
                  className="text-[11px] font-medium text-slate-700 underline underline-offset-2 disabled:opacity-50"
                >
                  Make cover
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled || uploading}
                aria-label={`Remove photo ${index + 1} from ${label}`}
                className="text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {remaining > 0 && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-700 hover:border-slate-500 disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Uploading
                </>
              ) : (
                <>
                  <Upload size={16} aria-hidden />
                  Add photos
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="sr-only"
              aria-label={`Choose photos for ${label}`}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, remaining);
                event.target.value = "";
                if (files.length > 0) onAdd(files);
              }}
            />
          </li>
        )}
      </ul>

      {uploadError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {uploadError}
        </p>
      )}
      {error && !uploadError && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
