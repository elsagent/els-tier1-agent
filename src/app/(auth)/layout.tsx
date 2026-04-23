export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fdf2f4 0%, #fef7f0 30%, #f8fafc 70%, #f0f4ff 100%)",
        padding: "48px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative gradient orbs */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,16,46,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,54,92,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,16,46,0.03) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 20,
            border: "1px solid rgba(226,232,240,0.5)",
            boxShadow: "0 8px 40px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04)",
            padding: "48px 40px",
          }}
        >
          {children}
        </div>

        {/* Footer text */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
            marginTop: 24,
          }}
        >
          Powered by ELS AI -- Available 24/7
        </p>
      </div>
    </div>
  );
}
