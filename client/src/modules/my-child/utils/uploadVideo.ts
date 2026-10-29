import {
  CHILD_HISTORY_LIMITS,
  CHILD_VIDEO_CONTENT_TYPES,
  type ChildVideoContentType,
} from "@powermysport/shared-types";
import type { UploadedPart, UploadPlan } from "@/modules/my-child/services/childHistory";

/**
 * Getting a clip from a phone to storage.
 *
 * The file is cut into the parts the server named and each part is sent straight to its own
 * signed link, a few at a time. A part that fails is tried again, so a dropped connection costs
 * one part rather than the whole clip. The server never sees the bytes; it checks the stored size
 * at the end. Nothing here trusts the file's own claims beyond a first look: the type, the size
 * and whether this browser can play it are checked before anything is sent.
 */

const BY_EXTENSION: Record<string, ChildVideoContentType> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** The type to declare, or null for a file that is not one of the three accepted. */
export const contentTypeOf = (file: {
  name: string;
  type: string;
}): ChildVideoContentType | null => {
  const declared = file.type as ChildVideoContentType;
  if (CHILD_VIDEO_CONTENT_TYPES.includes(declared)) return declared;
  // Some phones and browsers send no type for a .mov, so the extension decides.
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
};

const MB = 1024 * 1024;

/** A reason the file cannot be sent, in words for the parent, or null if it can. */
export const refusalFor = (file: { name: string; type: string; size: number }): string | null => {
  if (!contentTypeOf(file)) return "Choose an MP4, MOV or WebM video.";
  if (file.size <= 0) return "That file is empty. Choose another video.";
  if (file.size > CHILD_HISTORY_LIMITS.videoMaxBytes) {
    return `That video is larger than ${Math.round(CHILD_HISTORY_LIMITS.videoMaxBytes / MB)} MB. Choose a shorter clip.`;
  }
  return null;
};

export const UNPLAYABLE_MESSAGE =
  "This clip may not play for others. Choose another clip, or set your phone camera to Most Compatible.";

export const TOO_LONG_MESSAGE = `That clip is longer than ${CHILD_HISTORY_LIMITS.videoMaxSeconds / 60} minutes. Choose a shorter one.`;

export interface PlayCheck {
  playable: boolean;
  durationSeconds?: number;
}

/**
 * Asks this browser to open the clip. If it cannot, nobody's browser is likely to, so the clip is
 * not sent. A clip that plays here can still fail in another browser (a phone's HEVC video in a
 * Chrome without the codec), which no check from here can rule out.
 */
export const checkPlayable = (file: Blob, timeoutMs = 10_000): Promise<PlayCheck> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: PlayCheck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ playable: false }), timeoutMs);
    video.preload = "metadata";
    video.muted = true;
    video.onerror = () => finish({ playable: false });
    video.onloadedmetadata = () => {
      // A video track a browser cannot decode loads metadata with no picture size.
      const playable = video.videoWidth > 0 && Number.isFinite(video.duration);
      finish(playable ? { playable, durationSeconds: Math.round(video.duration) } : { playable });
    };
    video.src = url;
  });

export class UploadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Sends one part and returns the ETag storage gave it, which the server needs to join the parts. */
const putPart = (
  url: string,
  body: Blob,
  onLoaded: (bytes: number) => void,
  signal: AbortSignal
): Promise<string> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onLoaded(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(
            new UploadError("Storage is not set up to accept uploads from this site yet.", false)
          );
          return;
        }
        resolve(etag);
      } else if (xhr.status === 403) {
        // An expired or mismatched link will not work on a second try.
        reject(new UploadError("The upload link expired. Start the upload again.", false));
      } else {
        reject(new UploadError(`The upload was interrupted (${xhr.status}).`, true));
      }
    };
    xhr.onerror = () => reject(new UploadError("The connection dropped during the upload.", true));
    xhr.onabort = () => reject(new UploadError("The upload was cancelled.", false));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface UploadOptions {
  file: Blob;
  plan: UploadPlan;
  signal: AbortSignal;
  /** Whole percent, 0 to 100, over the whole clip. */
  onProgress: (percent: number) => void;
  concurrency?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}

/** Sends every part, a few at a time, retrying a failed part, and returns what the server needs. */
export const uploadParts = async ({
  file,
  plan,
  signal,
  onProgress,
  concurrency = 3,
  maxAttempts = 3,
  retryDelayMs = 1000,
}: UploadOptions): Promise<UploadedPart[]> => {
  const total = plan.parts.reduce((sum, part) => sum + part.sizeBytes, 0);
  const loaded = new Map<number, number>();
  const done: UploadedPart[] = [];
  const queue = [...plan.parts];

  const report = () => {
    const sent = [...loaded.values()].reduce((sum, bytes) => sum + bytes, 0);
    onProgress(Math.min(100, Math.floor((sent / total) * 100)));
  };

  const sendOne = async (part: UploadPlan["parts"][number]) => {
    const start = (part.partNumber - 1) * plan.partBytes;
    const body = file.slice(start, start + part.sizeBytes);
    for (let attempt = 1; ; attempt += 1) {
      try {
        loaded.set(part.partNumber, 0);
        const etag = await putPart(
          part.url,
          body,
          (bytes) => {
            loaded.set(part.partNumber, bytes);
            report();
          },
          signal
        );
        loaded.set(part.partNumber, part.sizeBytes);
        report();
        done.push({ partNumber: part.partNumber, etag });
        return;
      } catch (error) {
        const retryable = error instanceof UploadError && error.retryable;
        if (!retryable || attempt >= maxAttempts || signal.aborted) throw error;
        await wait(retryDelayMs * attempt);
      }
    }
  };

  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) await sendOne(part);
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  } catch (error) {
    queue.length = 0; // no more parts are started once one has failed for good
    throw error;
  }
  return done.sort((a, b) => a.partNumber - b.partNumber);
};
