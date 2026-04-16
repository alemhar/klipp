import { useState, useEffect } from "react";

interface DelayTimerProps {
  seconds: number;
  onComplete: () => void;
}

export function DelayTimer({ seconds, onComplete }: DelayTimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          animation: "pulse 1s ease-in-out infinite",
        }}
      >
        {remaining}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
