import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELS Customer Care",
  description: "ELS Tier-1 Customer Care Agent",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body
        style={{
          margin: 0,
          padding: 0,
          height: "100%",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          color: "#0f172a",
          background: "#f8fafc",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        {children}
      </body>
    </html>
  );
}
