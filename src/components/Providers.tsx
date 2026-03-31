"use client";

import { I18nProvider } from "@/lib/i18n";
import { RefreshProvider } from "@/lib/refresh";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <RefreshProvider>{children}</RefreshProvider>
    </I18nProvider>
  );
}
