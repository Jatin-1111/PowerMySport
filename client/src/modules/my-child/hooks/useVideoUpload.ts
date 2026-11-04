"use client";

import { CHILD_HISTORY_LIMITS } from "@powermysport/shared-types";
import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { childHistoryApi } from "@/modules/my-child/services/childHistory";
import {
  checkPlayable,
  contentTypeOf,
  refusalFor,
  TOO_LONG_MESSAGE,
  UNPLAYABLE_MESSAGE,
  UploadError,
  uploadParts,
} from "@/modules/my-child/utils/uploadVideo";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

export type UploadPhase =
  | { kind: "idle" }
  | { kind: "checking"; fileName: string }
  | { kind: "uploading"; fileName: string; percent: number }
  | { kind: "finishing"; fileName: string }
  | { kind: "error"; message: string };

const serverMessage = (error: unknown): string | undefined =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

const titleOf = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").slice(0, 120) || "Video";

/**
 * Sends one clip for one child, and reports where it is.
 *
 * The order is deliberate: the cheap checks that cost the parent nothing come first (type, size,
 * whether this browser can play it, how long it is), then the server is asked for permission and
 * the parts go to storage, then the server checks what arrived. If anything fails after the
 * server opened an upload, the half-made clip is deleted so nothing is left counting against the
 * parent's five.
 */
export function useVideoUpload(childId: string) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const openVideoId = useRef<string | null>(null);
  const busy =
    phase.kind === "checking" || phase.kind === "uploading" || phase.kind === "finishing";

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.childHistory.forChild(childId) });

  const discardOpenUpload = async () => {
    const videoId = openVideoId.current;
    openVideoId.current = null;
    if (videoId) await childHistoryApi.deleteVideo(childId, videoId).catch(() => undefined);
  };

  const start = useCallback(
    async (file: File) => {
      const refusal = refusalFor(file);
      if (refusal) return setPhase({ kind: "error", message: refusal });
      const contentType = contentTypeOf(file);
      if (!contentType) return setPhase({ kind: "error", message: refusalFor(file) ?? "" });

      const abort = new AbortController();
      controller.current = abort;
      setPhase({ kind: "checking", fileName: file.name });

      try {
        const check = await checkPlayable(file);
        if (!check.playable) return setPhase({ kind: "error", message: UNPLAYABLE_MESSAGE });
        if (
          typeof check.durationSeconds === "number" &&
          check.durationSeconds > CHILD_HISTORY_LIMITS.videoMaxSeconds
        ) {
          return setPhase({ kind: "error", message: TOO_LONG_MESSAGE });
        }

        const plan = await childHistoryApi.startVideo(childId, {
          contentType,
          sizeBytes: file.size,
          title: titleOf(file.name),
          ...(check.durationSeconds !== undefined
            ? { durationSeconds: check.durationSeconds }
            : {}),
        });
        openVideoId.current = plan.videoId;

        setPhase({ kind: "uploading", fileName: file.name, percent: 0 });
        const parts = await uploadParts({
          file,
          plan,
          signal: abort.signal,
          onProgress: (percent) =>
            setPhase((previous) =>
              previous.kind === "uploading" ? { ...previous, percent } : previous
            ),
        });

        setPhase({ kind: "finishing", fileName: file.name });
        await childHistoryApi.completeVideo(childId, plan.videoId, parts);
        openVideoId.current = null;
        setPhase({ kind: "idle" });
        toast.success("Video added.");
      } catch (error) {
        await discardOpenUpload();
        if (abort.signal.aborted) return setPhase({ kind: "idle" });
        const message =
          error instanceof UploadError
            ? error.message
            : (serverMessage(error) ?? "The video could not be added. Try again.");
        setPhase({ kind: "error", message });
      } finally {
        controller.current = null;
        void refresh();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childId]
  );

  /** Stops the upload in progress. The half-sent clip is removed. */
  const cancel = useCallback(() => controller.current?.abort(), []);
  const dismiss = useCallback(() => setPhase({ kind: "idle" }), []);

  return { phase, busy, start, cancel, dismiss };
}
