import { useEffect, useRef, useState, useCallback } from "react";
import { useRecordingStore } from "../../stores/recordingStore";

interface Position {
  x: number;
  y: number;
}

export function WebcamBubble() {
  const { isRecording } = useRecordingStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [size, setSize] = useState(150);
  const [position, setPosition] = useState<Position>({
    x: window.innerWidth - 170,
    y: window.innerHeight - 170,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  // Toggle webcam with W key during recording
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.altKey) {
        // Don't toggle if typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setEnabled((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording]);

  // Start/stop webcam stream
  useEffect(() => {
    if (!enabled || !isRecording) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 320, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (e) {
        console.error("Failed to access webcam:", e);
        setEnabled(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
    };
  }, [enabled, isRecording]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Scroll to resize
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setSize((prev) => Math.max(80, Math.min(300, prev + (e.deltaY < 0 ? 10 : -10))));
  }, []);

  if (!isRecording || !enabled || !stream) return null;

  return (
    <div
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.8)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: 99995,
        userSelect: "none",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)", // Mirror
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
