"use client";

/**
 * /deeplink/error — user-facing error page for failed deep-link requests.
 *
 * Shown when /api/deeplink/order-entry cannot process the token.
 * Displays a localized message based on the error code from the query string.
 * Never exposes internal error details to the end user.
 */

import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { Suspense } from "react";

type ErrorCode =
  | "MISSING_TOKEN"
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "REPLAY_ATTACK"
  | "UNKNOWN_SYSTEM"
  | "PATIENT_NOT_FOUND"
  | "DISABLED"
  | string;

function DeepLinkErrorContent() {
  const { t }  = useTranslation();
  const params = useSearchParams();
  const code   = (params.get("code") ?? "INVALID_TOKEN") as ErrorCode;

  const titleKey = code === "EXPIRED_TOKEN"      ? "deeplink.error.expiredTitle"
                 : code === "PATIENT_NOT_FOUND"  ? "deeplink.error.notFoundTitle"
                 : code === "DISABLED"           ? "deeplink.error.disabledTitle"
                 : "deeplink.error.invalidTitle";

  const msgKey   = code === "EXPIRED_TOKEN"      ? "deeplink.error.expiredMsg"
                 : code === "PATIENT_NOT_FOUND"  ? "deeplink.error.notFoundMsg"
                 : code === "DISABLED"           ? "deeplink.error.disabledMsg"
                 : code === "REPLAY_ATTACK"      ? "deeplink.error.replayMsg"
                 : "deeplink.error.invalidMsg";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zt-bg-page px-4">
      <div className="max-w-md w-full">
        <div className="bg-zt-bg-card border border-zt-border rounded-lg shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zt-danger-light flex items-center justify-center">
            <svg className="w-8 h-8 text-zt-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-zt-text-primary mb-2">
            {t(titleKey)}
          </h1>

          <p className="text-zt-text-secondary text-sm mb-6">
            {t(msgKey)}
          </p>

          <p className="text-xs text-zt-text-tertiary mb-6">
            {t("deeplink.error.contactHint")}
          </p>

          <Link
            href="/patient"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-zt-primary text-white hover:bg-zt-primary-hover transition-colors"
          >
            {t("deeplink.error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DeepLinkErrorPage() {
  return (
    <Suspense>
      <DeepLinkErrorContent />
    </Suspense>
  );
}
