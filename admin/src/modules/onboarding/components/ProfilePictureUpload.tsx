"use client";

import { useState } from "react";

interface Props {
  value?: string | null;
  onChange?: (key: string | null) => void;
  disabled?: boolean;
}

export default function ProfilePictureUpload({ value, onChange, disabled = false }: Props) {
  const [preview, setPreview] = useState<string | null>(value || null);

  const handleFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    // In admin we only show preview; actual upload/presign can be wired later
    onChange?.(null);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 overflow-hidden rounded-md bg-slate-100">
        {preview ? (
          <img src={preview} alt="preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer rounded bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
          Upload
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
            disabled={disabled}
          />
        </label>
        <div className="text-xs text-slate-500">Recommended: 400x400px</div>
      </div>
    </div>
  );
}
