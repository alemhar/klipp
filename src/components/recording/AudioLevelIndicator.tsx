import { useEffect, useRef, useState } from "react";

interface AudioLevelIndicatorProps {
  /** Whether the indicator is active. When false, no audio stream is opened. */
  active: boolean;
  /** Width of the indicator in pixels. */
  width?: number;
  /** Height of the indicator in pixels. */
  height?: number;
  /** Number of frequency bars to render. */
  bars?: number;
  /** Color of the bars. */
  color?: string;
  /** Optional device label to target a specific input (future use). */
  deviceLabel?: string;
  /** Visual sensitivity multiplier. 1.0 = linear; >1 amplifies quiet sounds. Default 2.2. */
  sensitivity?: number;
}

/**
 * Renders a small frequency-spectrum visualizer reacting to microphone input.
 *
 * Opens a `getUserMedia` stream while `active` is true and uses the Web Audio
 * API's AnalyserNode to sample FFT data. The stream is opened/closed as
 * `active` flips so we don't hold the mic unnecessarily.
 *
 * Note: the recording pipeline uses FFmpeg/DirectShow for the actual capture;
 * this component opens a separate browser-side stream purely for visualization.
 */
export function AudioLevelIndicator({
  active,
  width = 48,
  height = 20,
  bars = 5,
  color = "#4ade80",
  sensitivity = 2.2,
}: AudioLevelIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioContextCtor =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextCtor();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // small FFT size for a compact indicator
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          const canvas = canvasRef.current;
          if (!canvas || !analyserRef.current) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          analyserRef.current.getByteFrequencyData(buf);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const barWidth = Math.max(1, Math.floor(canvas.width / bars) - 1);
          const gap = 1;
          // Group FFT bins into `bars` bands; take the peak value in each band.
          // Peak is more responsive than average for voice (energy concentrates
          // in a few frequencies). Apply sqrt scaling so quiet sounds show up
          // better, then multiply by sensitivity and clamp.
          const binsPerBar = Math.max(1, Math.floor(buf.length / bars));
          for (let i = 0; i < bars; i++) {
            let peak = 0;
            for (let j = 0; j < binsPerBar; j++) {
              const v = buf[i * binsPerBar + j] || 0;
              if (v > peak) peak = v;
            }
            // Normalize to 0..1, sqrt for perceptual scaling, then amplify.
            const normalized = Math.min(1, Math.sqrt(peak / 255) * sensitivity);
            const barHeight = normalized * canvas.height;
            const x = i * (barWidth + gap);
            const y = canvas.height - barHeight;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth, barHeight);
          }

          rafRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) {
        console.error("AudioLevelIndicator: getUserMedia failed", e);
        setError(String(e));
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [active, bars, color, sensitivity]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      title={error ? `Audio error: ${error}` : "Audio level"}
      style={{
        display: "block",
        borderRadius: 3,
        backgroundColor: "rgba(0,0,0,0.15)",
      }}
    />
  );
}
