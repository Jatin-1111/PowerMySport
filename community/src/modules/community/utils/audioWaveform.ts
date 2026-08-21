/** How many bars a voice note is drawn with. Enough to read the shape of
 *  speech at the width a chat bubble allows, few enough to store inline. */
export const WAVEFORM_BARS = 40;

/**
 * Reduce a recorded clip to per-bar amplitude peaks, 0-100.
 *
 * Done once, on the device that recorded it, and stored with the message. The
 * alternative — decoding the audio in every viewer's browser — means each
 * participant downloads and decodes every clip in the thread just to paint
 * bars, before they have chosen to play anything.
 *
 * Returns an empty array if the browser cannot decode the blob; the player
 * falls back to a flat placeholder rather than failing to render.
 */
export async function computeWaveform(blob: Blob): Promise<number[]> {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      return [];
    }

    const context = new AudioContextCtor();
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      const samples = buffer.getChannelData(0);
      const perBar = Math.floor(samples.length / WAVEFORM_BARS) || 1;

      const peaks: number[] = [];
      for (let bar = 0; bar < WAVEFORM_BARS; bar += 1) {
        const start = bar * perBar;
        let sum = 0;
        for (let i = 0; i < perBar; i += 1) {
          const sample = samples[start + i];
          // RMS rather than peak: a single click would otherwise flatten every
          // other bar once the set is normalized.
          sum += sample ? sample * sample : 0;
        }
        peaks.push(Math.sqrt(sum / perBar));
      }

      const loudest = Math.max(...peaks, 0.0001);
      return peaks.map((peak) =>
        // Floor at 6 so silence still reads as a bar rather than a gap in the
        // track, which looks like a rendering fault.
        Math.max(6, Math.min(100, Math.round((peak / loudest) * 100))),
      );
    } finally {
      void context.close();
    }
  } catch {
    return [];
  }
}
