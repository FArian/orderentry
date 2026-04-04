"use client";

import { I18nProvider } from "@/lib/i18n";
import { RefreshProvider } from "@/lib/refresh";
import { SessionProvider, useSession } from "@/lib/session";
import { useIdleTimeout } from "@/presentation/hooks/useIdleTimeout";
import { IdleTimeoutModal } from "@/presentation/components/IdleTimeoutModal";

/** Sits inside SessionProvider so it can read the session state. */
function IdleTimeoutGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { showWarning, secondsRemaining, reset } = useIdleTimeout(isAuthenticated);

  return (
    <>
      {children}
      {showWarning && (
        <IdleTimeoutModal secondsRemaining={secondsRemaining} onContinue={reset} />
      )}
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SessionProvider>
        <IdleTimeoutGuard>
          <RefreshProvider>{children}</RefreshProvider>
        </IdleTimeoutGuard>
      </SessionProvider>
    </I18nProvider>
  );
}
