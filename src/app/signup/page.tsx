"use client";

import { useState } from "react";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Error ${res.status}`);
      } else {
        setMessage("Account created successfully.");
        setUsername("");
        setPassword("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>Sign up</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: ".75rem" }}>
        <label style={{ display: "grid", gap: ".25rem" }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_.-]+"
            required
            style={{ padding: ".5rem", border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "grid", gap: ".25rem" }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            style={{ padding: ".5rem", border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: ".6rem .9rem",
            borderRadius: 8,
            border: "1px solid #222",
            background: "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      {message && (
        <p style={{ color: "#05611a", marginTop: ".75rem" }}>{message}</p>
      )}
      {error && (
        <p style={{ color: "#a00", marginTop: ".75rem" }}>{error}</p>
      )}
      <p style={{ marginTop: "1rem" }}>
        Already have an account? <a href="/login" style={{ color: "#0366d6" }}>Log in</a>
      </p>
    </div>
  );
}
