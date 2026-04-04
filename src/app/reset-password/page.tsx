"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

function ResetPasswordForm() {
  const { t }      = useTranslation();
  const params     = useSearchParams();
  const token      = params.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      setError(t("auth.resetPasswordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json() as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? t("auth.resetConfirmError"));
      } else {
        setDone(true);
      }
    } catch {
      setError(t("auth.errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
        {t("auth.resetInvalidLink")}
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {t("auth.resetSuccess")}
        </div>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="rp-password" className="block text-sm font-medium text-gray-700 mb-1">
          {t("auth.newPassword")}
        </label>
        <input
          id="rp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">{t("auth.passwordHint")}</p>
      </div>

      <div>
        <label htmlFor="rp-password2" className="block text-sm font-medium text-gray-700 mb-1">
          {t("auth.confirmPassword")}
        </label>
        <input
          id="rp-password2"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
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
        {loading ? t("auth.resetConfirming") : t("auth.resetConfirm")}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 pt-8 pb-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">{t("auth.resetTitle")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("auth.resetSubtitle")}</p>
          </div>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
