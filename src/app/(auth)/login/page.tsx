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
        Customer Support Portal
      </p>

      <form onSubmit={handleLogin}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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
          {loading ? "Signing in..." : "Sign in"}
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
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          style={{
            fontWeight: 600,
            color: "#991b1b",
            textDecoration: "none",
          }}
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
