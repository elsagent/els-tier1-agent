"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverButton, setHoverButton] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/chat");
    router.refresh();
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
        Welcome back
      </h1>
      <p
        style={{
          margin: "0 0 32px 0",
          textAlign: "center",
          fontSize: 14,
          color: "#64748b",
        }}
      >
        Sign in to ELS Customer Care
      </p>

      <form onSubmit={handleLogin}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter your password"
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
          {loading ? "Signing in..." : "Sign in"}
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
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          style={{
            fontWeight: 600,
            color: "#B0122C",
            textDecoration: "none",
          }}
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
