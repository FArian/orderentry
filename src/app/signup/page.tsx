"use client";

import Link from "next/link";
import { useState } from "react";
import { createLocalUser } from "@/lib/localAuth";
import { FORCE_LOCAL_AUTH } from "@/lib/appConfig";

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
      if (FORCE_LOCAL_AUTH) {
        await createLocalUser(username, password);
        setMessage("Konto lokal auf diesem Gerät erstellt.");
        setUsername("");
        setPassword("");
        return;
      }
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg: string = data?.error || "";
        const maybePermIssue =
          res.status >= 500 ||
          /permission|eacces|read-only|readonly|eprem|eperm|ero?fs|enoent|mkdir|open|write/i.test(msg);
        if (maybePermIssue) {
          try {
            await createLocalUser(username, password);
            setMessage("Konto lokal auf diesem Gerät erstellt.");
            setError(null);
            setUsername("");
            setPassword("");
          } catch (e: unknown) {
            const emsg = e instanceof Error ? e.message : String(e);
            setError(emsg || `Fehler ${res.status}`);
          }
        } else {
          setError(data?.error || `Fehler ${res.status}`);
        }
      } else {
        setMessage("Konto erfolgreich erstellt.");
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
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 pt-8 pb-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Registrieren</h1>
            <p className="text-sm text-gray-500 mt-1">ZetLab OrderEntry</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="signup-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Benutzername
              </label>
              <input
                id="signup-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_.-]+"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                3–32 Zeichen, nur Buchstaben, Ziffern, _.-
              </p>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Passwort
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Mindestens 8 Zeichen</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading ? "Wird erstellt…" : "Konto erstellen"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Bereits ein Konto?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
