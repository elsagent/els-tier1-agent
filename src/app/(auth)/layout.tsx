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
        background: "#f8fafc",
        padding: "48px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
            padding: "40px 32px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
