"use client";

import { useState } from "react";
import { setLocalSession, verifyLocalUser } from "@/lib/localAuth";
import { FORCE_LOCAL_AUTH } from "@/lib/appConfig";

export default function LoginPage() {
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
      if (FORCE_LOCAL_AUTH) {
        const local = await verifyLocalUser(username, password);
        if (!local) {
          setError("Invalid credentials (local)");
        } else {
          setLocalSession({ id: local.id, username: local.username });
          setMessage("Logged in (local device only).");
          setPassword("");
          window.location.assign("/patient");
        }
        return;
      }
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Try local fallback if server auth fails (e.g., FS permission issues)
        const local = await verifyLocalUser(username, password);
        if (local) {
          setLocalSession({ id: local.id, username: local.username });
          setMessage("Logged in (local device only).");
          setPassword("");
          window.location.assign("/patient");
          return;
        }
        setError(data?.error || `Error ${res.status}`);
      } else {
        setMessage("Logged in successfully.");
        setPassword("");
        // Force a full navigation so cookies apply before render
        window.location.assign("/patient");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>Log in</h1>
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
            autoComplete="current-password"
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
          {loading ? "Checking..." : "Log in"}
        </button>
      </form>

      {message && (
        <p style={{ color: "#05611a", marginTop: ".75rem" }}>{message}</p>
      )}
      {error && (
        <p style={{ color: "#a00", marginTop: ".75rem" }}>{error}</p>
      )}

      <p style={{ marginTop: "1rem" }}>
        Need an account? <a href="/signup" style={{ color: "#0366d6" }}>Sign up</a>
      </p>
    </div>
  );
}
