"use client";

import Link from "next/link";
import { useState } from "react";
import { setLocalSession, verifyLocalUser } from "@/lib/localAuth";
import { FORCE_LOCAL_AUTH } from "@/lib/appConfig";
import { apiFetch } from "@/lib/apiFetch";
import { logAuth } from "@/lib/logAuth";

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
        // Explicit local-auth path — only active when
        // NEXT_PUBLIC_FORCE_LOCAL_AUTH=true. Never entered otherwise.
        logAuth("LOGIN_LOCAL_ATTEMPT", { username });
        const local = await verifyLocalUser(username, password);
        if (!local) {
          setError("Ungültige Anmeldedaten (lokaler Speicher).");
          return;
        }
        setLocalSession({ id: local.id, username: local.username });
        logAuth("LOGIN_LOCAL_SUCCESS", { username });
        window.location.assign("/patients");
        return;
      }

      // Server auth — no silent fallback.
      // apiFetch throws with the exact HTTP status + backend message
      // on any non-2xx response, so the catch block always has full context.
      await apiFetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      setMessage("Erfolgreich angemeldet.");
      window.location.assign("/patients");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);

      // Provide a human-readable hint for the most common production failures:
      let hint = "";
      if (raw.startsWith("503")) {
        hint =
          " — Server-Dateisystem nicht verfügbar. Wenden Sie sich an den Administrator.";
      } else if (raw.startsWith("401")) {
        hint = " — Benutzername oder Passwort falsch.";
      } else if (raw.startsWith("400")) {
        hint = " — Eingabe ungültig.";
      } else if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
        hint = " — Server nicht erreichbar. Bitte Verbindung prüfen.";
      }

      setError(raw + hint);
    } finally {
      setLoading(false);
      setPassword("");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 pt-8 pb-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Anmelden</h1>
            <p className="text-sm text-gray-500 mt-1">ZetLab OrderEntry</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Benutzername
              </label>
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_.-]+"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Passwort
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading ? "Wird geprüft…" : "Anmelden"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <p className="font-medium">Anmeldung fehlgeschlagen</p>
              <p className="mt-1 font-mono text-xs break-all">{error}</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Noch kein Konto?{" "}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
