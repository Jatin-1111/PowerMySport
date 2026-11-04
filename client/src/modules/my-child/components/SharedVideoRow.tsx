"use client";

import type { ChildSharePublicView } from "@powermysport/shared-types";
import { formatBytes, formatDuration } from "@/modules/my-child/utils/format";
import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

type Clip = ChildSharePublicView["videos"][number];

type Playback =
  { state: "idle" } | { state: "loading" } | { state: "ready"; url: string } | { state: "error" };

/**
 * One clip on a shared profile. A reader presses Play, the page asks for a link that works for
 * a few minutes, and the browser's own player shows it. Nothing loads until then, so opening a
 * profile does not stream video the reader may never watch.
 *
 * For a clip the browser cannot play (a phone's HEVC clip in a Chrome without the codec), the
 * player cannot show it, so there is always a plain link to open or save the file instead.
 */
export function SharedVideoRow({
  clip,
  play,
}: {
  clip: Clip;
  /** Asks for a playback link. Left out in a preview, where nothing is played. */
  play?: (videoId: string) => Promise<{ url: string }>;
}) {
  const [playback, setPlayback] = useState<Playback>({ state: "idle" });

  const start = async () => {
    if (!play) return;
    setPlayback({ state: "loading" });
    try {
      const { url } = await play(clip.id);
      setPlayback({ state: "ready", url });
    } catch {
      setPlayback({ state: "error" });
    }
  };

  const meta = [
    clip.durationSeconds !== undefined ? formatDuration(clip.durationSeconds) : null,
    clip.sizeBytes ? formatBytes(clip.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-ink truncate font-medium">{clip.title ?? "Video"}</p>
          {meta && <p className="text-ink-body text-sm tabular-nums">{meta}</p>}
        </div>
        {play ? (
          playback.state === "idle" || playback.state === "error" ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={start}
              aria-label={`Play ${clip.title ?? "video"}`}
            >
              Play
            </Button>
          ) : null
        ) : (
          <p className="text-ink-body text-sm">Plays on the link</p>
        )}
      </div>

      {playback.state === "loading" && (
        <p role="status" className="text-ink-body mt-3 text-sm">
          Loading the video
        </p>
      )}

      {playback.state === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          This video could not be played. Try again.
        </p>
      )}

      {playback.state === "ready" && (
        <div className="mt-3">
          <video
            key={playback.url}
            src={playback.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
          >
            Your browser cannot play this video.
          </video>
          <p className="text-ink-body mt-2 flex flex-wrap items-center gap-x-2 text-sm">
            Not playing?{" "}
            <a
              href={playback.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-ink inline-flex min-h-11 items-center underline underline-offset-2"
            >
              Open or save the clip
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      )}
    </li>
  );
}
