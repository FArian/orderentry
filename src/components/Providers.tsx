"use client";

import { I18nProvider } from "@/lib/i18n";
import { RefreshProvider } from "@/lib/refresh";
import { SessionProvider } from "@/lib/session";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SessionProvider>
        <RefreshProvider>{children}</RefreshProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
