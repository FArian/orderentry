"use client";

import Link from "next/link";
import { useState } from "react";
import { setLocalSession, verifyLocalUser } from "@/lib/localAuth";
import { FORCE_LOCAL_AUTH } from "@/lib/appConfig";
import { apiFetch } from "@/lib/apiFetch";
import { logAuth } from "@/lib/logAuth";
import { useTranslation } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toUserMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("503")) return t("auth.error503");
    if (msg.startsWith("401")) return t("auth.error401");
    if (msg.startsWith("400")) return t("auth.error400");
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed")
    )
      return t("auth.errorNetwork");
    return t("auth.errorDefault");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (FORCE_LOCAL_AUTH) {
        logAuth("LOGIN_LOCAL_ATTEMPT", { username });
        const local = await verifyLocalUser(username, password);
        if (!local) {
          setError(t("auth.localError"));
          return;
        }
        setLocalSession({ id: local.id, username: local.username });
        logAuth("LOGIN_LOCAL_SUCCESS", { username });
        window.location.assign("/patients");
        return;
      }

      await apiFetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      setMessage(t("auth.success"));
      window.location.assign("/patients");
    } catch (err: unknown) {
      logAuth("LOGIN_UI_ERROR", {
        raw: err instanceof Error ? err.message : String(err),
      });
      setError(toUserMessage(err));
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
            <h1 className="text-xl font-bold text-gray-900">{t("auth.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("auth.subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.username")}
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
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t("auth.password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
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
              {loading ? t("auth.submitting") : t("auth.submit")}
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
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            {t("auth.register")}
          </Link>
        </p>
      </div>
    </div>
  );
}
