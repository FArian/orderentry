"use client";

/**
 * IdleTimeoutModal — warns the user before automatic logout.
 *
 * Shown when useIdleTimeout reports showWarning=true.
 * "Weiterarbeiten" resets the idle timer.
 * "Jetzt abmelden" triggers immediate logout.
 */

import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface Props {
  secondsRemaining: number;
  onContinue: () => void;
}

export function IdleTimeoutModal({ secondsRemaining, onContinue }: Props) {
  const { t }  = useTranslation();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    fetch("/api/logout", { method: "POST" }).finally(() => {
      router.push("/login");
    });
  }, [router]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const countdown =
    minutes > 0
      ? `${minutes}:${String(seconds).padStart(2, "0")} min`
      : `${seconds} s`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-zt-bg-card border border-zt-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zt-warning-bg flex items-center justify-center text-xl">
            ⏱
          </div>
          <div>
            <h2 id="idle-title" className="text-base font-semibold text-zt-text-primary">
              {t("idleTimeout.title")}
            </h2>
            <p id="idle-desc" className="text-sm text-zt-text-secondary mt-0.5">
              {t("idleTimeout.subtitle")}
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="bg-zt-warning-bg border border-zt-warning-border rounded-lg px-4 py-3 text-center">
          <span className="text-2xl font-mono font-bold text-zt-warning-text">
            {countdown}
          </span>
          <p className="text-xs text-zt-warning-text mt-1">{t("idleTimeout.countdownLabel")}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-sm rounded-lg border border-zt-border text-zt-text-secondary hover:bg-zt-bg-muted transition-colors"
          >
            {t("idleTimeout.logoutNow")}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 text-sm rounded-lg bg-zt-primary text-zt-text-on-primary hover:bg-zt-primary-hover transition-colors font-medium"
            autoFocus
          >
            {t("idleTimeout.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
