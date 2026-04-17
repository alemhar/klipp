import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  button: string;
}

type ToolType = "none" | "rectangle" | "arrow";

type WebcamCorner = "br" | "bl" | "tl" | "tr";

const WEBCAM_MARGIN = 25;
const WEBCAM_SIZE = 150;

function cornerToPos(
  corner: WebcamCorner,
  region: { x: number; y: number; width: number; height: number }
) {
  const offset = WEBCAM_SIZE + WEBCAM_MARGIN;
  switch (corner) {
    case "br": return { x: region.x + region.width - offset, y: region.y + region.height - offset };
    case "bl": return { x: region.x + WEBCAM_MARGIN, y: region.y + region.height - offset };
    case "tl": return { x: region.x + WEBCAM_MARGIN, y: region.y + WEBCAM_MARGIN };
    case "tr": return { x: region.x + region.width - offset, y: region.y + WEBCAM_MARGIN };
  }
}

interface Shape {
  id: number;
  type: "rectangle" | "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function OverlayApp() {
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>("none");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const [webcamVisible, setWebcamVisible] = useState(false);

  // Read recording region from URL query params (set by show_overlay command)
  const params = new URLSearchParams(window.location.search);
  const region = {
    x: parseInt(params.get("x") || "0"),
    y: parseInt(params.get("y") || "0"),
    width: parseInt(params.get("w") || String(window.innerWidth)),
    height: parseInt(params.get("h") || String(window.innerHeight)),
  };

  const [webcamCorner, setWebcamCorner] = useState<WebcamCorner | null>("br");
  const [webcamPos, setWebcamPos] = useState(() => cornerToPos("br", region));
  const [draggingWebcam, setDraggingWebcam] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wasInteractive = useRef(false);

  // Toggle overlay interactivity when tool changes or webcam is being dragged
  useEffect(() => {
    const interactive = activeTool !== "none" || draggingWebcam;
    if (interactive !== wasInteractive.current) {
      wasInteractive.current = interactive;
      invoke("set_overlay_interactive", { interactive }).catch(console.error);
    }
  }, [activeTool, draggingWebcam]);

  // Listen for webcam toggle events
  useEffect(() => {
    const unlisten = listen("overlay-toggle-webcam", () => {
      setWebcamVisible((prev) => !prev);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Sync webcamPos when corner is set via hotkey
  useEffect(() => {
    if (webcamCorner) {
      setWebcamPos(cornerToPos(webcamCorner, region));
    }
  }, [webcamCorner, region.x, region.y, region.width, region.height]);

  // Listen for cycle webcam position events (Ctrl+Shift+P)
  useEffect(() => {
    const order: WebcamCorner[] = ["br", "bl", "tl", "tr"];
    const unlisten = listen("overlay-cycle-webcam-position", () => {
      setWebcamCorner((prev) => {
        if (prev === null) return "br"; // freeform -> reset to bottom-right
        const idx = order.indexOf(prev);
        return order[(idx + 1) % order.length];
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Start/stop webcam stream
  useEffect(() => {
    if (webcamVisible) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 320, height: 320 } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(console.error);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [webcamVisible]);

  // Listen for mouse-click events (ripples) and detect clicks on webcam bubble
  const webcamPosRef = useRef(webcamPos);
  webcamPosRef.current = webcamPos;
  const webcamVisibleRef = useRef(webcamVisible);
  webcamVisibleRef.current = webcamVisible;

  useEffect(() => {
    invoke("start_mouse_hook").catch(console.error);

    const unlisten = listen<{ x: number; y: number; button: string }>(
      "mouse-click",
      (event) => {
        const { x, y, button } = event.payload;

        // Check if click is on the webcam bubble — if so, start drag
        if (webcamVisibleRef.current && button === "left") {
          const wp = webcamPosRef.current;
          const cx = wp.x + 75; // center of 150px bubble
          const cy = wp.y + 75;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist <= 75) {
            // Click is on webcam — make overlay interactive and start drag
            dragOffset.current = { x: x - wp.x, y: y - wp.y };
            invoke("set_overlay_interactive", { interactive: true }).catch(console.error);
            setDraggingWebcam(true);
            setWebcamCorner(null); // freeform — next Ctrl+Shift+P resets to br

            const handleMove = (ev: MouseEvent) => {
              setWebcamPos({
                x: ev.clientX - dragOffset.current.x,
                y: ev.clientY - dragOffset.current.y,
              });
            };
            const handleUp = () => {
              setDraggingWebcam(false);
              invoke("set_overlay_interactive", { interactive: false }).catch(console.error);
              document.removeEventListener("mousemove", handleMove);
              document.removeEventListener("mouseup", handleUp);
            };
            document.addEventListener("mousemove", handleMove);
            // Delay attaching mouseup so it doesn't fire from the initial click release
            setTimeout(() => {
              document.addEventListener("mouseup", handleUp);
            }, 100);
            return; // Don't show ripple for webcam clicks
          }
        }

        const id = Date.now() + Math.random();
        setRipples((prev) => [...prev.slice(-9), { id, x, y, button }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }
    );

    return () => {
      invoke("stop_mouse_hook").catch(console.error);
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for tool and clear events from the main app
  useEffect(() => {
    const unlistenTool = listen<string>("overlay-set-tool", (event) => {
      setActiveTool(event.payload as ToolType);
    });

    const unlistenClear = listen("overlay-clear", () => {
      setShapes([]);
      setDrawing(null);
      setActiveTool("none");
    });

    return () => {
      unlistenTool.then((fn) => fn());
      unlistenClear.then((fn) => fn());
    };
  }, []);

  // Drawing handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "none") return;
      const shape: Shape = {
        id: Date.now(),
        type: activeTool,
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      };
      setDrawing(shape);
    },
    [activeTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setDrawing({ ...drawing, endX: e.clientX, endY: e.clientY });
    },
    [drawing]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    // Only add if the shape has some size
    const dx = Math.abs(drawing.endX - drawing.startX);
    const dy = Math.abs(drawing.endY - drawing.startY);
    if (dx > 5 || dy > 5) {
      setShapes((prev) => [...prev, drawing]);
    }
    setDrawing(null);
  }, [drawing]);

  // Webcam drag is handled via the mouse hook click detection above

  const allShapes = drawing ? [...shapes, drawing] : shapes;

  return (
    <>
      {/* Main overlay layer — click-through by default */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "transparent",
          overflow: "hidden",
          pointerEvents: activeTool !== "none" ? "auto" : "none",
          cursor: activeTool !== "none" ? "crosshair" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Tool indicator */}
        {activeTool !== "none" && (
          <div
            style={{
              position: "fixed",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              pointerEvents: "none",
              zIndex: 1000,
            }}
          >
            {activeTool === "rectangle" ? "Rectangle" : "Arrow"} — Ctrl+Shift+Z to clear
          </div>
        )}

        {/* Click ripples */}
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            style={{
              position: "absolute",
              left: ripple.x - 20,
              top: ripple.y - 20,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `3px solid ${ripple.button === "left" ? "#facc15" : "#60a5fa"}`,
              background:
                ripple.button === "left"
                  ? "rgba(250, 204, 21, 0.3)"
                  : "rgba(96, 165, 250, 0.3)",
              pointerEvents: "none",
              animation: "ripple-expand 0.6s ease-out forwards",
            }}
          />
        ))}

        {/* Drawn shapes */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {allShapes.map((shape) => {
            if (shape.type === "rectangle") {
              const x = Math.min(shape.startX, shape.endX);
              const y = Math.min(shape.startY, shape.endY);
              const w = Math.abs(shape.endX - shape.startX);
              const h = Math.abs(shape.endY - shape.startY);
              return (
                <rect
                  key={shape.id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(255, 0, 0, 0.1)"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              );
            }
            if (shape.type === "arrow") {
              const dx = shape.endX - shape.startX;
              const dy = shape.endY - shape.startY;
              const angle = Math.atan2(dy, dx);
              const headLen = 16;
              const x1 = shape.endX - headLen * Math.cos(angle - Math.PI / 6);
              const y1 = shape.endY - headLen * Math.sin(angle - Math.PI / 6);
              const x2 = shape.endX - headLen * Math.cos(angle + Math.PI / 6);
              const y2 = shape.endY - headLen * Math.sin(angle + Math.PI / 6);
              return (
                <g key={shape.id}>
                  <line
                    x1={shape.startX}
                    y1={shape.startY}
                    x2={shape.endX}
                    y2={shape.endY}
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                  <polygon
                    points={`${shape.endX},${shape.endY} ${x1},${y1} ${x2},${y2}`}
                    fill="#ef4444"
                  />
                </g>
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Webcam bubble — separate from main overlay so pointer-events work independently */}
      {webcamVisible && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: webcamPos.x,
            top: webcamPos.y,
            width: 150,
            height: 150,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid rgba(255,255,255,0.8)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            cursor: draggingWebcam ? "grabbing" : "grab",
            pointerEvents: "auto",
            zIndex: 500,
            background: "black",
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
              transform: "scaleX(-1)",
              display: "block",
              pointerEvents: "none",
              borderRadius: "50%",
              clipPath: "circle(50% at 50% 50%)",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes ripple-expand {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
