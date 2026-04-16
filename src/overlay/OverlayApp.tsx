export default function OverlayApp() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {/* Phase 1 proof-of-concept: a red circle visible over the desktop */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 0, 0, 0.7)",
          border: "3px solid red",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
