"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverButton, setHoverButton] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    border: focusedField === field ? "1.5px solid #C8102E" : "1px solid #e2e8f0",
    borderRadius: 12,
    outline: "none",
    color: "#0f172a",
    background: "#ffffff",
    transition: "all 0.2s ease",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(200,16,46,0.15)" : "none",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#0f172a",
    marginBottom: 6,
  };

  if (sent) {
    return (
      <>
        {/* ELS Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#C8102E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 0.5,
              boxShadow: "0 4px 24px rgba(200,16,46,0.2)",
            }}
          >
            ELS
          </div>
        </div>

        {/* Email icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              fill="none"
              stroke="#16a34a"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1
          style={{
            margin: "0 0 8px 0",
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          Check your email
        </h1>
        <p
          style={{
            margin: "0 0 0 0",
            textAlign: "center",
            fontSize: 14,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          We sent a magic link to{" "}
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{email}</span>.
          Click the link to sign in.
        </p>
        <p
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 14,
            color: "#64748b",
          }}
        >
          <button
            type="button"
            onClick={() => setSent(false)}
            style={{
              fontWeight: 600,
              color: "#C8102E",
              textDecoration: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            }}
          >
            Try a different email
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      {/* ELS Logo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #C8102E 0%, #D4365C 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 0.5,
            boxShadow: "0 8px 32px rgba(200,16,46,0.25), 0 4px 12px rgba(200,16,46,0.15)",
          }}
        >
          ELS
        </div>
      </div>

      <h1
        style={{
          margin: "0 0 4px 0",
          textAlign: "center",
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "-0.02em",
        }}
      >
        Welcome to ELS
      </h1>
      <p
        style={{
          margin: "0 0 8px 0",
          textAlign: "center",
          fontSize: 14,
          color: "#64748b",
        }}
      >
        SALTO Lock Support Portal
      </p>
      <p
        style={{
          margin: "0 0 32px 0",
          textAlign: "center",
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        Enter your email to receive a sign-in link
      </p>

      <form onSubmit={handleMagicLink}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email" style={labelStyle}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            placeholder="you@example.com"
            style={inputStyle("email")}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#ef4444",
              margin: "0 0 16px 0",
              padding: "10px 14px",
              background: "rgba(239,68,68,0.06)",
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          onMouseEnter={() => setHoverButton(true)}
          onMouseLeave={() => setHoverButton(false)}
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: "#ffffff",
            background: loading ? "#C8102E" : hoverButton ? "linear-gradient(135deg, #A00C24 0%, #C8102E 100%)" : "linear-gradient(135deg, #C8102E 0%, #D4365C 100%)",
            border: "none",
            borderRadius: 12,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.2s ease",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            boxShadow: hoverButton && !loading ? "0 4px 12px rgba(200,16,46,0.3)" : "none",
          }}
        >
          {loading ? "Sending magic link..." : "Send magic link"}
        </button>
      </form>
    </>
  );
}
