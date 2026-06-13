"use client";

import { communityService } from "@/modules/community/services/community";

/** Allowed MIME types for chat image uploads. */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const MAX_CLIENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB friendly gate (server enforces 5 MB)

/**
 * Read pixel dimensions from a File without uploading it.
 * Returns null if dimensions cannot be determined (e.g., unsupported env).
 */
async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export interface ChatImageUploadResult {
  s3Key: string;
  width: number;
  height: number;
  localPreviewUrl: string;
}

/**
 * Upload a chat image to S3 via the presigned POST flow.
 *
 * Flow:
 * 1. Client-side type + size validation (friendly error messages)
 * 2. Read pixel dimensions via Image element
 * 3. Request presigned POST credentials from server
 * 4. POST file directly to S3 using FormData + presigned fields
 * 5. Return the S3 object key, dimensions, and a local blob preview URL
 *
 * The caller is responsible for revoking the localPreviewUrl when it is no
 * longer needed (e.g., after the confirmed message arrives).
 */
export async function uploadChatImage(
  file: File,
  conversationId: string,
): Promise<ChatImageUploadResult> {
  // ── 1. Type validation ──────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed.");
  }

  // ── 2. Client-side size gate (friendly UX; AWS enforces 5 MB hard limit) ─
  if (file.size > MAX_CLIENT_SIZE_BYTES) {
    throw new Error("Image must be under 10 MB.");
  }

  // ── 3. Read dimensions (best-effort; fallback to 0 so layout doesn't break) ─
  const dims = await readImageDimensions(file);
  const width = dims?.width ?? 0;
  const height = dims?.height ?? 0;

  // ── 4. Request presigned POST from server ───────────────────────────────
  const { url, fields, key } = await communityService.getImageUploadUrl(
    conversationId,
    file.type,
  );

  // ── 5. POST directly to S3 ──────────────────────────────────────────────
  const formData = new FormData();
  // Presigned POST fields must come BEFORE the file
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    formData.append(fieldKey, fieldValue);
  }
  formData.append("file", file);

  const s3Response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!s3Response.ok) {
    // S3 returns XML on error; try to parse a useful message
    let errMsg = `S3 upload failed (${s3Response.status})`;
    try {
      const xml = await s3Response.text();
      const match = xml.match(/<Message>(.*?)<\/Message>/);
      if (match?.[1]) errMsg = match[1];
    } catch {
      // ignore parse error, use generic message
    }
    throw new Error(errMsg);
  }

  // Create a local blob URL for the optimistic preview.
  // Caller MUST revoke this when the real message arrives.
  const localPreviewUrl = URL.createObjectURL(file);

  return { s3Key: key, width, height, localPreviewUrl };
}
