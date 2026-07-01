"use client";

import { blogService } from "@/modules/community/services/blog";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const MAX_CLIENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface BlogImageUploadResult {
  s3Key: string;
  localPreviewUrl: string;
}

/**
 * Upload a blog image (cover or inline block) to S3 via the presigned POST
 * flow, mirroring the chat image uploader. Returns the S3 object key and a
 * local blob preview URL (caller revokes it once the real URL is available).
 */
export async function uploadBlogImage(
  file: File,
): Promise<BlogImageUploadResult> {
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed.");
  }
  if (file.size > MAX_CLIENT_SIZE_BYTES) {
    throw new Error("Image must be under 10 MB.");
  }

  const { uploadUrl, key } = await blogService.getImageUploadUrl(file.type);

  // Presigned PUT: send the raw file with a matching Content-Type header.
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

  return { s3Key: key, localPreviewUrl: URL.createObjectURL(file) };
}
