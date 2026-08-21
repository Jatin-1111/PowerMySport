"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { WAVEFORM_BARS } from "@/modules/community/utils/audioWaveform";

/** mm:ss. */
function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * A voice note, drawn the way a messaging app draws one.
 *
 * Replaces the browser's `<audio controls>`, which shipped its own play button,
 * its own timer, a volume slider and an overflow menu — a second, differently
 * styled control panel sitting inside the bubble, next to a duration label that
 * repeated what the widget already showed.
 *
 * Bars come from `waveform`, computed once when the clip was recorded. Without
 * them the track falls back to an even row, so an older or undecodable clip
 * still gets a usable player rather than a broken one.
 */
export function VoiceMessagePlayer({
  src,
  durationMs,
  waveform,
  isOwnMessage,
}: {
  src: string;
  durationMs?: number;
  waveform?: number[];
  isOwnMessage: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(0);

  // The recorded length is known before the file is fetched, so the bubble can
  // show a real duration immediately instead of "0:00" until metadata loads.
  const totalSeconds =
    loadedDuration || (durationMs ? durationMs / 1000 : 0) || 0;
  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;

  const bars =
    waveform && waveform.length > 0
      ? waveform
      : Array.from({ length: WAVEFORM_BARS }, () => 28);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setElapsed(audio.currentTime);
    const onLoaded = () => {
      // Some browsers report Infinity for a MediaRecorder blob until it is
      // seeked; the recorded duration is the reliable value in that case.
      if (Number.isFinite(audio.duration)) {
        setLoadedDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setElapsed(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", () => setIsPlaying(false));
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Autoplay policy or a fetch failure — leave the button in its resting
      // state rather than showing a pause icon over silence.
      setIsPlaying(false);
    }
  };

  /** Tapping the track seeks, the same as dragging a scrubber would. */
  const seekTo = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || totalSeconds <= 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    audio.currentTime = ratio * totalSeconds;
    setElapsed(audio.currentTime);
  };

  // The played portion is brand orange on both sides; only the unplayed track
  // changes, so it stays legible against each bubble background.
  const playedBar = "bg-power-orange";
  const pendingBar = isOwnMessage ? "bg-orange-200" : "bg-slate-300";

  return (
    <div className="flex items-center gap-2.5 py-0.5 pr-1">
      <audio ref={audioRef} preload="metadata" src={src} className="hidden" />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void toggle();
        }}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          isOwnMessage
            ? "bg-power-orange text-white"
            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
        }`}
      >
        {isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div
        onClick={(event) => {
          event.stopPropagation();
          seekTo(event);
        }}
        role="presentation"
        className="flex h-8 min-w-[120px] flex-1 cursor-pointer items-center gap-[2px]"
      >
        {bars.map((height, index) => {
          // (index + 1), not index: at zero progress `0 / n <= 0` is true, which
          // left the first bar looking played on every clip nobody had started.
          const isPlayed = (index + 1) / bars.length <= progress;
          return (
            <span
              key={index}
              style={{ height: `${Math.max(10, (height / 100) * 100)}%` }}
              className={`w-[2px] shrink-0 rounded-full transition-colors ${
                isPlayed ? playedBar : pendingBar
              }`}
            />
          );
        })}
      </div>

      <span className="shrink-0 text-[11px] tabular-nums opacity-70">
        {formatClock(isPlaying || elapsed > 0 ? elapsed : totalSeconds)}
      </span>
    </div>
  );
}
