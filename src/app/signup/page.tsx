"use client";

import Link from "next/link";
import { useState } from "react";
import { createLocalUser } from "@/lib/localAuth";
import { FORCE_LOCAL_AUTH } from "@/lib/appConfig";
import { useTranslation } from "@/lib/i18n";

export default function SignupPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gln, setGln] = useState("");
  const [orgGln, setOrgGln] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (!orgGln) {
      setError(t("auth.orgGlnRequired"));
      setLoading(false);
      return;
    }
    if (!/^\d{13}$/.test(orgGln)) {
      setError(t("auth.orgGlnInvalid"));
      setLoading(false);
      return;
    }
    if (gln && !/^\d{13}$/.test(gln)) {
      setError(t("auth.glnInvalid"));
      setLoading(false);
      return;
    }

    try {
      if (FORCE_LOCAL_AUTH) {
        await createLocalUser(username, password);
        setMessage(t("auth.signupLocalSuccess"));
        setUsername("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setGln("");
        return;
      }
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, firstName, lastName, gln, orgGln }),
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
            setMessage(t("auth.signupLocalSuccess"));
            setError(null);
            setUsername("");
            setPassword("");
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : t("auth.errorDefault"));
          }
        } else {
          setError(data?.error || t("auth.errorDefault"));
        }
      } else {
        setMessage(t("auth.signupSuccess"));
        setUsername("");
        setPassword("");
        setFirstName("");
        setLastName("");
        setGln("");
        setOrgGln("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.errorDefault"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 pt-8 pb-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">{t("auth.signupTitle")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("auth.subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="signup-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.username")}
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
              <p className="mt-1 text-xs text-gray-400">{t("auth.usernameHint")}</p>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.password")}
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
              <p className="mt-1 text-xs text-gray-400">{t("auth.passwordHint")}</p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label
                  htmlFor="signup-firstname"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t("auth.firstName")}
                </label>
                <input
                  id="signup-firstname"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  maxLength={64}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="signup-lastname"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t("auth.lastName")}
                </label>
                <input
                  id="signup-lastname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  maxLength={64}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Organisation GLN — required */}
            <div>
              <label
                htmlFor="signup-orggln"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.orgGlnNumber")}
                <span className="ml-1 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="signup-orggln"
                value={orgGln}
                onChange={(e) => setOrgGln(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={13}
                placeholder="7601002074810"
                required
                aria-describedby="signup-orggln-hint"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p id="signup-orggln-hint" className="mt-1 text-xs text-gray-400">{t("auth.orgGlnHint")}</p>
            </div>

            {/* Personal GLN — optional */}
            <div>
              <label
                htmlFor="signup-gln"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.glnNumber")}
              </label>
              <input
                id="signup-gln"
                value={gln}
                onChange={(e) => setGln(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={13}
                placeholder="7601002145985"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">{t("auth.glnHint")}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading ? t("auth.signupSubmitting") : t("auth.signupSubmit")}
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
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            {t("auth.submit")}
          </Link>
        </p>
      </div>
    </div>
  );
}
