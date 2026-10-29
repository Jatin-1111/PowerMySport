"use client";

import { CHILD_HISTORY_LIMITS, type ChildVideoView } from "@powermysport/shared-types";
import { VideoConsentDialog } from "@/modules/my-child/components/VideoConsentDialog";
import { VideoPlayerDialog } from "@/modules/my-child/components/VideoPlayerDialog";
import { useVideoUpload } from "@/modules/my-child/hooks/useVideoUpload";
import { formatBytes, formatDuration } from "@/modules/my-child/utils/format";
import { Button } from "@/modules/shared/ui/Button";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { useRef, useState } from "react";

const ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm";

/**
 * A child's video clips: add one from the phone, see how it is going, play it, remove it.
 *
 * Nothing is sent until the parent has agreed to the video notice, once. The picker opens inside
 * the click on "Agree and choose a video" (or on "Add video" when they have agreed already),
 * because a browser opens a file picker only for a click. If recording the agreement is still
 * in flight when the file is chosen, the upload waits for it.
 */
export function VideosCard({
  childId,
  videos,
  consentGiven,
  onAgree,
  onRemove,
  removing,
}: {
  childId: string;
  videos: ChildVideoView[];
  consentGiven: boolean;
  onAgree: () => Promise<unknown>;
  onRemove: (videoId: string) => void;
  removing: boolean;
}) {
  const { phase, busy, start, cancel, dismiss } = useVideoUpload(childId);
  const input = useRef<HTMLInputElement>(null);
  const pendingConsent = useRef<Promise<unknown> | null>(null);
  const [asking, setAsking] = useState(false);
  const [playing, setPlaying] = useState<ChildVideoView | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ChildVideoView | null>(null);

  const atLimit = videos.length >= CHILD_HISTORY_LIMITS.videosPerChild;

  const chooseFile = () => input.current?.click();

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same clip again still fires
    if (!file) return;
    if (pendingConsent.current) {
      try {
        await pendingConsent.current;
      } catch {
        return; // the agreement was not recorded and the mutation has already said so
      } finally {
        pendingConsent.current = null;
      }
    }
    void start(file);
  };

  return (
    <div className="border-hairline rounded-xl border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-editorial text-ink text-xl font-light">Videos</h3>
          <p className="text-ink-body mt-1 text-pretty text-sm">
            MP4, MOV or WebM, up to {CHILD_HISTORY_LIMITS.videoMaxSeconds / 60} minutes and{" "}
            {Math.round(CHILD_HISTORY_LIMITS.videoMaxBytes / (1024 * 1024))} MB each.{" "}
            <span className="tabular-nums">
              {videos.length} of {CHILD_HISTORY_LIMITS.videosPerChild} added.
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={busy || atLimit}
          onClick={() => (consentGiven ? chooseFile() : setAsking(true))}
        >
          Add video
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a video"
          onChange={onFile}
        />
      </div>

      {atLimit && !busy && (
        <p className="text-ink-body mt-3 text-sm">
          That is the most videos for one child. Remove one to add another.
        </p>
      )}

      {phase.kind === "checking" && (
        <p role="status" className="text-ink-body mt-4 text-sm">
          Checking {phase.fileName}
        </p>
      )}

      {phase.kind === "uploading" && (
        <div className="mt-4" role="status">
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase.percent}
            className="bg-paper-deep h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-ink h-full" style={{ width: `${phase.percent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-ink-body text-sm">
              Uploading {phase.percent}%. Keep this page open until it finishes.
            </p>
            <Button variant="ghost" size="sm" className="min-h-11" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase.kind === "finishing" && (
        <p role="status" className="text-ink-body mt-4 text-sm">
          Finishing {phase.fileName}
        </p>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-red-700">{phase.message}</p>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      )}

      {videos.length === 0 && phase.kind === "idle" ? (
        <p className="text-ink-body mt-4 text-sm">No videos yet. Add a clip from your phone.</p>
      ) : (
        <ul className="divide-hairline mt-4 divide-y">
          {videos.map((video) => (
            <li
              key={video.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-0">
                <p className="text-ink truncate font-medium">{video.title ?? "Video"}</p>
                <p className="text-ink-body text-sm tabular-nums">
                  {video.status === "uploading"
                    ? "Unfinished upload"
                    : [
                        video.durationSeconds !== undefined
                          ? formatDuration(video.durationSeconds)
                          : null,
                        video.sizeBytes ? formatBytes(video.sizeBytes) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                {video.status === "ready" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setPlaying(video)}
                    aria-label={`Play ${video.title ?? "video"}`}
                  >
                    Play
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setConfirmRemove(video)}
                  aria-label={`Remove ${video.title ?? "video"}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VideoConsentDialog
        isOpen={asking}
        onClose={() => setAsking(false)}
        onAgree={() => {
          pendingConsent.current = onAgree();
          setAsking(false);
          chooseFile();
        }}
      />

      <VideoPlayerDialog childId={childId} video={playing} onClose={() => setPlaying(null)} />

      <ConfirmDialog
        isOpen={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) onRemove(confirmRemove.id);
        }}
        title="Remove this video"
        message={
          confirmRemove
            ? `Remove "${confirmRemove.title ?? "this video"}"? Any link that included it stops showing it.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        loading={removing}
      />
    </div>
  );
}
