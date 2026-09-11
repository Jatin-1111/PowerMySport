"use client";

import { blogService } from "@/modules/community/services/blog";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const MAX_CLIENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface BlogImageUploadResult {
  s3Key: string;
  localPreviewUrl: string;
  /** Intrinsic pixel size, when the browser could decode it. See `readImageSize`. */
  width?: number;
  height?: number;
}

/**
 * The image's intrinsic pixel size, read from the file before it leaves the
 * browser.
 *
 * There is no image processing anywhere in this upload path — the file goes
 * straight to S3 by presigned PUT and only a key is stored — so the browser is
 * the one place that ever sees the pixels. Without this, every surface has to
 * guess a shape and crop whatever does not fit, which is what clipped the
 * bottom off an uploaded certificate.
 *
 * Resolves undefined rather than throwing: a cover that renders at a default
 * shape is a far better outcome than an upload that fails because a decode did.
 */
const readImageSize = (file: File): Promise<{ width: number; height: number } | undefined> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { width: img.naturalWidth, height: img.naturalHeight }
          : undefined;
      URL.revokeObjectURL(objectUrl);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(undefined);
    };
    img.src = objectUrl;
  });

const validateFile = (file: File) => {
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed.");
  }
  if (file.size > MAX_CLIENT_SIZE_BYTES) {
    throw new Error("Image must be under 10 MB.");
  }
};

const putToS3 = async (uploadUrl: string, file: File) => {
  const s3Response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!s3Response.ok) {
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
};

/**
 * Upload a blog image (cover) to S3 via the presigned PUT flow. Returns the
 * S3 object key and a local blob preview URL (caller revokes it once the
 * real URL is available).
 */
export async function uploadBlogImage(file: File): Promise<BlogImageUploadResult> {
  validateFile(file);
  const [{ uploadUrl, key }, size] = await Promise.all([
    blogService.getImageUploadUrl(file.type),
    readImageSize(file),
  ]);
  await putToS3(uploadUrl, file);
  return { s3Key: key, localPreviewUrl: URL.createObjectURL(file), ...size };
}

export interface InlineBlogImageUploadResult {
  key: string;
  url: string;
}

/**
 * Upload an image for inline use inside the rich-text body. Unlike the cover
 * uploader, this returns the real presigned GET url (not a blob url) so the
 * image keeps rendering across reloads/edit sessions until the server
 * re-signs it fresh from the persisted `data-key` on next read.
 */
export async function uploadInlineBlogImage(file: File): Promise<InlineBlogImageUploadResult> {
  validateFile(file);
  const { uploadUrl, downloadUrl, key } = await blogService.getImageUploadUrl(file.type);
  await putToS3(uploadUrl, file);
  return { key, url: downloadUrl };
}
