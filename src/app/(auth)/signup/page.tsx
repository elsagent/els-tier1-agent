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

  if (success) {
    return (
      <>
        {/* ELS Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#991b1b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.5,
            }}
          >
            ELS
          </div>
        </div>
        <h1
          style={{
            margin: "0 0 8px 0",
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Check your email
        </h1>
        <p
          style={{
            margin: "0 0 0 0",
            textAlign: "center",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          We sent a confirmation link to{" "}
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{email}</span>.
          Click the link to activate your account.
        </p>
        <p
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          <Link
            href="/login"
            style={{
              fontWeight: 600,
              color: "#991b1b",
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "#991b1b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 0.5,
          }}
        >
          ELS
        </div>
      </div>

      <h1
        style={{
          margin: "0 0 4px 0",
          textAlign: "center",
          fontSize: 20,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Electronic Locksmith
      </h1>
      <p
        style={{
          margin: "0 0 24px 0",
          textAlign: "center",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Create your account
      </p>

      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "#0f172a",
              marginBottom: 4,
            }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 13,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              outline: "none",
              color: "#0f172a",
              background: "#ffffff",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "#0f172a",
              marginBottom: 4,
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 13,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              outline: "none",
              color: "#0f172a",
              background: "#ffffff",
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#ef4444", margin: "0 0 12px 0" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: "#991b1b",
            border: "none",
            borderRadius: 10,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p
        style={{
          marginTop: 20,
          textAlign: "center",
          fontSize: 13,
          color: "#64748b",
        }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          style={{
            fontWeight: 600,
            color: "#991b1b",
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
