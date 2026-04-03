"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverButton, setHoverButton] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    border: focusedField === field ? "1.5px solid #B0122C" : "1px solid #e2e8f0",
    borderRadius: 12,
    outline: "none",
    color: "#0f172a",
    background: "#ffffff",
    transition: "all 0.2s ease",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(176,18,44,0.15)" : "none",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#0f172a",
    marginBottom: 6,
  };

  if (success) {
    return (
      <>
        {/* ELS Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#B0122C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 0.5,
              boxShadow: "0 4px 24px rgba(176,18,44,0.2)",
            }}
          >
            ELS
          </div>
        </div>

        {/* Green check icon */}
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
          We sent a confirmation link to{" "}
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{email}</span>.
          Click the link to activate your account.
        </p>
        <p
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 14,
            color: "#64748b",
          }}
        >
          <Link
            href="/login"
            style={{
              fontWeight: 600,
              color: "#B0122C",
              textDecoration: "none",
            }}
          >
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      {/* ELS Logo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "#B0122C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: 0.5,
            boxShadow: "0 4px 24px rgba(176,18,44,0.2)",
          }}
        >
          ELS
        </div>
      </div>

      <h1
        style={{
          margin: "0 0 6px 0",
          textAlign: "center",
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "-0.01em",
        }}
      >
        Create Account
      </h1>
      <p
        style={{
          margin: "0 0 32px 0",
          textAlign: "center",
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Sign up for ELS Customer Care
      </p>

      <form onSubmit={handleSignup}>
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

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={labelStyle}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            placeholder="At least 6 characters"
            style={inputStyle("password")}
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
            background: loading ? "#B0122C" : hoverButton ? "#8E0F23" : "#B0122C",
            border: "none",
            borderRadius: 12,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.2s ease",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            boxShadow: hoverButton && !loading ? "0 4px 12px rgba(176,18,44,0.3)" : "none",
          }}
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          style={{
            fontWeight: 600,
            color: "#B0122C",
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
