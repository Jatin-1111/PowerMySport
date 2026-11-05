import * as ImagePicker from "expo-image-picker";
import type { ChildPhotoContentType } from "@powermysport/shared-types";
import { childHistoryApi } from "./childHistory";
import { photoContentType, photoSizeProblem } from "../utils/photo";

/** A photo the parent chose, not yet sent anywhere. */
export interface PickedPhoto {
  uri: string;
  contentType: ChildPhotoContentType;
}

export type PickResult =
  | { ok: true; photo: PickedPhoto }
  | { ok: false; reason: "cancelled" | "denied" | "unsupported" | "failed"; message: string };

const QUALITY = 0.8;

/**
 * Takes a photo with the camera or chooses one from the gallery. The picker re-encodes at 0.8
 * quality, which keeps a phone photo well under the 8 MB limit and hands back JPEG even when the
 * original was HEIC, which the server does not take.
 */
export async function pickPhoto(source: "camera" | "library"): Promise<PickResult> {
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return {
          ok: false,
          reason: "denied",
          message:
            "PowerMySport does not have permission to use the camera. You can allow it in your phone's settings, or choose a photo from the gallery.",
        };
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: QUALITY,
      allowsEditing: false,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return { ok: false, reason: "cancelled", message: "" };

    const contentType = photoContentType(asset.mimeType, asset.uri);
    if (!contentType) {
      return {
        ok: false,
        reason: "unsupported",
        message: "Only JPEG, PNG and WebP photos can be added.",
      };
    }
    return { ok: true, photo: { uri: asset.uri, contentType } };
  } catch {
    return {
      ok: false,
      reason: "failed",
      message: "Could not open the camera or gallery. Please try again.",
    };
  }
}

export class PhotoUploadError extends Error {}

/**
 * Sends the photo to private storage for an entry that already exists. The file goes straight to
 * the signed link and is not sent through our API, and the account's login token is never sent to
 * storage, which is why this uses a plain fetch and not the API client. The server then checks the
 * stored size and type before the photo counts.
 */
export async function uploadPhoto(
  childId: string,
  entryId: string,
  photo: PickedPhoto
): Promise<void> {
  let blob: Blob;
  try {
    blob = await (await fetch(photo.uri)).blob();
  } catch {
    throw new PhotoUploadError("Could not read that photo. Please choose it again.");
  }
  const problem = photoSizeProblem(blob.size);
  if (problem) throw new PhotoUploadError(problem);

  let upload;
  try {
    upload = await childHistoryApi.startPhoto(childId, entryId, {
      contentType: photo.contentType,
      sizeBytes: blob.size,
    });
  } catch (err) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
    throw new PhotoUploadError(message || "Could not start the photo upload. Please try again.");
  }

  let response: Response;
  try {
    response = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: blob,
    });
  } catch {
    throw new PhotoUploadError("The photo did not upload. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new PhotoUploadError("The photo did not upload. Please try again.");
  }

  try {
    await childHistoryApi.completePhoto(childId, entryId);
  } catch (err) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
    throw new PhotoUploadError(message || "The photo could not be saved. Please try again.");
  }
}
