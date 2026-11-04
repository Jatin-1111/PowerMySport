"use client";

import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { computeWaveform } from "@/modules/community/utils/audioWaveform";

/**
 * Press to start, press again to send. The clip is uploaded on stop rather
 * than streamed, which keeps it on the same presigned-POST path as every
 * other attachment.
 */
export function useVoiceRecording(
  handleSendAttachment: (
    file: File,
    kind: "FILE" | "VOICE",
    durationMs?: number,
    waveform?: number[]
  ) => Promise<void>
) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari does not produce audio/webm; letting the browser pick and
      // reading back what it chose keeps the MIME honest for the allowlist.
      const preferred = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: preferred });

      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        void (async () => {
          // Release the mic straight away — a live indicator lingering after the
          // clip is sent reads as the app still listening.
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);

          const durationMs = Date.now() - recordingStartedAtRef.current;
          const blob = new Blob(recordingChunksRef.current, {
            type: preferred,
          });
          recordingChunksRef.current = [];

          if (durationMs < 700 || blob.size === 0) {
            toast.error("That was too short to send");
            return;
          }

          const extension = preferred === "audio/webm" ? "webm" : "m4a";
          const file = new File([blob], `voice-message.${extension}`, {
            type: preferred,
          });
          // Peaks are computed here, once, by the device that recorded the clip.
          const waveform = await computeWaveform(blob);
          void handleSendAttachment(file, "VOICE", durationMs, waveform);
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access was denied");
    }
  };

  return { isRecording, toggleVoiceRecording };
}
