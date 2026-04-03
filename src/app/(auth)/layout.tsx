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
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #fee2e2 100%)",
        padding: "48px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 16,
            border: "1px solid rgba(226,232,240,0.6)",
            boxShadow: "0 4px 24px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)",
            padding: "44px 36px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
