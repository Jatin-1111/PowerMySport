import {
  CHILD_HISTORY_LIMITS,
  CHILD_PHOTO_CONTENT_TYPES,
  type ChildPhotoContentType,
} from "@powermysport/shared-types";

/**
 * The type of a picked photo as the server names it, or null when the server would refuse it.
 * Phones report "image/jpg" as often as "image/jpeg"; some pickers report nothing, so the file
 * name is the fallback.
 */
export function photoContentType(
  mime: string | null | undefined,
  uri: string
): ChildPhotoContentType | null {
  const claimed = (mime ?? "").toLowerCase().trim();
  const normalised = claimed === "image/jpg" ? "image/jpeg" : claimed;
  if ((CHILD_PHOTO_CONTENT_TYPES as readonly string[]).includes(normalised)) {
    return normalised as ChildPhotoContentType;
  }
  if (normalised) return null;

  const ext = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(uri)?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

const MB = 1024 * 1024;

/** Words for a photo that is empty or over the limit, or null when the size is fine. */
export function photoSizeProblem(bytes: number): string | null {
  if (!(bytes > 0)) return "That photo is empty. Choose another one.";
  if (bytes > CHILD_HISTORY_LIMITS.photoMaxBytes) {
    return `That photo is larger than ${CHILD_HISTORY_LIMITS.photoMaxBytes / MB} MB. Take it again at a lower quality, or choose a smaller one.`;
  }
  return null;
}
